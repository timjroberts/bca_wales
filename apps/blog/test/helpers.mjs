import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { now } from '../src/errors.mjs';
export const example = (title = 'Public title') => ({ schemaVersion: 1, title, excerpt: 'Safe summary', doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello from BCA Wales' }] }] } });
export async function setup(t, worker = false) {
  const script = worker ? (await build({ entryPoints: [new URL('../src/worker.mjs', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'browser', write: false })).outputFiles[0].text : 'export default {fetch(){return new Response("test")}}';
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script, bindings: { ORIGIN: 'https://bca.wales', AUTH_ENABLED: 'false' }, compatibilityDate: '2026-08-01', d1Databases: ['DB'], r2Buckets: ['CONTENT','RECOVERY'] }));
  t.after(() => mf.dispose());
  const env = { DB: await mf.getD1Database('DB'), CONTENT: await mf.getR2Bucket('CONTENT'), RECOVERY: await mf.getR2Bucket('RECOVERY'), ORIGIN: 'https://bca.wales', AUTH_ENABLED: 'false' };
  const sql = await readFile(new URL('../migrations/0001_blog.sql', import.meta.url), 'utf8');
  await env.DB.exec(sql.replace(/\n/g, ' '));
  const actor = { subject: 'facebook:test:admin', sid: crypto.randomUUID(), iat: now(), exp: now() + 28800, attribution: { name: 'Test administrator' } };
  await env.DB.prepare('INSERT INTO administrators VALUES (?,?)').bind(actor.subject, now()).run();
  return { env, actor, mf };
}
export const key = () => crypto.randomUUID();
