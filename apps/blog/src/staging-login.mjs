import { authEnabled, beginLogin, completeLogin, session, csrfToken, mutation, logout, sameOrigin } from './auth.mjs';
import { first } from './storage.mjs';
import { digest, now, readBytes, requireThat } from './errors.mjs';
import { escapeHtml } from './document.mjs';
import { pageHtml } from './html.mjs';

const path = '/staging/login';
const cookieName = '__Host-bca-staging-test';
const routes = new Map([[path, ['GET', 'HEAD', 'POST']], [`${path}.js`, ['GET', 'HEAD']], ['/auth/login', ['POST']], ['/auth/callback', ['GET']], ['/staging/logout', ['POST']]]);
const script = `const status = document.querySelector('#test-status');
document.querySelector('#facebook-login')?.addEventListener('click', async () => {
  try {
    const response = await fetch('/auth/login', {method:'POST',headers:{'X-BCA-Login':'1'}});
    if (!response.ok) throw new Error('Login could not start. The test window may have expired.');
    location.assign((await response.json()).url);
  } catch (error) { status.textContent = error.message; }
});
document.querySelector('#test-logout')?.addEventListener('click', async event => {
  try {
    const response = await fetch('/staging/logout', {method:'POST',headers:{'X-CSRF-Token':event.currentTarget.dataset.csrf}});
    if (!response.ok) throw new Error('Sign out failed. Refresh and try again.');
    location.assign('/staging/login');
  } catch (error) { status.textContent = error.message; }
});`;

async function matches(value, expected) {
  if (typeof value !== 'string' || value.length !== 43) return false;
  const [a, b] = await Promise.all([digest(value), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

// This temporary capability opens only a login rehearsal, never the application.
// The database recovery switch is still a hard stop, including for the tester.
export async function stagingLogin(request, env) {
  const url = new URL(request.url), methods = routes.get(url.pathname);
  const until = Number(env.STAGING_LOGIN_TEST_UNTIL);
  if (!methods || !/^https:\/\/bca-wales-blog-staging\.[a-z0-9-]+\.workers\.dev$/.test(env.ORIGIN) ||
      env.RESTRICTED !== 'true' || env.AUTH_ENABLED !== 'false' || env.PUBLISH_PAUSED !== 'true' ||
      !Number.isSafeInteger(until) || until <= now() || until > now() + 3600 ||
      !/^[A-Za-z0-9_-]{43}$/.test(env.STAGING_LOGIN_TEST_TOKEN || '')) return null;
  requireThat(methods.includes(request.method), 405, 'Method not allowed');
  const testEnv = { ...env, AUTH_ENABLED: 'true' };
  requireThat(authEnabled(testEnv), 503, 'Staging login credentials are incomplete');
  const page = html => new Response(pageHtml(env, { title: 'Facebook staging test', private: true, interactive: false, path, html }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  if (url.pathname === path && request.method === 'POST') {
    sameOrigin(request, env);
    requireThat(request.headers.get('content-type')?.split(';')[0] === 'application/x-www-form-urlencoded', 415);
    const form = new URLSearchParams(new TextDecoder().decode(await readBytes(request, 1024)));
    requireThat(form.getAll('access_code').length === 1 && await matches(form.get('access_code'), env.STAGING_LOGIN_TEST_TOKEN), 403, 'Invalid test access code');
    requireThat((await first(env, "SELECT value FROM settings WHERE key='restricted'"))?.value === 'false', 503, 'Recovery is in progress');
    return new Response(null, { status: 303, headers: { Location: path, 'Set-Cookie': `${cookieName}=${env.STAGING_LOGIN_TEST_TOKEN}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${until - now()}` } });
  }
  const cookies = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${cookieName}=`));
  const admitted = cookies.length === 1 && await matches(cookies[0].slice(cookieName.length + 1), env.STAGING_LOGIN_TEST_TOKEN);
  if (!admitted && url.pathname === path) return page('<h1>Facebook staging test</h1><p>Enter the private access code for this temporary test.</p><form method="post" action="/staging/login"><label>Test access code <input type="password" name="access_code" required maxlength="43" autocomplete="off"></label><button type="submit">Open test</button></form>');
  requireThat(admitted, 403, 'Test access required');
  requireThat((await first(env, "SELECT value FROM settings WHERE key='restricted'"))?.value === 'false', 503, 'Recovery is in progress');
  if (url.pathname === `${path}.js`) return new Response(script, { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
  if (url.pathname === '/auth/login') return beginLogin(request, testEnv);
  if (url.pathname === '/auth/callback') {
    const response = await completeLogin(request, testEnv);
    response.headers.set('Location', path);
    return response;
  }
  if (url.pathname === '/staging/logout') {
    const actor = await session(request, testEnv); await mutation(request, testEnv, actor);
    return new Response(null, { status: 204, headers: { 'Set-Cookie': await logout(testEnv, actor) } });
  }
  const actor = await session(request, testEnv, true);
  const controls = actor
    ? `<p>Signed in as <strong>${escapeHtml(actor.attribution.name)}</strong>.</p><p>Session expires at ${escapeHtml(new Date(actor.exp * 1000).toISOString())}.</p><button type="button" id="test-logout" data-csrf="${escapeHtml(await csrfToken(testEnv, actor))}">Sign out</button>`
    : '<p>Ready to test Facebook sign-in.</p><button type="button" id="facebook-login">Continue with Facebook</button>';
  return page(`<h1>Facebook staging test</h1><p>This temporary test checks sign-in only. Blog content and administration remain unavailable.</p>${controls}<p id="test-status" role="status"></p><script type="module" src="/staging/login.js"></script>`);
}
