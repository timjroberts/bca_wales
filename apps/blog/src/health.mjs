import { first, stmt } from './storage.mjs';
import { requireThat } from './errors.mjs';

// A separate bearer credential grants aggregate monitoring only, never account access.
export async function monitorHealth(request, env) {
  requireThat(['GET', 'HEAD'].includes(request.method), 405);
  const supplied = request.headers.get('authorization') || '';
  requireThat(typeof env.MONITOR_TOKEN === 'string' && env.MONITOR_TOKEN.length >= 32 && supplied.length <= 256, 404, 'Not found');
  const hash = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [actual, expected] = await Promise.all([hash(supplied), hash(`Bearer ${env.MONITOR_TOKEN}`)]);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= actual[index] ^ expected[index];
  requireThat(difference === 0, 404, 'Not found');
  const time = Math.floor(Date.now() / 1000);
  const marker = async key => Number((await first(env, 'SELECT value FROM settings WHERE key=?', key))?.value || 0);
  const lastSuccess = await marker('maintenance_success');
  const lastFailure = await marker('maintenance_failure');
  const lastBackup = await marker('last_backup');
  const pendingErasure = (await first(env, "SELECT COUNT(*) AS n FROM deletion_jobs WHERE status!='complete'")).n;
  const pendingRecovery = (await first(env, 'SELECT COUNT(*) AS n FROM recovery_outbox WHERE delivered_at IS NULL')).n;
  const staleStaging = (await first(env, 'SELECT COUNT(*) AS n FROM staging WHERE expires_at<?', time)).n;
  const problems = [];
  if (!Number.isFinite(lastSuccess) || lastSuccess <= 0 || lastSuccess > time || time - lastSuccess > 3 * 3600) problems.push('maintenance_overdue');
  if (!Number.isFinite(lastFailure) || lastFailure < 0 || (lastFailure > 0 && lastFailure >= lastSuccess)) problems.push('maintenance_failed');
  if (env.BACKUPS_ENABLED !== 'true' || env.BACKUP_RETENTION_CONFIRMED !== 'true') problems.push('backups_disabled');
  if (!Number.isFinite(lastBackup) || lastBackup <= 0 || lastBackup > time || time - lastBackup > 26 * 3600) problems.push('backup_overdue');
  if (pendingErasure || pendingRecovery || staleStaging) problems.push('operator_attention');
  return Response.json({ healthy: problems.length === 0, checkedAt: time, lastSuccess, lastFailure, lastBackup, pendingErasure, pendingRecovery, staleStaging, problems }, { status: problems.length ? 503 : 200 });
}

export async function recordMaintenance(env, outcome) {
  await stmt(env, 'INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', `maintenance_${outcome}`, String(Math.floor(Date.now() / 1000))).run();
}
