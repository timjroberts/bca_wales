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
