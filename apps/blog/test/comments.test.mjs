import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, authConfig, example, key } from './helpers.mjs';
import { createPost, saveDraft, publish, first, rows, withdraw } from '../src/storage.mjs';
import { submitComment, listComments, moderateComment, inspectComment, deleteComment, commentCapabilities } from '../src/comments.mjs';
import { requestErasure, maintenance, flushOutbox } from '../src/recovery.mjs';

async function fixture(t) {
  const context = await setup(t, false, authConfig());
  const { env, actor } = context;
  const post = await createPost(env, actor, { slug: 'comments', consent: 'public-attribution-v1' }, key());
  const saved = await saveDraft(env, actor, post.id, { version: 0, source: example() }, key());
  await publish(env, actor, post.id, { version: 1, revision: saved.revision }, key());
  return { ...context, post, reader: { ...actor, sid: crypto.randomUUID(), subject: 'facebook:123456:reader', attribution: { name: 'Reader' } } };
}
const comment = text => ({ text, consent: 'public-attribution-v1' });

test('comments appear immediately, preserve plain text, retry once, hide privately and restore', async t => {
  const { env, actor, reader, post } = await fixture(t), operation = key();
  const submitted = await submitComment(env, reader, post.id, comment('  <script>private-original</script>\nSecond line  '), operation, '192.0.2.1');
  assert.equal(submitted.body, '<script>private-original</script>\nSecond line');
  assert.deepEqual(await submitComment(env, reader, post.id, comment('  <script>private-original</script>\nSecond line  '), operation, '192.0.2.1'), submitted);
  assert.equal((await listComments(env, post.id)).comments.length, 1);
  const hidden = await moderateComment(env, actor, submitted.id, { action: 'hide', version: 1, reason: 'spam' }, key());
  assert.deepEqual((await listComments(env, post.id)).comments, [{ id: submitted.id, status: 'hidden', message: 'Comment hidden' }]);
  assert.doesNotMatch(JSON.stringify(await listComments(env, post.id)), /Reader|private-original|facebook|spam|createdAt/);
  await assert.rejects(inspectComment(env, reader, submitted.id), { status: 403 });
  const inspected = await inspectComment(env, actor, submitted.id); assert.match(inspected.body, /private-original/); assert.equal(inspected.reason, 'spam');
  assert.deepEqual((await commentCapabilities(env, reader, post.id)).deletable, [submitted.id]);
  await moderateComment(env, actor, submitted.id, { action: 'restore', version: hidden.version }, key());
  assert.match((await listComments(env, post.id)).comments[0].body, /private-original/);
});

test('owner deletion of a hidden comment permanently wins over restore and clears originals', async t => {
  const { env, actor, reader, post } = await fixture(t);
  const submitted = await submitComment(env, reader, post.id, comment('erase this text'), key(), '192.0.2.2');
  await assert.rejects(deleteComment(env, actor, submitted.id, key()), { status: 409 });
  await moderateComment(env, actor, submitted.id, { action: 'hide', version: 1, reason: 'identifying personal information' }, key());
  await deleteComment(env, reader, submitted.id, key());
  await assert.rejects(moderateComment(env, actor, submitted.id, { action: 'restore', version: 2 }, key()), { status: 409 });
  const stored = await first(env, 'SELECT * FROM comments WHERE id=?', submitted.id);
  for (const field of ['subject','attribution','body','reason','moderator','consent_at','consent_version']) assert.equal(stored[field], null);
  assert.equal((await listComments(env, post.id)).comments[0].message, 'Comment deleted');
  assert.doesNotMatch(JSON.stringify(await rows(env, 'SELECT * FROM operations')), /erase this text/);
});

test('concurrent submissions obey atomic limits and deleting text does not reset allowance', async t => {
  const { env, reader, post } = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 7 }, (_, i) => submitComment(env, reader, post.id, comment(`item ${i}`), key(), '192.0.2.3')));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 5);
  assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.status === 429));
  const accepted = results.find(r => r.status === 'fulfilled').value;
  await deleteComment(env, reader, accepted.id, key());
  await assert.rejects(submitComment(env, reader, post.id, comment('extra'), key(), '192.0.2.3'), { status: 429 });
  await env.DB.prepare('UPDATE rate_attempts SET created_at=created_at-601').run();
  assert.equal((await submitComment(env, reader, post.id, comment('later'), key(), '192.0.2.3')).status, 'visible');
});

test('withdrawn posts reject comments and removed administrators cannot moderate', async t => {
  const { env, actor, reader, post } = await fixture(t);
  const submitted = await submitComment(env, reader, post.id, comment('text'), key(), '192.0.2.4');
  await env.DB.prepare('DELETE FROM administrators').run();
  await assert.rejects(moderateComment(env, actor, submitted.id, { action: 'hide', version: 1, reason: 'spam' }, key()), { status: 403 });
  await env.DB.prepare('INSERT INTO administrators VALUES (?,0)').bind(actor.subject).run();
  await withdraw(env, actor, post.id, { version: 2 }, key());
  await assert.rejects(submitComment(env, reader, post.id, comment('new text'), key(), '192.0.2.4'), { status: 409 });
  await assert.rejects(listComments(env, post.id), { status: 404 });
});

test('erasure immediately fences content; cleanup waits for recovery receipts and backup policy', async t => {
  const { env, actor, post } = await fixture(t);
  await submitComment(env, actor, post.id, comment('author personal comment'), key(), '192.0.2.5');
  const badRecovery = { ...env, RECOVERY: { put: async () => { throw new Error('offline'); } } };
  await assert.rejects(requestErasure(badRecovery, actor.subject));
  assert.equal((await first(env, 'SELECT state FROM posts WHERE id=?', post.id)).state, 'draft');
  assert.equal((await first(env, 'SELECT body FROM comments')).body, null);
  assert.equal(await first(env, 'SELECT * FROM administrators'), null);
  const result = await requestErasure(env, actor.subject);
  assert.deepEqual(await requestErasure(env, actor.subject), result);
  await maintenance({ ...env, BACKUP_RETENTION_CONFIRMED: 'false' });
  assert.equal((await first(env, 'SELECT status FROM deletion_jobs WHERE id=?', result.id)).status, 'pending');
  await maintenance(env);
  assert.equal((await first(env, 'SELECT status FROM deletion_jobs WHERE id=?', result.id)).status, 'complete');
  assert.equal((await env.CONTENT.list()).objects.length, 0);
  for (const table of ['comments','revisions','media','operations','audit']) assert.doesNotMatch(JSON.stringify(await rows(env, `SELECT * FROM ${table}`)), /author personal|facebook:test:admin|Test administrator/);
  assert.ok((await env.RECOVERY.list()).objects.length);
  await flushOutbox(env);
});
