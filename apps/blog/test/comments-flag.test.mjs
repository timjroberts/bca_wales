import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, authConfig, example, key } from './helpers.mjs';
import { createPost, saveDraft, publish, first } from '../src/storage.mjs';
import { commentsEnabled, listComments, submitComment } from '../src/comments.mjs';
import { issueSession, csrfToken } from '../src/auth.mjs';
import { articleHtml } from '../shared/presentation.mjs';

for (const enabled of [false, true]) test(`comments flag ${enabled ? 'on restores' : 'omitted hides'} reader and HTTP routes while preserving deletion`, async t => {
  const { env, actor, mf } = await setup(t, true, { ...authConfig(), ...(enabled ? { COMMENTS_ENABLED: 'true' } : {}) });
  const post = await createPost(env, actor, { slug: 'flag-test', consent: 'public-attribution-v1' }, key());
  const saved = await saveDraft(env, actor, post.id, { version: 0, source: example() }, key());
  await publish(env, actor, post.id, { version: 1, revision: saved.revision }, key());
  const issued = await issueSession(env, { id: '987', name: 'Comment owner' }, Math.floor(Date.now() / 1000) + 600);
  const seeded = await submitComment({ ...env, COMMENTS_ENABLED: 'true' }, issued.actor, post.id, { text: 'Retained comment', consent: 'public-attribution-v1' }, key(), '192.0.2.1');
  const send = (path, options) => mf.dispatchFetch(`https://bca.wales${path}`, options);
  const html = await (await send('/blog/flag-test/')).text();
  assert.equal(html.includes('id="comments"'), enabled);
  assert.equal(html.includes('Join the conversation'), enabled);
  assert.equal(html.includes('Community guidelines</a>'), enabled);
  const article = await (await send('/api/blog/posts/flag-test')).json();
  assert.equal(article.commentsEnabled, enabled);
  assert.equal(articleHtml(article).includes('id="comments"'), enabled, 'SPA uses current response flag');
  assert.equal((await send('/blog/guidelines/')).status, enabled ? 200 : 404);
  const headers = { Origin: env.ORIGIN, Cookie: `__Host-bca-session=${issued.token}`, 'X-CSRF-Token': await csrfToken(env, issued.actor), 'Content-Type': 'application/json', 'Idempotency-Key': key() };
  const endpoint = `/api/blog/posts/${post.id}/comments`;
  const listed = await send(endpoint); assert.equal(listed.status, enabled ? 200 : 404);
  if (enabled) assert.equal((await listed.json()).comments[0].body, 'Retained comment');
  assert.equal((await send(`${endpoint}/capabilities`, { headers })).status, enabled ? 200 : 404);
  assert.equal((await send(endpoint, { method: 'POST', headers, body: JSON.stringify({ text: 'New comment', consent: 'public-attribution-v1' }) })).status, enabled ? 201 : 404);
  if (!enabled) {
    for (const operation of ['inspect', 'moderate']) assert.equal((await send(`/api/admin/comments/${seeded.id}/${operation}`, { method: 'POST', headers, body: '{}' })).status, 404);
    assert.equal((await first(env, 'SELECT COUNT(*) AS n FROM comments')).n, 1);
    assert.equal((await first(env, 'SELECT body FROM comments WHERE id=?', seeded.id)).body, 'Retained comment');
  }
  assert.equal((await send(`/api/comments/${seeded.id}`, { method: 'DELETE', headers: { ...headers, 'Idempotency-Key': key() } })).status, 200);
  assert.equal((await first(env, 'SELECT body FROM comments WHERE id=?', seeded.id)).body, null);
});

test('only the explicit string true enables comments, including direct service calls', async () => {
  for (const value of [undefined, 'false', 'TRUE', true, '', '1']) {
    const env = { COMMENTS_ENABLED: value }; assert.equal(commentsEnabled(env), false);
    await assert.rejects(listComments(env, 'unused'), { status: 404 });
    await assert.rejects(submitComment(env, null, 'unused', {}, 'unused'), { status: 404 });
  }
});
