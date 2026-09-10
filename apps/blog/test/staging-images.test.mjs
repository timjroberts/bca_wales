import test from 'node:test';
import assert from 'node:assert/strict';
import staging, { admitted } from '../tooling/staging-image-worker.mjs';
import { setup, authConfig } from './helpers.mjs';
const origin = 'https://bca-wales-blog-staging.test.workers.dev';
const settings = () => ({ ...authConfig(), ORIGIN: origin, RESTRICTED: 'true', AUTH_ENABLED: 'false', PUBLISH_PAUSED: 'true', STAGING_IMAGE_UNTIL: String(Math.floor(Date.now() / 1000) + 600), STAGING_IMAGE_TOKEN: 'x'.repeat(43) });
test('temporary image admission is staging-only, expiring and closed for other visitors', async t => {
  const { env } = await setup(t, false, settings());
  const request = (path, token = env.STAGING_IMAGE_TOKEN) => new Request(`${origin}${path}`, { headers: { 'X-BCA-Image-Test': token } });
  assert.equal((await staging.fetch(request('/staging/image-ready'), env)).status, 200);
  for (const changes of [{ STAGING_IMAGE_UNTIL: '0' }, { STAGING_IMAGE_UNTIL: String(Math.floor(Date.now() / 1000) + 3600) }, { STAGING_IMAGE_TOKEN: '' }, { ORIGIN: 'https://bca.wales' }, { AUTH_ENABLED: 'true' }, { RESTRICTED: 'false' }, { PUBLISH_PAUSED: 'false' }]) assert.equal(admitted(request('/api/session'), { ...env, ...changes }), false);
  assert.equal((await staging.fetch(request('/blog/', 'wrong'), env)).status, 503);
  assert.equal((await staging.fetch(request('/api/admin/posts', 'wrong'), env)).status, 503);
  assert.equal((await staging.fetch(request('/auth/login'), env)).status, 404);
  assert.equal((await staging.fetch(request('/api/admin/posts'), env)).status, 401, 'admission does not bypass session authentication');
  assert.equal(env.RESTRICTED, 'true'); assert.equal(env.PUBLISH_PAUSED, 'true');
});
