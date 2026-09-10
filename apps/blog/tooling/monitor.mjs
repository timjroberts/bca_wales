import { pathToFileURL } from 'node:url';

export async function checkHealth({ url, token, fetcher = fetch, time = Date.now() }) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/api/ops/health' || !token || token.length < 32) throw new Error('Invalid blog monitor configuration');
  let response;
  try { response = await fetcher(endpoint, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error('Blog health endpoint unavailable'); }
  if (response.status !== 200) throw new Error(`Blog health check failed (HTTP ${response.status})`);
  let data;
  try { data = await response.json(); } catch { throw new Error('Invalid blog health response'); }
  const now = Math.floor(time / 1000);
  const recent = (value, age) => Number.isSafeInteger(value) && value > 0 && value <= now + 60 && now - value <= age;
  if (data?.healthy !== true || !recent(data.checkedAt, 300) || !recent(data.lastSuccess, 10800) || !recent(data.lastBackup, 93600) || !Number.isSafeInteger(data.lastFailure) || data.lastFailure < 0 || data.lastFailure >= data.lastSuccess || data.pendingErasure !== 0 || data.pendingRecovery !== 0 || data.staleStaging !== 0 || !Array.isArray(data.problems) || data.problems.length) throw new Error('Blog maintenance or backup requires attention');
  return 'Blog maintenance and backup health passed';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(await checkHealth({ url: process.env.BLOG_HEALTH_URL, token: process.env.BLOG_MONITOR_TOKEN })); }
  catch { console.error('Blog health monitor failed. Inspect the authenticated health endpoint and private operator status.'); process.exitCode = 1; }
}
