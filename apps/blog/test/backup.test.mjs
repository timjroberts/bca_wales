import test from 'node:test';
import assert from 'node:assert/strict';
import { setup,authConfig,example,key } from './helpers.mjs';
import { createPost,saveDraft,publish,first,withdraw } from '../src/storage.mjs';
import { submitComment,moderateComment,deleteComment,listComments } from '../src/comments.mjs';
import { createBackup,restoreBackup,replayEvent } from '../src/backup.mjs';
import { flushOutbox,journalHead,journalKey,requestErasure,maintenance } from '../src/recovery.mjs';

test('paired restore replays independent deletion/moderation/withdrawal and remains restricted',async t=>{
  const { env,actor }=await setup(t,false,authConfig()),post=await createPost(env,actor,{ slug:'backup',consent:'public-attribution-v1' },key());
  const saved=await saveDraft(env,actor,post.id,{ version:0,source:example() },key());await publish(env,actor,post.id,{ version:1,revision:saved.revision },key());
  const comment=await submitComment(env,actor,post.id,{ text:'Must never resurrect',consent:'public-attribution-v1' },key(),'192.0.2.8');
  const backup=await createBackup(env);
  await moderateComment(env,actor,comment.id,{ action:'hide',version:1,reason:'spam' },key());await flushOutbox(env);
  await deleteComment(env,actor,comment.id,key());await flushOutbox(env);
  await withdraw(env,actor,post.id,{ version:2 },key());await flushOutbox(env);
  const head=await journalHead(env);assert.equal(head.sequence,3);
  const { env:restored }=await setup(t,false,authConfig());restored.RECOVERY=env.RECOVERY;restored.RESTRICTED='true';
  const result=await restoreBackup(restored,{ ...backup,expectedJournalSequence:head.sequence,journalComplete:true });assert.equal(result.replayed,3);assert.equal(result.restricted,true);
  assert.equal((await first(restored,"SELECT value FROM settings WHERE key='restricted'")).value,'true');
  assert.equal(await first(restored,'SELECT * FROM administrators'),null);
  const row=await first(restored,'SELECT * FROM comments WHERE id=?',comment.id);assert.equal(row.body,null);assert.equal(row.subject,null);assert.ok(row.deleted_at);
  await replayEvent(restored,{ action:'restore',payload:{ id:comment.id,version:999,hidden:false } });assert.equal((await first(restored,'SELECT body FROM comments WHERE id=?',comment.id)).body,null);
  await assert.rejects(listComments(restored,post.id),{ status:404 });
  assert.equal((await first(restored,"SELECT seq FROM sqlite_sequence WHERE name='recovery_outbox'")).seq,head.sequence);
});
test('journal gaps or unconfirmed completeness block restore before authority replacement',async t=>{
  const { env,actor }=await setup(t),post=await createPost(env,actor,{ slug:'gap',consent:'public-attribution-v1' },key());
  const backup=await createBackup(env);await withdraw(env,actor,post.id,{ version:0 },key());await flushOutbox(env);const head=await journalHead(env);
  await env.RECOVERY.delete(journalKey(head.sequence));
  const restricted={ ...env,RESTRICTED:'true' };
  await assert.rejects(restoreBackup(restricted,{ ...backup,expectedJournalSequence:head.sequence,journalComplete:true }),{ status:409 });
  await assert.rejects(restoreBackup(restricted,{ ...backup,expectedJournalSequence:head.sequence,journalComplete:false }),{ status:409 });
  assert.equal((await first(env,'SELECT version FROM posts WHERE id=?',post.id)).version,1);
});
test('new erasure request after completion creates a fresh job while callback replay stays idempotent',async t=>{
  const { env,actor }=await setup(t,false,authConfig());
  const original=await requestErasure(env,actor.subject,'request-1');await maintenance(env);
  assert.equal((await first(env,'SELECT status FROM deletion_jobs WHERE id=?',original.id)).status,'complete');
  const replay=await requestErasure(env,actor.subject,'request-1');assert.equal(replay.id,original.id);
  const next=await requestErasure(env,actor.subject,'request-2');assert.notEqual(next.id,original.id);
});

test('backup retains independent high-water mark after old outbox rows expire',async t=>{
  const { env,actor }=await setup(t),post=await createPost(env,actor,{ slug:'retention-head',consent:'public-attribution-v1' },key());
  await withdraw(env,actor,post.id,{ version:0 },key());await flushOutbox(env);
  await env.DB.prepare('DELETE FROM recovery_outbox').run();
  const backup=await createBackup(env),manifest=await (await env.RECOVERY.get(backup.manifestKey)).json();assert.equal(manifest.lastSequence,1);
});
