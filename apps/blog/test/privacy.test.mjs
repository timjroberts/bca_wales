import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import { setup } from './helpers.mjs';

test('privacy and aliases remain readable during restriction without accessing user storage', async () => {
  const env = { ORIGIN: 'https://bca.wales', RESTRICTED: 'true', DB: { prepare() { throw new Error('Database unavailable'); } }, ASSETS: { async fetch(request) { assert.equal(new URL(request.url).pathname, '/blog.css'); return new Response('body {}'); } } };
  const fetch = (path, method = 'GET') => worker.fetch(new Request(`https://bca.wales${path}`, { method }), env);
  const response = await fetch('/privacy'), body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /href="mailto:bca@timjroberts.com"/);
  assert.match(body, /rel="canonical" href="https:\/\/bca.wales\/privacy"/);
  assert.doesNotMatch(body, /<script|existing BCA Wales contact channel/);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(await (await fetch('/privacy', 'HEAD')).text(), '');
  assert.equal((await fetch('/privacy', 'POST')).status, 405);
  for (const path of ['/privacy/', '/blog/privacy', '/blog/privacy/']) {
    const alias = await fetch(path); assert.equal(alias.status, 308); assert.equal(alias.headers.get('location'), '/privacy');
  }
  assert.equal((await fetch('/static/blog.css')).status, 200);
  for (const path of ['/blog/', '/api/session', '/auth/callback', '/api/admin/health', '/static/reader.js', '/media/example', '/privacy/extra']) assert.equal((await fetch(path)).status, 503);
  assert.equal((await worker.fetch(new Request('https://other.example/privacy'), env)).status, 400);
});

test('bundled Worker serves the policy while the database recovery switch still fences content', async t => {
  const { env, mf } = await setup(t, true);
  await env.DB.prepare("UPDATE settings SET value='true' WHERE key='restricted'").run();
  const response = await mf.dispatchFetch('https://bca.wales/privacy');
  assert.equal(response.status, 200); assert.match(await response.text(), /bca@timjroberts.com/);
  assert.equal((await mf.dispatchFetch('https://bca.wales/blog/')).status, 503);
});
