import { EncryptJWT, jwtDecrypt, base64url } from 'jose';
import { exact, bounded } from './document.mjs';
import { digest, HttpError, now, requireThat, uuid, readBytes } from './errors.mjs';
import { stmt, checkAuthority } from './storage.mjs';

export const SESSION_COOKIE = '__Host-bca-session';
const TX_COOKIE = '__Host-bca-oauth';
const cookieValue = (request, name) => {
  const values = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  requireThat(values.length <= 1, 401, 'Ambiguous session'); return values[0]?.slice(name.length + 1);
};
const cookie = (name, value, age) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
function keyBytes(key) {
  let value; try { value = base64url.decode(key); } catch { throw new HttpError(503, 'Authentication is not configured'); }
  requireThat(value.length === 32, 503, 'Authentication is not configured'); return value;
}
export function authEnabled(env) { return env.AUTH_ENABLED === 'true' && /^[0-9]{1,100}$/.test(env.FACEBOOK_APP_ID || '') && !!env.FACEBOOK_APP_SECRET && /^v\d+\.0$/.test(env.FACEBOOK_GRAPH_VERSION || '') && !!env.SESSION_KEYS && !!env.SESSION_ACTIVE_KID && !!env.TRANSACTION_KEY && !!env.CSRF_KEY; }
function keys(env) {
  try { const ring = JSON.parse(env.SESSION_KEYS); requireThat(ring[env.SESSION_ACTIVE_KID], 503); return ring; }
  catch { throw new HttpError(503, 'Authentication is not configured'); }
}
export async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', typeof secret === 'string' ? new TextEncoder().encode(secret) : secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
export async function csrfToken(env, actor) { return base64url.encode(await hmac(keyBytes(env.CSRF_KEY), `csrf:${actor.sid}`)); }
export function sameOrigin(request, env) { requireThat(request.headers.get('origin') === env.ORIGIN, 403, 'Same-origin action required'); }
export async function mutation(request, env, actor) {
  sameOrigin(request, env); requireThat(!['GET','HEAD','OPTIONS'].includes(request.method), 405);
  requireThat(request.headers.get('x-csrf-token') === await csrfToken(env, actor), 403, 'Refresh your session before retrying');
}
export function attribution(data, allowLink = false) {
  const name = typeof data.name === 'string' ? [...data.name.replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, 100).join('') : '';
  const result = { name: name.trim() || 'BCA Wales contributor' };
  if (allowLink && typeof data.link === 'string' && data.link.length <= 1000) {
    try { const url = new URL(data.link); if (url.protocol === 'https:' && ['www.facebook.com','facebook.com'].includes(url.hostname) && !url.username && !url.password && !/[\s\\]/.test(data.link)) result.link = url.href; } catch { /* Optional provider field. */ }
  }
  // Avatars are deliberately optional: a neutral icon avoids retaining expiring
  // provider URLs until a scoped proxy has been demonstrated with the real app.
  return result;
}
export async function issueSession(env, identity, providerExpiry) {
  const time = now(), exp = Math.min(time + 28800, providerExpiry);
  requireThat(Number.isSafeInteger(exp) && exp > time, 401, 'Provider session expired');
  const actor = { purpose: 'blog-session', provider: 'facebook', app: env.FACEBOOK_APP_ID, subject: `facebook:${env.FACEBOOK_APP_ID}:${identity.id}`, sid: uuid(), auth_time: time, iat: time, exp, attribution: attribution(identity, env.FACEBOOK_USER_LINK === 'true') };
  const token = await new EncryptJWT(actor).setProtectedHeader({ alg: 'dir', enc: 'A256GCM', kid: env.SESSION_ACTIVE_KID, typ: 'JWT' }).setIssuer(env.ORIGIN).setAudience('bca-blog').encrypt(keyBytes(keys(env)[env.SESSION_ACTIVE_KID]));
  requireThat(token.length <= 3072, 503, 'Session too large');
  return { actor, cookie: cookie(SESSION_COOKIE, token, exp - time), token };
}
export async function session(request, env, optional = false) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) { if (optional) return null; throw new HttpError(401, 'Sign in required'); }
  requireThat(authEnabled(env), 401, 'Authentication unavailable');
  requireThat(token.length <= 3072, 401, 'Invalid session');
  let actor;
  try {
    const ring = keys(env);
    const result = await jwtDecrypt(token, header => { requireThat(typeof header.kid === 'string' && Object.hasOwn(ring, header.kid), 401); return keyBytes(ring[header.kid]); }, { issuer: env.ORIGIN, audience: 'bca-blog', keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'], clockTolerance: 0 });
    requireThat(result.protectedHeader.typ === 'JWT', 401);
    actor = result.payload;
    exact(actor, ['purpose','provider','app','subject','sid','auth_time','iat','exp','attribution','iss','aud']);
    requireThat(actor.purpose === 'blog-session' && actor.provider === 'facebook' && actor.app === env.FACEBOOK_APP_ID && typeof actor.subject === 'string' && new RegExp(`^facebook:${env.FACEBOOK_APP_ID}:[0-9]{1,100}$`).test(actor.subject) && /^[a-f0-9-]{36}$/.test(actor.sid), 401);
    requireThat([actor.iat, actor.exp, actor.auth_time].every(Number.isSafeInteger) && actor.iat <= now() && actor.auth_time === actor.iat && actor.exp > now() && actor.exp - actor.iat <= 28800, 401);
    exact(actor.attribution, ['name','link']); bounded(actor.attribution.name, 100, 1);
  } catch { throw new HttpError(401, 'Session expired or invalid. Sign in again.'); }
  await checkAuthority(env, actor, false); return actor;
}
export async function beginLogin(request, env) {
  requireThat(authEnabled(env), 503, 'Facebook sign-in is not configured'); sameOrigin(request, env);
  requireThat(request.method === 'POST' && request.headers.get('x-bca-login') === '1', 403, 'Use the sign-in button');
  const nonce = base64url.encode(crypto.getRandomValues(new Uint8Array(32))), browser = uuid(), time = now();
  const tx = await new EncryptJWT({ purpose: 'blog-oauth', nonce, browser }).setProtectedHeader({ alg: 'dir', enc: 'A256GCM', typ: 'JWT' }).setIssuer(env.ORIGIN).setAudience('bca-oauth').setIssuedAt(time).setExpirationTime(time + 600).encrypt(keyBytes(env.TRANSACTION_KEY));
  await stmt(env, 'INSERT INTO oauth_transactions VALUES (?,?,?)', nonce, await digest(browser), time + 600).run();
  const redirect = new URL(`https://www.facebook.com/${env.FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
  redirect.search = new URLSearchParams({ client_id: env.FACEBOOK_APP_ID, redirect_uri: `${env.ORIGIN}/auth/callback`, response_type: 'code', state: nonce, scope: env.FACEBOOK_USER_LINK === 'true' ? 'public_profile,user_link' : 'public_profile' }).toString();
  return new Response(JSON.stringify({ url: redirect.href }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie(TX_COOKIE, tx, 600) } });
}
async function providerJson(fetcher, url, options = {}) {
  // workerd rejects redirect:'error'. Manual mode plus the status check below
  // rejects redirects without forwarding provider credentials to another URL.
  const response = await fetcher(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  requireThat(response.ok, 401, 'Facebook could not verify this login');
  const bytes = await readBytes(response, 65536); let data;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(401, 'Invalid provider response'); }
  requireThat(data && !data.error, 401, 'Facebook could not verify this login'); return data;
}
export async function completeLogin(request, env, fetcher = fetch) {
  requireThat(authEnabled(env), 503, 'Facebook sign-in is not configured');
  const params = new URL(request.url).searchParams;
  requireThat(params.getAll('state').length === 1 && params.getAll('code').length === 1 && !params.has('error'), 401, 'Login cancelled or invalid');
  let tx;
  try { tx = (await jwtDecrypt(cookieValue(request, TX_COOKIE) || '', keyBytes(env.TRANSACTION_KEY), { issuer: env.ORIGIN, audience: 'bca-oauth', keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'] })).payload; }
  catch { throw new HttpError(401, 'Login expired. Please start again.'); }
  requireThat(tx.purpose === 'blog-oauth' && tx.nonce === params.get('state') && typeof tx.browser === 'string', 401, 'Invalid login state');
  const consumed = await stmt(env, 'DELETE FROM oauth_transactions WHERE nonce=? AND browser_hash=? AND expires_at>? RETURNING nonce', tx.nonce, await digest(tx.browser), now()).first();
  requireThat(consumed, 401, 'Login already used or expired');
  bounded(params.get('code'), 4096, 1);
  const graph = `https://graph.facebook.com/${env.FACEBOOK_GRAPH_VERSION}`;
  const token = await providerJson(fetcher, `${graph}/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.FACEBOOK_APP_ID, client_secret: env.FACEBOOK_APP_SECRET, redirect_uri: `${env.ORIGIN}/auth/callback`, code: params.get('code') }) });
  requireThat(typeof token.access_token === 'string' && token.access_token.length <= 8192, 401, 'Invalid provider token');
  const inspected = await providerJson(fetcher, `${graph}/debug_token?${new URLSearchParams({ input_token: token.access_token })}`, { headers: { Authorization: `Bearer ${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}` } });
  const data = inspected.data;
  requireThat(data?.is_valid === true && data.app_id === env.FACEBOOK_APP_ID && data.type === 'USER' && typeof data.user_id === 'string' && /^[0-9]{1,100}$/.test(data.user_id) && Array.isArray(data.scopes) && data.scopes.includes('public_profile'), 401, 'Provider identity mismatch');
  requireThat(Number.isSafeInteger(data.expires_at) && data.expires_at > now() && Number.isSafeInteger(data.data_access_expires_at) && data.data_access_expires_at > now(), 401, 'Provider access expired');
  const proof = Array.from(await hmac(env.FACEBOOK_APP_SECRET, token.access_token), b => b.toString(16).padStart(2, '0')).join('');
  const fields = env.FACEBOOK_USER_LINK === 'true' && data.scopes.includes('user_link') ? 'id,name,link' : 'id,name';
  const identity = await providerJson(fetcher, `${graph}/me?${new URLSearchParams({ fields, appsecret_proof: proof })}`, { headers: { Authorization: `Bearer ${token.access_token}` } });
  requireThat(identity.id === data.user_id, 401, 'Provider identity mismatch');
  const issued = await issueSession(env, identity, Math.min(data.expires_at, data.data_access_expires_at));
  await checkAuthority(env, issued.actor, false);
  const headers = new Headers({ Location: '/admin/' }); headers.append('Set-Cookie', issued.cookie); headers.append('Set-Cookie', cookie(TX_COOKIE, '', 0));
  return new Response(null, { status: 303, headers });
}
export async function logout(env, actor) {
  const id = uuid(), time = now();
  await env.DB.batch([
    stmt(env, "INSERT INTO revocations VALUES ('session',?,?,?) ON CONFLICT(kind,key) DO UPDATE SET expires_at=MAX(expires_at,excluded.expires_at)", actor.sid, time, actor.exp),
    stmt(env, 'INSERT INTO recovery_outbox (id,action,target,payload,created_at) VALUES (?,?,?,?,?)', id, 'revoke-session', actor.sid, JSON.stringify({ sid: actor.sid, expiresAt: actor.exp, cutoff: time }), time)
  ]);
  return cookie(SESSION_COOKIE, '', 0);
}
export async function verifySignedRequest(env, signed) {
  requireThat(typeof signed === 'string' && signed.length <= 16384 && signed.split('.').length === 2, 400, 'Invalid callback');
  const [signature, encoded] = signed.split('.'); let payload, signatureBytes;
  try { payload = JSON.parse(new TextDecoder().decode(base64url.decode(encoded))); signatureBytes = base64url.decode(signature); } catch { throw new HttpError(400, 'Invalid callback'); }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.FACEBOOK_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  requireThat(await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(encoded)), 401, 'Invalid callback');
  requireThat(payload.algorithm === 'HMAC-SHA256' && typeof payload.user_id === 'string' && /^[0-9]{1,100}$/.test(payload.user_id), 400, 'Invalid callback');
  if (payload.issued_at !== undefined) requireThat(Number.isSafeInteger(payload.issued_at) && payload.issued_at <= now() + 60 && payload.issued_at >= now() - 600, 401, 'Expired callback');
  return `facebook:${env.FACEBOOK_APP_ID}:${payload.user_id}`;
}
