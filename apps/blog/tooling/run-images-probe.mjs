// Executes only the fixed synthetic probe. Never deploys or creates credentials.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const origin = 'https://bca-wales-blog-images-probe.tim-f78.workers.dev';
const safeHeaders = ['content-type', 'cf-ray', 'cf-error-type', 'cf-error-origin', 'retry-after'];
export async function runProbe({ token, deadline, count = 30, fetcher = fetch, record }) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !Number.isInteger(count) || count < 1 || count > 30 || !Number.isSafeInteger(deadline) || deadline <= Date.now() / 1000 || deadline > Date.now() / 1000 + 1800) throw Error('Invalid bounded probe configuration');
  for (let n = 0; n < count; n++) {
    if (Date.now() / 1000 >= deadline) return false;
    const result = { request: n + 1, fixture: n % 3, startedAt: new Date().toISOString(), passed: false };
    const start = Date.now();
    try {
      const response = await fetcher(`${origin}/probe/${result.fixture}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, redirect: 'manual', signal: AbortSignal.timeout(Math.max(1, Math.min(30000, deadline * 1000 - Date.now()))) });
      result.status = response.status;
      result.headers = Object.fromEntries(safeHeaders.map(name => [name, response.headers.get(name)]).filter(([, value]) => value !== null));
      // Persist transport diagnostics even if body reading/parsing fails later.
      await record({ ...result, phase: 'headers' });
      if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        result.error = 'Non-JSON response';
        await response.body?.cancel();
      } else {
        const reader = response.body?.getReader();
        const chunks = []; let length = 0;
        if (reader) try {
          while (true) {
            const { value, done } = await reader.read(); if (done) break;
            length += value.length; if (length > 16384) throw Error('Response too large');
            chunks.push(value);
          }
        } finally { await reader.cancel(); }
        const report = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        // Only retain the known aggregate schema, never arbitrary response text.
        const outputs = report.outputs;
        const valid = report.fixture === result.fixture && Array.isArray(outputs) && outputs.length === 4 && outputs.every(o => Number.isInteger(o.width) && Number.isInteger(o.height) && Number.isInteger(o.bytes) && /^[a-f0-9]{64}$/.test(o.sha256));
        result.passed = response.ok && report.passed === true && valid;
        if (result.passed) {
          result.outputs = outputs.map(({ width, height, bytes, sha256 }) => ({ width, height, bytes, sha256 }));
          if (Number.isFinite(report.elapsedMilliseconds)) result.elapsedMilliseconds = report.elapsedMilliseconds;
        } else result.error = 'Probe reported failure or invalid output';
      }
    } catch { result.error = 'Transport, response-size or JSON parsing failure'; }
    result.wallMilliseconds = Date.now() - start;
    await record({ ...result, phase: 'complete' });
    if (!result.passed) return false;
  }
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [tokenFile, outputFile, deadlineText, countText = '30'] = process.argv.slice(2);
  if (!tokenFile || !outputFile) throw Error('Usage: node run-images-probe.mjs TOKEN_FILE NEW_OUTPUT_FILE DEADLINE_SECONDS [COUNT]');
  const token = (await readFile(tokenFile, 'utf8')).trim();
  const results = [];
  await writeFile(outputFile, '[]\n', { flag: 'wx', mode: 0o600 });
  const passed = await runProbe({ token, deadline: Number(deadlineText), count: Number(countText), record: async result => {
    results[result.request - 1] = result;
    await writeFile(outputFile, JSON.stringify(results, null, 2) + '\n');
    if (result.phase === 'complete') console.log(JSON.stringify({ request: result.request, status: result.status, passed: result.passed, error: result.error }));
  } });
  if (!passed || results.length !== Number(countText)) process.exitCode = 1;
}
