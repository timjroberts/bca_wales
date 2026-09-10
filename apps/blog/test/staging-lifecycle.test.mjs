import test from 'node:test';
import assert from 'node:assert/strict';
import { base64url } from 'jose';
import worker from '../src/worker.mjs';
import { setup, authConfig } from './helpers.mjs';
import { hmac, issueSession, session } from '../src/auth.mjs';
import { maintenance, journalHead } from '../src/recovery.mjs';
import { now } from '../src/errors.mjs';

const origin = 'https://bca-wales-blog-staging.example.workers.dev';
const config = () => ({ ...authConfig(), ORIGIN: origin, RESTRICTED: 'true', AUTH_ENABLED: 'false', PUBLISH_PAUSED: 'true', STAGING_LIFECYCLE_TEST_UNTIL: String(now() + 1800) });
async function signed(env, overrides = {}) {
  const payload = base64url.encode(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '987', issued_at: now(), ...overrides }));
  return `${base64url.encode(await hmac(env.FACEBOOK_APP_SECRET, payload))}.${payload}`;
}
const form = value => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ signed_request: value }).toString() });

for (const restricted of [true, false]) test(`${restricted ? 'staging' : 'normal'} provider callbacks revoke sessions, journal erasure and return an opaque status receipt`, async t => {
  const { env, mf } = await setup(t, true, { ...config(), ...(!restricted ? { RESTRICTED: 'false', AUTH_ENABLED: 'true', STAGING_LIFECYCLE_TEST_UNTIL: '' } : {}) });
  const authEnv = { ...env, AUTH_ENABLED: 'true' };
  const issued = await issueSession(authEnv, { id: '987', name: 'Private test name' }, now() + 1000);
  const value = await signed(env);
  const send = (path, options) => mf.dispatchFetch(`${origin}${path}`, options);
  const response = await send('/auth/deauthorize', form(value));
  assert.equal(response.status, 200);
  const receipt = await response.json(); assert.match(receipt.confirmation_code, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(receipt.url, `${origin}/deletion-status/${receipt.confirmation_code}`);
  assert.equal(response.headers.get('set-cookie'), null);
  await assert.rejects(session(new Request(`${origin}/account/`, { headers: { Cookie: `__Host-bca-session=${issued.token}` } }), authEnv), { status: 401 });
  assert.equal((await journalHead(env)).sequence, 1);
  assert.deepEqual(await (await send('/auth/deauthorize', form(value))).json(), receipt);
  assert.deepEqual(await (await send('/auth/deletion', form(await signed(env, { issued_at: now() + 1 })))).json(), receipt);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM deletion_jobs').first()).n, 1);
  if (restricted) for (const key of ['facebook_deauthorize_success', 'facebook_deletion_success']) assert.ok(Number((await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first()).value) > 0);
  const pending = await send(new URL(receipt.url).pathname); assert.equal(pending.status, 200);
  const text = await pending.text(); assert.match(text, /Deletion is pending/); assert.doesNotMatch(text, /<script|987|Private test name/);
  assert.equal(pending.headers.get('cache-control'), 'private, no-store');
  assert.equal(await (await send(new URL(receipt.url).pathname, { method: 'HEAD' })).text(), '');
  await maintenance(env);
  assert.match(await (await send(new URL(receipt.url).pathname)).text(), /Live data deletion is complete/);
  assert.equal((await send(`/deletion-status/${'x'.repeat(43)}`)).status, 404);
});

test('unsigned, tampered, stale and malformed requests cannot write erasure state or success markers', async t => {
  const { env, mf } = await setup(t, true, config());
  const send = options => mf.dispatchFetch(`${origin}/auth/deletion`, options);
  assert.equal((await send()).status, 405);
  assert.equal((await send({ method: 'POST', body: '{}' })).status, 415);
  assert.equal((await send(form(''))).status, 400);
  const value = await signed(env);
  assert.equal((await send(form(`xxx${value}`))).status, 401);
  assert.equal((await send(form(await signed(env, { issued_at: now() - 1000 })))).status, 401);
  assert.equal((await send(form(await signed(env, { user_id: 987 })))).status, 400);
  const duplicate = form(value); duplicate.body += `&${duplicate.body}`;
  assert.equal((await send(duplicate)).status, 400);
  assert.equal((await send(form('x'.repeat(21000)))).status, 413);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM deletion_jobs').first()).n, 0);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'facebook_%_success'").first()).n, 0);
});

test('the independent lifecycle window fails closed and never enables browser login or content', async t => {
  const { env } = await setup(t, false, config());
  const options = form(await signed(env));
  const send = (path, overrides = {}, requestOptions = options) => worker.fetch(new Request(`${origin}${path}`, requestOptions), { ...env, ...overrides });
  for (const overrides of [{ STAGING_LIFECYCLE_TEST_UNTIL: '' }, { STAGING_LIFECYCLE_TEST_UNTIL: String(now() - 1) }, { STAGING_LIFECYCLE_TEST_UNTIL: String(now() + 7200) }, { AUTH_ENABLED: 'true' }, { PUBLISH_PAUSED: 'false' }, { FACEBOOK_APP_SECRET: '' }]) assert.equal((await send('/auth/deletion', overrides)).status, 503);
  for (const path of ['/auth/login', '/auth/callback', '/staging/login', '/staging/logout', '/blog/', '/api/session', '/api/admin/health', '/account/', '/media/example', '/static/reader.js', '/deletion-status/', '/deletion-status/short']) assert.equal((await send(path)).status, 503, path);
  for (const ORIGIN of ['https://bca.wales', 'https://bca-wales-blog-staging.example.workers.dev.evil.test', 'http://bca-wales-blog-staging.example.workers.dev']) assert.equal((await worker.fetch(new Request(`${ORIGIN}/auth/deletion`, options), { ...env, ORIGIN })).status, 503);
  await env.DB.prepare("UPDATE settings SET value='true' WHERE key='restricted'").run();
  assert.equal((await send('/auth/deletion')).status, 503);
  assert.equal((await send(`/deletion-status/${'x'.repeat(43)}`, {}, {})).status, 503);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM deletion_jobs').first()).n, 0);
});
