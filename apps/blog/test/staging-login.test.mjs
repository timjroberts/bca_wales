import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import { setup, authConfig } from './helpers.mjs';
import { issueSession, csrfToken, session } from '../src/auth.mjs';
import { now } from '../src/errors.mjs';

const origin = 'https://bca-wales-blog-staging.example.workers.dev';
const config = () => ({ ...authConfig(), ORIGIN: origin, RESTRICTED: 'true', AUTH_ENABLED: 'false', PUBLISH_PAUSED: 'true', STAGING_LOGIN_TEST_UNTIL: String(now() + 1800), STAGING_LOGIN_TEST_TOKEN: 'a'.repeat(43) });
const admission = `__Host-bca-staging-test=${'a'.repeat(43)}`;
const request = (path, options = {}) => new Request(`${origin}${path}`, options);

test('test admission requires an exact-origin POST and issues only a bounded secure cookie', async t => {
  const { env } = await setup(t, false, config());
  const send = options => worker.fetch(request('/staging/login', options), env);
  const form = { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `access_code=${env.STAGING_LOGIN_TEST_TOKEN}` };
  assert.match(await (await send()).text(), /name="access_code"/);
  assert.equal((await send({ ...form, headers: { ...form.headers, Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await send({ ...form, body: 'access_code=wrong' })).status, 403);
  assert.equal((await send({ ...form, body: `${form.body}&${form.body}` })).status, 403);
  const response = await send(form);
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/staging/login');
  assert.match(response.headers.get('set-cookie'), /Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=1[0-9]{3}$/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
});

test('bundled test permits browser-bound OAuth start but never opens application or lifecycle routes', async t => {
  const { mf, env } = await setup(t, true, config());
  const send = (path, options = {}) => mf.dispatchFetch(`${origin}${path}`, options);
  assert.equal((await send('/auth/login', { method: 'POST', headers: { Origin: origin, 'X-BCA-Login': '1' } })).status, 403);
  const headers = { Cookie: admission, Origin: origin, 'X-BCA-Login': '1' };
  const response = await send('/auth/login', { method: 'POST', headers });
  assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie'), /__Host-bca-oauth=/);
  const target = new URL((await response.json()).url);
  assert.equal(target.origin, 'https://www.facebook.com'); assert.equal(target.searchParams.get('scope'), 'public_profile');
  assert.equal(target.searchParams.get('redirect_uri'), `${origin}/auth/callback`);
  assert.equal((await send('/auth/callback?code=synthetic&state=invalid', { headers })).status, 401);
  for (const path of ['/blog/', '/api/session', '/account/', '/admin/', '/api/admin/health', '/media/example', '/static/reader.js']) assert.equal((await send(path, { headers })).status, 503, path);
  for (const path of ['/auth/deletion', '/auth/deauthorize', '/api/account/delete']) assert.equal((await send(path, { method: 'POST', headers })).status, 503, path);
  assert.equal((await send('/staging/login.js', { headers })).status, 200);
  assert.match(await (await send('/staging/login', { headers })).text(), /Continue with Facebook/);
  await env.DB.prepare("UPDATE settings SET value='true' WHERE key='restricted'").run();
  assert.equal((await send('/auth/login', { method: 'POST', headers })).status, 503);
  assert.equal((await send('/staging/login', { headers })).status, 503);
});

test('window expiry, credential rotation, origin and deployment flags fail closed', async t => {
  const { env } = await setup(t, false, config());
  const send = (overrides, cookie = admission) => worker.fetch(request('/staging/login', { headers: { Cookie: cookie } }), { ...env, ...overrides });
  for (const overrides of [{ STAGING_LOGIN_TEST_UNTIL: String(now() - 1) }, { STAGING_LOGIN_TEST_UNTIL: String(now() + 7200) }, { STAGING_LOGIN_TEST_TOKEN: '' }, { AUTH_ENABLED: 'true' }, { PUBLISH_PAUSED: 'false' }]) assert.equal((await send(overrides)).status, 503);
  for (const cookie of [`${admission}; ${admission}`, admission.replace(/a/g, 'b')]) assert.match(await (await send({}, cookie)).text(), /name="access_code"/);
  assert.match(await (await send({ STAGING_LOGIN_TEST_TOKEN: 'b'.repeat(43) })).text(), /name="access_code"/);
  for (const ORIGIN of ['https://bca.wales', 'https://bca-wales-blog-staging.example.workers.dev.evil.test', 'http://bca-wales-blog-staging.example.workers.dev']) {
    assert.equal((await worker.fetch(new Request(`${ORIGIN}/staging/login`, { headers: { Cookie: admission } }), { ...env, ORIGIN })).status, 503);
  }
  assert.equal((await worker.fetch(request('/staging/login'), { ...env, RESTRICTED: 'false' })).status, 404);
});

test('the test displays a real session and logout revokes it with CSRF protection', async t => {
  const { env } = await setup(t, false, config());
  const testEnv = { ...env, AUTH_ENABLED: 'true' };
  const issued = await issueSession(testEnv, { id: '987', name: '<Test person>' }, now() + 600);
  const Cookie = `${admission}; __Host-bca-session=${issued.token}`;
  const response = await worker.fetch(request('/staging/login', { headers: { Cookie } }), env);
  assert.equal(response.status, 200); assert.match(await response.text(), /Signed in as <strong>&lt;Test person&gt;<\/strong>/);
  assert.equal((await worker.fetch(request('/staging/logout', { method: 'POST', headers: { Cookie, Origin: origin } }), env)).status, 403);
  assert.equal((await worker.fetch(request('/staging/logout', { method: 'POST', headers: { Cookie, Origin: origin, 'X-CSRF-Token': await csrfToken(testEnv, issued.actor) } }), env)).status, 204);
  await assert.rejects(session(request('/staging/login', { headers: { Cookie } }), testEnv), { status: 401 });
});

test('the provider callback preserves session cookies and returns to the fenced test page', async t => {
  const { env } = await setup(t, false, config());
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /^https:\/\/graph.facebook.com\/v26.0\//);
    if (url.includes('/oauth/access_token')) return Response.json({ access_token: 'synthetic-token' });
    if (url.includes('/debug_token')) return Response.json({ data: { is_valid: true, app_id: env.FACEBOOK_APP_ID, type: 'USER', user_id: '987', scopes: ['public_profile'], expires_at: now() + 600, data_access_expires_at: now() + 1200 } });
    return Response.json({ id: '987', name: 'Synthetic role user' });
  });
  const start = await worker.fetch(request('/auth/login', { method: 'POST', headers: { Cookie: admission, Origin: origin, 'X-BCA-Login': '1' } }), env);
  const state = new URL((await start.json()).url).searchParams.get('state');
  const callback = `/auth/callback?state=${state}&code=synthetic-code`;
  const headers = { Cookie: `${admission}; ${start.headers.get('set-cookie').split(';')[0]}` };
  assert.equal((await worker.fetch(request(callback, { headers: { Cookie: admission } }), env)).status, 401);
  const response = await worker.fetch(request(callback, { headers }), env);
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/staging/login');
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies.some(value => value.startsWith('__Host-bca-oauth=;')));
  const sessionCookie = cookies.find(value => value.startsWith('__Host-bca-session='));
  assert.ok(sessionCookie);
  const page = await worker.fetch(request('/staging/login', { headers: { Cookie: `${admission}; ${sessionCookie.split(';')[0]}` } }), env);
  assert.match(await page.text(), /Signed in as <strong>Synthetic role user<\/strong>/);
  assert.equal((await worker.fetch(request(callback, { headers }), env)).status, 401);
});
