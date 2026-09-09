import { base64url } from 'jose';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { now } from '../src/errors.mjs';
export const example = (title = 'Public title') => ({ schemaVersion: 1, title, excerpt: 'Safe summary', doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello from BCA Wales' }] }] } });
export async function setup(t, worker = false, overrides = {}, runtime = {}) {
  const script = worker ? (await build({ entryPoints: [new URL('../src/worker.mjs', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'browser', write: false })).outputFiles[0].text : 'export default {fetch(){return new Response("test")}}';
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script, bindings: { ORIGIN: 'https://bca.wales', AUTH_ENABLED: 'false', ...overrides }, compatibilityDate: '2026-08-01', d1Databases: ['DB'], r2Buckets: ['CONTENT','RECOVERY'], ...runtime }));
  t.after(() => mf.dispose());
  const env = { DB: await mf.getD1Database('DB'), CONTENT: await mf.getR2Bucket('CONTENT'), RECOVERY: await mf.getR2Bucket('RECOVERY'), ORIGIN: 'https://bca.wales', AUTH_ENABLED: 'false', ...overrides };
  const sql = await readFile(new URL('../migrations/0001_blog.sql', import.meta.url), 'utf8');
  await env.DB.exec(sql.replace(/\n/g, ' '));
  const actor = { subject: 'facebook:test:admin', sid: crypto.randomUUID(), iat: now(), exp: now() + 28800, attribution: { name: 'Test administrator' } };
  await env.DB.prepare('INSERT INTO administrators VALUES (?,?)').bind(actor.subject, now()).run();
  return { env, actor, mf };
}
export const key = () => crypto.randomUUID();

export const authConfig = () => ({ AUTH_ENABLED: 'true', FACEBOOK_APP_ID: '123456', FACEBOOK_APP_SECRET: 'synthetic-provider-secret', FACEBOOK_GRAPH_VERSION: 'v26.0', SESSION_ACTIVE_KID: 'test1', SESSION_KEYS: JSON.stringify({ test1: base64url.encode(new Uint8Array(32).fill(1)) }), TRANSACTION_KEY: base64url.encode(new Uint8Array(32).fill(2)), CSRF_KEY: base64url.encode(new Uint8Array(32).fill(3)), RATE_KEY: 'synthetic-independent-rate-key-32-bytes', BACKUP_RETENTION_CONFIRMED: 'true' });
