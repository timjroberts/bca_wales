import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, authConfig, key, example } from './helpers.mjs';
import { issueSession, csrfToken } from '../src/auth.mjs';
import { now } from '../src/errors.mjs';

test('bundled Worker authenticates mutation routes and never grants admin from cookie presence', async t => {
  const { env, mf } = await setup(t, true, authConfig());
  const issued = await issueSession(env, { id: '987', name: 'Test person' }, now() + 10000);
  const headers = { Origin: env.ORIGIN, Cookie: `__Host-bca-session=${issued.token}`, 'Content-Type': 'application/json', 'X-CSRF-Token': await csrfToken(env, issued.actor), 'Idempotency-Key': key() };
  const create = () => mf.dispatchFetch('https://bca.wales/api/admin/posts', { method: 'POST', headers, body: JSON.stringify({ slug: 'authenticated', consent: 'public-attribution-v1' }) });
  assert.equal((await create()).status, 403);
  await env.DB.prepare('INSERT INTO administrators VALUES (?,?)').bind(issued.actor.subject, now()).run();
  let response = await create(); assert.equal(response.status, 201); const post = await response.json();
  response = await mf.dispatchFetch(`https://bca.wales/api/admin/posts/${post.id}/save`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': key() }, body: JSON.stringify({ version: 0, source: example() }) }); assert.equal(response.status, 200);
  response = await mf.dispatchFetch(`https://bca.wales/api/admin/posts/${post.id}`, { headers: { Cookie: headers.Cookie } }); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private.*no-store/);
  response = await mf.dispatchFetch(`https://bca.wales/api/admin/posts/${post.id}`, { headers: { Cookie: '__Host-bca-session=present' } }); assert.equal(response.status, 401);
  response = await mf.dispatchFetch('https://bca.wales/api/admin/posts', { method: 'POST', headers: { ...headers, 'X-CSRF-Token': 'wrong' }, body: '{}' }); assert.equal(response.status, 403);
  await env.DB.prepare('DELETE FROM administrators WHERE subject=?').bind(issued.actor.subject).run();
  response = await mf.dispatchFetch(`https://bca.wales/api/admin/posts/${post.id}`, { headers: { Cookie: headers.Cookie } }); assert.equal(response.status, 403);
});
