// Operator-only rehearsal: --remote explicitly deploys a temporary staging entry.
// Run from the repository root after building dist/staging-image-worker.mjs.
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { remoteEnvironment } from './operator.mjs';
import { issueSession, csrfToken } from '../src/auth.mjs';
import { first, rows, stmt } from '../src/storage.mjs';
import { requestErasure, runErasure } from '../src/recovery.mjs';

if (process.argv[2] !== '--remote') throw Error('Explicit --remote required for the staging rehearsal');
const originalPath = 'apps/blog/wrangler.staging.jsonc', configPath = 'apps/blog/wrangler.staging-images.jsonc';
const original = JSON.parse(await readFile(originalPath, 'utf8'));
const origin = original.vars.ORIGIN;
assert.equal(original.name, 'bca-wales-blog-staging');
assert.match(origin, /^https:\/\/bca-wales-blog-staging\.[a-z0-9-]+\.workers\.dev$/);
for (const [key, value] of Object.entries({ AUTH_ENABLED: 'false', RESTRICTED: 'true', PUBLISH_PAUSED: 'true' })) assert.equal(original.vars[key], value);
const operatorConfig = JSON.parse(await readFile('apps/blog/operator.local.json', 'utf8'));
assert.equal(operatorConfig.environment, 'staging');
assert.equal(operatorConfig.databaseId, original.d1_databases[0].database_id);
const secrets = JSON.parse(await readFile('.env.blog-operator/credentials.json', 'utf8'));
const keys = JSON.parse(await readFile('.env.blog-operator/staging-auth-keys.json', 'utf8'));
const env = remoteEnvironment(operatorConfig, { ...secrets, BCA_BLOG_RATE_KEY: keys.RATE_KEY });
const baseline = await rows(env, "SELECT key,value FROM settings WHERE key IN ('restricted','publish_paused') ORDER BY key");
assert.equal(baseline.length, 2); assert.ok(baseline.every(row => row.value === 'true'));
const deadline = Math.floor(Date.now() / 1000) + 1800;
const gate = randomBytes(32).toString('base64url');
const sessionEnv = { ...original.vars, ...keys, SESSION_KEYS: typeof keys.SESSION_KEYS === 'string' ? keys.SESSION_KEYS : JSON.stringify(keys.SESSION_KEYS) };
const issued = await issueSession(sessionEnv, { id: `999${Date.now()}${Math.floor(Math.random() * 1000000)}`, name: 'Synthetic image rehearsal' }, deadline);
const csrf = await csrfToken(sessionEnv, issued.actor);
const slug = `image-e2e-${Date.now()}`;
const report = { startedAt: new Date().toISOString(), slug, scope: 'Three synthetic images; real HTTP routes, D1, private R2 and Images; synthetic session, no Facebook login or browser editor test', steps: [], passed: false };
const record = async (step, values = {}) => { report.steps.push({ step, at: new Date().toISOString(), ...values }); await writeFile('apps/blog/dist/staging-images-results.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ step, ...values })); };
const command = (args, input = '') => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args, '--config', configPath], { stdio: ['pipe', 'inherit', 'inherit'] });
  child.stdin.end(input); child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error('Wrangler command failed')));
});
const sleep = () => new Promise(resolve => setTimeout(resolve, 10000));
const headers = { 'X-BCA-Image-Test': gate, Cookie: issued.cookie.split(';')[0], Origin: origin, 'X-CSRF-Token': csrf };
let requests = 0, post, stage = 'prepare';
const send = async (path, { method = 'GET', body, extra = {}, authenticated = true, expected = 200 } = {}) => {
  assert.ok(++requests <= 80, 'HTTP request ceiling');
  assert.ok(Date.now() / 1000 < deadline, 'Test window expired');
  const response = await fetch(`${origin}${path}`, { method, headers: { ...(authenticated ? headers : { 'X-BCA-Image-Test': gate }), ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...(method === 'POST' ? { 'Idempotency-Key': randomUUID() } : {}), ...extra }, body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  if (response.status !== expected) { await record('unexpected-response', { stage, status: response.status, contentType: response.headers.get('content-type'), ray: response.headers.get('cf-ray'), errorType: response.headers.get('cf-error-type') }); await response.body?.cancel(); throw Error('Unexpected HTTP response'); }
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  return response;
};
await writeFile(configPath, JSON.stringify({ ...original, main: 'dist/staging-image-worker.mjs', images: { binding: 'IMAGES' }, vars: { ...original.vars, STAGING_IMAGE_UNTIL: String(deadline) } }, null, 2) + '\n');
await writeFile('.env.blog-operator/staging-images-cleanup.json', JSON.stringify({ subject: issued.actor.subject, deadline, slug, baseline }), { flag: 'wx', mode: 0o600 });
try {
  stage = 'deploy';
  await command(['secret', 'put', 'STAGING_IMAGE_TOKEN'], gate);
  await command(['deploy']);
  stage = 'readiness'; let ready = false;
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${origin}/staging/image-ready`, { headers: { 'X-BCA-Image-Test': gate }, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    ready = r.status === 200 && (await r.json()).ready === true; if (!r.bodyUsed) await r.body?.cancel(); if (ready) break; await sleep();
  }
  assert.ok(ready, 'Readiness did not propagate'); await record('ready');
  // Public Worker flags remain closed. Only gated requests override them.
  await env.DB.batch(baseline.map(row => stmt(env, 'UPDATE settings SET value=? WHERE key=?', 'false', row.key)));
  await stmt(env, 'INSERT INTO administrators VALUES (?,?)', issued.actor.subject, Math.floor(Date.now() / 1000)).run();
  const publicCheck = await fetch(`${origin}/blog/`, { signal: AbortSignal.timeout(10000) }); assert.equal(publicCheck.status, 503); await publicCheck.body?.cancel();
  const session = await (await send('/api/session')).json(); assert.equal(session.administrator, true); await record('temporary-administrator-and-public-isolation');
  stage = 'create-post'; post = await (await send('/api/admin/posts', { method: 'POST', body: { slug, consent: 'public-attribution-v1' }, expected: 201 })).json();
  await record('post-created', { postId: post.id });
  const assets = [];
  for (const format of ['jpeg', 'png', 'webp']) {
    stage = `upload-${format}`;
    const width = 1200, height = 800, raw = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const i = (y * width + x) * 3; raw[i] = Math.floor(x / 8) % 256; raw[i + 1] = Math.floor(y / 8) % 256; raw[i + 2] = 120; }
    const bytes = await sharp(raw, { raw: { width, height, channels: 3 } }).withMetadata({ exif: { IFD0: { Artist: 'Synthetic private metadata' } } }).toFormat(format).toBuffer();
    const asset = await (await send(`/api/admin/posts/${post.id}/images`, { method: 'POST', body: bytes, extra: { 'Content-Type': `image/${format}`, 'X-Image-Sensitive': 'false', 'X-Image-Placeholder': 'pixel' }, expected: 201 })).json(); assets.push(asset);
    const row = await first(env, 'SELECT ready,manifest FROM media WHERE id=? AND post_id=?', asset.assetId, post.id); assert.equal(row.ready, 1); const manifest = JSON.parse(row.manifest);
    const variants = [];
    for (const variant of ['640', '1280', '1920', 'pixel']) {
      const object = await env.CONTENT.get(manifest[variant].key); assert.ok(object); const output = Buffer.from(await object.arrayBuffer()); const meta = await sharp(output).metadata();
      await sharp(output).raw().toBuffer(); // Independent full decode, not header inspection only.
      assert.equal(meta.format, 'png'); assert.equal(meta.exif, undefined); assert.equal(meta.icc, undefined); assert.equal(meta.xmp, undefined);
      assert.equal(output.includes(Buffer.from('Synthetic private metadata')), false);
      assert.equal(createHash('sha256').update(output).digest('hex'), manifest[variant].hash);
      assert.ok(meta.width <= (variant === 'pixel' ? 16 : Number(variant))); if (variant === 'pixel') assert.ok(meta.height <= 16);
      variants.push({ variant, width: meta.width, height: meta.height, bytes: output.length });
    }
    await record('upload-and-private-storage-verified', { format, inputBytes: bytes.length, assetId: asset.assetId, variants });
  }
  const source = { schemaVersion: 1, title: 'Synthetic image staging rehearsal', excerpt: 'Temporary synthetic test content', doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Synthetic test; no association photographs.' }] }, ...assets.map((asset, i) => ({ type: 'image', attrs: { version: 1, assetId: asset.assetId, policyVersion: asset.policyVersion, sensitive: false, warning: '', alt: `Synthetic pattern ${i + 1}`, decorative: false, caption: '', credit: 'Synthetic fixture' } }))] } };
  stage = 'save'; const saved = await (await send(`/api/admin/posts/${post.id}/save`, { method: 'POST', body: { version: 0, source } })).json();
  await send(`/blog/${slug}/`, { authenticated: false, expected: 404 });
  stage = 'publish'; const published = await (await send(`/api/admin/posts/${post.id}/publish`, { method: 'POST', body: { version: saved.version, revision: saved.revision } })).json();
  const article = await (await send(`/blog/${slug}/`, { authenticated: false })).text(); assert.match(article, /Synthetic image staging rehearsal/);
  for (const asset of assets) {
    const mediaPath = `/media/${post.id}/${saved.revision}/${asset.assetId}/display`;
    const delivered = Buffer.from(await (await send(mediaPath, { authenticated: false })).arrayBuffer()); assert.equal((await sharp(delivered).metadata()).format, 'png');
    await send(mediaPath.replace(/display$/, 'original'), { authenticated: false, expected: 404 });
  }
  await record('publication-and-reader-delivery-verified');
  stage = 'withdraw'; await send(`/api/admin/posts/${post.id}/unpublish`, { method: 'POST', body: { version: published.version } });
  await send(`/blog/${slug}/`, { authenticated: false, expected: 404 });
  for (const asset of assets) await send(`/media/${post.id}/${saved.revision}/${asset.assetId}/display`, { authenticated: false, expected: 404 });
  await record('withdrawal-verified'); report.passed = true;
} catch { await record('test-failed', { stage }); process.exitCode = 1; }
finally {
  // Restore both database switches first, even if a hosted request failed.
  const cleanupErrors = [];
  try {
    await env.DB.batch(baseline.map(row => stmt(env, 'UPDATE settings SET value=? WHERE key=?', row.value, row.key)));
    const deletion = await requestErasure(env, issued.actor.subject); const job = await first(env, 'SELECT * FROM deletion_jobs WHERE id=?', deletion.id); await runErasure(env, job);
    assert.equal((await first(env, 'SELECT status FROM deletion_jobs WHERE id=?', deletion.id)).status, 'complete');
    assert.equal((await first(env, 'SELECT COUNT(*) AS n FROM administrators WHERE subject=?', issued.actor.subject)).n, 0);
    if (post) { assert.equal((await env.CONTENT.list({ prefix: `posts/${post.id}/` })).objects.length, 0); assert.equal((await first(env, 'SELECT COUNT(*) AS n FROM media WHERE post_id=?', post.id)).n, 0); }
    await record('content-and-administrator-erasure-complete');
  } catch { cleanupErrors.push('database/content cleanup'); }
  try { await writeFile(configPath, JSON.stringify(original, null, 2) + '\n'); await command(['deploy']); } catch { cleanupErrors.push('normal Worker restoration'); }
  try { await command(['secret', 'delete', 'STAGING_IMAGE_TOKEN'], 'y\n'); } catch { cleanupErrors.push('temporary secret removal'); }
  try {
    let closed = false;
    for (let i = 0; i < 12; i++) { const r = await fetch(`${origin}/staging/image-ready`, { headers: { 'X-BCA-Image-Test': gate }, signal: AbortSignal.timeout(10000) }); closed = r.status === 503; await r.body?.cancel(); if (closed) break; await sleep(); }
    assert.ok(closed); assert.deepEqual(await rows(env, "SELECT key,value FROM settings WHERE key IN ('restricted','publish_paused') ORDER BY key"), baseline);
    await record('restricted-paused-and-gate-removed');
  } catch { cleanupErrors.push('shutdown verification'); }
  report.cleanupErrors = cleanupErrors; report.finishedAt = new Date().toISOString(); report.requests = requests;
  await writeFile('apps/blog/dist/staging-images-results.json', JSON.stringify(report, null, 2) + '\n');
  if (!cleanupErrors.length) { await rm('.env.blog-operator/staging-images-cleanup.json'); await rm(configPath); } else { console.log(JSON.stringify({ cleanupErrors })); process.exitCode = 1; }
}
