import { lifecycleCallback, deletionStatus, facebookLifecycle } from './lifecycle.mjs';
import { first, stmt } from './storage.mjs';
import { now, requireThat } from './errors.mjs';

// Provider-to-server requests authenticate with Meta's signature, not a browser
// cookie. This separate window never opens OAuth, content or administrator access.
export async function stagingLifecycle(request, env) {
  const path = new URL(request.url).pathname, until = Number(env.STAGING_LIFECYCLE_TEST_UNTIL);
  if ((!lifecycleCallback(path) && !deletionStatus(path)) ||
      !/^https:\/\/bca-wales-blog-staging\.[a-z0-9-]+\.workers\.dev$/.test(env.ORIGIN) ||
      env.RESTRICTED !== 'true' || env.AUTH_ENABLED !== 'false' || env.PUBLISH_PAUSED !== 'true' ||
      !Number.isSafeInteger(until) || until <= now() || until > now() + 3600) return null;
  requireThat((await first(env, "SELECT value FROM settings WHERE key='restricted'"))?.value === 'false', 503, 'Recovery is in progress');
  const response = await facebookLifecycle(request, { ...env, AUTH_ENABLED: 'true' });
  if (lifecycleCallback(path)) {
    // Success timestamps only: no payload, signature, subject or receipt in logs.
    await stmt(env, 'INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', `facebook_${path.slice(6)}_success`, String(now())).run();
  }
  return response;
}
