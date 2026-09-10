import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.mjs';
import worker from '../src/worker.mjs';
import { checkHealth } from '../tooling/monitor.mjs';

const token = 'synthetic-monitor-token-with-at-least-32-characters';
const config = { MONITOR_TOKEN: token, RESTRICTED: 'true', BACKUPS_ENABLED: 'true', BACKUP_RETENTION_CONFIRMED: 'true' };
const endpoint = 'https://bca.wales/api/ops/health';
const authorization = { Authorization: `Bearer ${token}` };
const set = (env, key, value) => env.DB.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').bind(key, String(value)).run();

test('restricted health requires its own credential and detects stale, failed and disabled maintenance', async t => {
  const { env, mf } = await setup(t, true, config);
  const time = Math.floor(Date.now() / 1000);
  for (const headers of [{}, { Authorization: 'Bearer wrong' }]) assert.equal((await mf.dispatchFetch(endpoint, { headers })).status, 404);
  assert.equal((await mf.dispatchFetch(`${endpoint}?token=${token}`)).status, 404);
  assert.equal((await mf.dispatchFetch(endpoint, { method: 'POST', headers: authorization })).status, 405);
  assert.equal((await mf.dispatchFetch('https://other.example/api/ops/health', { headers: authorization })).status, 400);
  assert.equal((await mf.dispatchFetch('https://bca.wales/blog/', { headers: authorization })).status, 503);
  let response = await mf.dispatchFetch(endpoint, { headers: authorization });
  assert.equal(response.status, 503);
  assert.ok((await response.json()).problems.includes('maintenance_overdue'));
  await set(env, 'maintenance_success', time - 10);
  await set(env, 'last_backup', time - 100);
  response = await mf.dispatchFetch(endpoint, { headers: authorization });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await response.json()).healthy, true);
  assert.equal(await (await mf.dispatchFetch(endpoint, { method: 'HEAD', headers: authorization })).text(), '');
  await set(env, 'maintenance_failure', time);
  assert.deepEqual((await (await mf.dispatchFetch(endpoint, { headers: authorization })).json()).problems, ['maintenance_failed']);
  await set(env, 'maintenance_failure', 0);
  await set(env, 'maintenance_success', time - 10801);
  await set(env, 'last_backup', time - 93601);
  assert.deepEqual((await (await mf.dispatchFetch(endpoint, { headers: authorization })).json()).problems, ['maintenance_overdue', 'backup_overdue']);
  const disabled = await worker.fetch(new Request(endpoint, { headers: authorization }), { ...env, BACKUPS_ENABLED: 'false' });
  assert.ok((await disabled.json()).problems.includes('backups_disabled'));
  assert.equal((await worker.fetch(new Request(endpoint, { headers: authorization }), { ...env, MONITOR_TOKEN: undefined })).status, 404);
});

test('scheduled maintenance records successful paired backups and sanitized failures', async t => {
  const { env } = await setup(t, false, config);
  await worker.scheduled({}, env);
  assert.equal((await worker.fetch(new Request(endpoint, { headers: authorization }), env)).status, 200);
  assert.ok(await env.RECOVERY.get('backup-latest.json'));
  const broken = { ...env, CONTENT: { list() { throw new Error('synthetic private provider details'); } } };
  await assert.rejects(worker.scheduled({}, broken), { message: 'Blog maintenance failed or needs attention; inspect the private operator status.' });
  const health = await worker.fetch(new Request(endpoint, { headers: authorization }), env);
  assert.equal(health.status, 503);
  assert.ok((await health.json()).problems.includes('maintenance_failed'));
});

test('independent watchdog fails closed for errors, stale payloads and redirects', async () => {
  const time = 1800000000000, now = time / 1000;
  const healthy = { healthy: true, checkedAt: now, lastSuccess: now - 1, lastFailure: 0, lastBackup: now - 60, pendingErasure: 0, pendingRecovery: 0, staleStaging: 0, problems: [] };
  const check = fetcher => checkHealth({ url: endpoint, token, fetcher, time });
  assert.match(await check(async (_url, options) => { assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, `Bearer ${token}`); return Response.json(healthy); }), /passed/);
  for (const payload of [{ ...healthy, lastBackup: now - 93601 }, { ...healthy, checkedAt: now - 301 }, { ...healthy, pendingRecovery: 1 }, { ...healthy, lastFailure: now }, { ...healthy, healthy: false }, null]) await assert.rejects(check(async () => Response.json(payload)));
  await assert.rejects(check(async () => new Response('private provider details', { status: 503 })), /HTTP 503/);
  await assert.rejects(check(async () => { throw new Error('private network detail'); }), /endpoint unavailable/);
  await assert.rejects(checkHealth({ url: `${endpoint}?secret=bad`, token }), /configuration/);
});
