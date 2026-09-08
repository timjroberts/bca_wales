import test from 'node:test';
import assert from 'node:assert/strict';
import { base64url } from 'jose';
import { setup, authConfig } from './helpers.mjs';
import { beginLogin, completeLogin, issueSession, session, csrfToken, mutation, logout, hmac, verifySignedRequest } from '../src/auth.mjs';
import { now } from '../src/errors.mjs';

const cookieRequest = token => new Request('https://bca.wales/api/session', { headers: { Cookie: `__Host-bca-session=${token}` } });

test('AEAD cookie rejects tampering, wrong audience/app, retired key and current revocation', async t => {
  const { env } = await setup(t, false, authConfig());
  const issued = await issueSession(env, { id: '987', name: 'Test person' }, now() + 50000);
  assert.equal(issued.actor.exp - issued.actor.iat, 28800); assert.ok(issued.token.length < 3072);
  assert.match(issued.cookie, /Secure; HttpOnly; SameSite=Lax/); assert.doesNotMatch(issued.token, /Test person|987/);
  assert.equal((await session(cookieRequest(issued.token), env)).subject, 'facebook:123456:987');
  await assert.rejects(session(cookieRequest(issued.token.slice(0, -3) + 'xxx'), env), { status: 401 });
  await assert.rejects(session(cookieRequest(issued.token), { ...env, FACEBOOK_APP_ID: '222' }), { status: 401 });
  await assert.rejects(session(cookieRequest(issued.token), { ...env, ORIGIN: 'https://other.test' }), { status: 401 });
  await assert.rejects(session(cookieRequest(issued.token), { ...env, SESSION_ACTIVE_KID: 'new', SESSION_KEYS: JSON.stringify({ new: base64url.encode(new Uint8Array(32).fill(4)) }) }), { status: 401 });
  const token = await csrfToken(env, issued.actor);
  await mutation(new Request('https://bca.wales/api/action', { method: 'POST', headers: { Origin: env.ORIGIN, 'X-CSRF-Token': token } }), env, issued.actor);
  await assert.rejects(mutation(new Request('https://bca.wales/api/action', { method: 'POST', headers: { Origin: 'https://evil.test', 'X-CSRF-Token': token } }), env, issued.actor), { status: 403 });
  await logout(env, issued.actor);
  await assert.rejects(session(cookieRequest(issued.token), env), { status: 401 });
});

test('OAuth is deliberate, browser-bound, single-use and validates provider app/subject/expiry', async t => {
  const { env } = await setup(t, false, authConfig());
  await assert.rejects(beginLogin(new Request('https://bca.wales/auth/login', { method: 'POST' }), env), { status: 403 });
  async function start() {
    const response = await beginLogin(new Request('https://bca.wales/auth/login', { method: 'POST', headers: { Origin: env.ORIGIN, 'X-BCA-Login': '1' } }), env);
    const { url } = await response.json();
    const state = new URL(url).searchParams.get('state');
    return new Request(`https://bca.wales/auth/callback?state=${state}&code=synthetic-code`, { headers: { Cookie: response.headers.get('set-cookie').split(';')[0] } });
  }
  let calls = 0;
  const provider = async (url, options) => {
    calls++;
    assert.match(url, /^https:\/\/graph.facebook.com\/v26.0\//);
    if (url.includes('/oauth/access_token')) { assert.equal(options.method, 'POST'); return Response.json({ access_token: 'synthetic-token' }); }
    if (url.includes('/debug_token')) return Response.json({ data: { is_valid: true, app_id: env.FACEBOOK_APP_ID, type: 'USER', user_id: '987', scopes: ['public_profile'], expires_at: now() + 1000, data_access_expires_at: now() + 2000 } });
    assert.equal(options.headers.Authorization, 'Bearer synthetic-token'); return Response.json({ id: '987' });
  };
  const request = await start();
  await assert.rejects(completeLogin(new Request(request.url), env, provider), { status: 401 }); assert.equal(calls, 0);
  const response = await completeLogin(request, env, provider); assert.equal(response.status, 303); assert.match(response.headers.get('set-cookie'), /__Host-bca-session=/);
  await assert.rejects(completeLogin(request, env, provider), { status: 401 }); assert.equal(calls, 3);
  const mismatch = await start();
  await assert.rejects(completeLogin(mismatch, env, async (url, options) => url.includes('/debug_token') ? Response.json({ data: { app_id: 'wrong', is_valid: true } }) : provider(url,options)), { status: 401 });
});

test('signed lifecycle callbacks reject altered, stale and malformed identity data', async () => {
  const env = authConfig(), payload = { algorithm: 'HMAC-SHA256', user_id: '987', issued_at: now() };
  async function sign(value) { const encoded = base64url.encode(JSON.stringify(value)); return `${base64url.encode(await hmac(env.FACEBOOK_APP_SECRET, encoded))}.${encoded}`; }
  const signed = await sign(payload);
  assert.equal(await verifySignedRequest(env, signed), 'facebook:123456:987');
  await assert.rejects(verifySignedRequest(env, 'xxx' + signed), { status: 401 });
  await assert.rejects(verifySignedRequest(env, await sign({ ...payload, issued_at: now() - 1000 })), { status: 401 });
  await assert.rejects(verifySignedRequest(env, await sign({ ...payload, user_id: 987 })), { status: 400 });
});
