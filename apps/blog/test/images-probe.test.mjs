import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('Images probe accepts hosted empty streams but rejects request payloads and expired access', async () => {
  const fixture = { type: 'image/png', width: 1, height: 1, base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' };
  const bundle = await build({ entryPoints: [new URL('../tooling/images-probe-worker.mjs', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'synthetic-fixture', setup(builder) {
    builder.onResolve({ filter: /images-probe-fixtures\.json$/ }, () => ({ path: 'fixtures', namespace: 'probe' }));
    builder.onLoad({ filter: /.*/, namespace: 'probe' }, () => ({ contents: JSON.stringify([fixture, fixture, fixture]), loader: 'json' }));
  } }] });
  const { default: probe } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  let calls = 0;
  const env = { PROBE_TOKEN: 'x'.repeat(43), PROBE_UNTIL: String(Math.floor(Date.now() / 1000) + 300), IMAGES: {
    async info() { calls++; return { format: 'image/png', width: 1, height: 1 }; },
    input() { return { transform() { return this; }, async output() { return { response: () => new Response(Buffer.from(fixture.base64, 'base64')) }; } }; }
  } };
  const request = body => new Request('https://probe.example/probe/0', { method: 'POST', headers: { Authorization: `Bearer ${env.PROBE_TOKEN}` }, ...(body ? { body, duplex: 'half' } : {}) });
  const empty = new ReadableStream({ start(controller) { controller.close(); } });
  const ok = await probe.fetch(request(empty), env);
  assert.equal(ok.status, 200); assert.equal((await ok.json()).outputs.length, 4);
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  const previous = calls;
  assert.equal((await probe.fetch(request('arbitrary payload'), env)).status, 400);
  assert.equal((await probe.fetch(request(), { ...env, PROBE_UNTIL: '0' })).status, 404);
  assert.equal((await probe.fetch(request(), { ...env, PROBE_TOKEN: 'y'.repeat(43) })).status, 404);
  assert.equal(calls, previous);
});

test('probe runner preserves failure headers and stops without following redirects or recording HTML', async () => {
  const { runProbe } = await import('../tooling/run-images-probe.mjs');
  const records = []; let calls = 0;
  const passed = await runProbe({ token: 'x'.repeat(43), deadline: Math.floor(Date.now() / 1000) + 60, record: async row => records.push(row), fetcher: async (_url, options) => {
    calls++; assert.equal(options.redirect, 'manual');
    return new Response('<html>private diagnostic body</html>', { status: 503, headers: { 'content-type': 'text/html', 'cf-ray': 'test-ray', 'cf-error-type': '1102', 'set-cookie': 'private' } });
  } });
  assert.equal(passed, false); assert.equal(calls, 1);
  assert.equal(records[0].phase, 'headers'); assert.equal(records[1].status, 503);
  assert.equal(records[1].headers['cf-error-type'], '1102');
  assert.equal(JSON.stringify(records).includes('private'), false);
});

test('probe runner preserves HTTP status when JSON parsing fails and enforces its request ceiling', async () => {
  const { runProbe } = await import('../tooling/run-images-probe.mjs');
  const rows = []; let calls = 0;
  const options = { token: 'x'.repeat(43), deadline: Math.floor(Date.now() / 1000) + 60, record: async row => rows.push(row), fetcher: async () => { calls++; return new Response('{', { status: 502, headers: { 'content-type': 'application/json' } }); } };
  assert.equal(await runProbe(options), false); assert.equal(calls, 1); assert.equal(rows.at(-1).status, 502);
  await assert.rejects(runProbe({ ...options, count: 31 }), /Invalid/); assert.equal(calls, 1);
});

test('probe runner records exactly its bounded number of successful requests', async () => {
  const { runProbe } = await import('../tooling/run-images-probe.mjs');
  const rows = []; let calls = 0;
  const passed = await runProbe({ token: 'x'.repeat(43), count: 3, deadline: Math.floor(Date.now() / 1000) + 60, record: async row => rows.push(row), fetcher: async url => {
    calls++; const fixture = Number(new URL(url).pathname.split('/').at(-1));
    return Response.json({ passed: true, fixture, outputs: Array.from({ length: 4 }, () => ({ width: 1, height: 1, bytes: 68, sha256: 'a'.repeat(64) })), elapsedMilliseconds: 1 });
  } });
  assert.equal(passed, true); assert.equal(calls, 3);
  assert.deepEqual(rows.filter(r => r.phase === 'complete').map(r => r.fixture), [0, 1, 2]);
});
