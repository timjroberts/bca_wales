import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, example, key } from './helpers.mjs';
import { createPost, saveDraft, publish, renameSlug, withdraw, deliverMedia } from '../src/storage.mjs';
import { digest, now } from '../src/errors.mjs';

test('actual bundled Worker serves current SSR/SPA metadata, status, HEAD and canonical aliases', async t => {
  const { env, actor, mf } = await setup(t, true);
  const post = await createPost(env, actor, { slug: 'first-slug', consent: 'public-attribution-v1' }, key());
  const saved = await saveDraft(env, actor, post.id, { version: 0, source: example('Title <safe>') }, key());
  let response = await mf.dispatchFetch('https://bca.wales/blog/first-slug/'); assert.equal(response.status, 404);
  await publish(env, actor, post.id, { version: 1, revision: saved.revision }, key());
  response = await mf.dispatchFetch('https://bca.wales/blog/first-slug/');
  const html = await response.text(); assert.equal(response.status, 200); assert.match(html, /og:image.*\/static\/share.png/); assert.match(html, /Title &lt;safe&gt;/); assert.match(html, /Hello from BCA Wales/);
  assert.match(response.headers.get('cache-control'), /no-store/); assert.doesNotMatch(html, /facebook:test/);
  const api = await (await mf.dispatchFetch('https://bca.wales/api/blog/posts/first-slug')).json(); assert.equal(api.title, 'Title <safe>'); assert.ok(html.includes(api.html));
  response = await mf.dispatchFetch('https://bca.wales/blog/first-slug/', { method: 'HEAD' }); assert.equal(response.status, 200); assert.equal(await response.text(), '');
  await renameSlug(env, actor, post.id, { version: 2, slug: 'new-slug' }, key());
  response = await mf.dispatchFetch('https://bca.wales/blog/first-slug/', { redirect: 'manual' }); assert.equal(response.status, 308); assert.equal(response.headers.get('location'), '/blog/new-slug/');
  await withdraw(env, actor, post.id, { version: 3 }, key());
  response = await mf.dispatchFetch('https://bca.wales/blog/first-slug/'); assert.equal(response.status, 404); assert.doesNotMatch(await response.text(), /og:|Title &lt;safe/);
  assert.equal((await mf.dispatchFetch('https://bca.wales/admin/')).status, 401);
  assert.equal((await mf.dispatchFetch('https://evil.test/blog/')).status, 400);
  await env.DB.prepare("UPDATE settings SET value='true' WHERE key='restricted'").run();
  assert.equal((await mf.dispatchFetch('https://bca.wales/blog/')).status, 503);
});

test('media is gated by current revision, manifest membership, variant and private authorization', async t => {
  const { env, actor } = await setup(t), post = await createPost(env, actor, { slug: 'media', consent: 'public-attribution-v1' }, key());
  const assetId = crypto.randomUUID(), bytes = new Uint8Array([137,80,78,71]), hash = await digest(bytes);
  const variant = { key: `media/${assetId}/display`, hash, size: bytes.length, type: 'image/png' };
  await env.CONTENT.put(variant.key, bytes, { customMetadata: { sha256: hash } });
  await env.DB.prepare('INSERT INTO media (id,post_id,owner,policy_version,sensitive,ready,manifest,created_at) VALUES (?,?,?,?,?,1,?,?)').bind(assetId, post.id, actor.subject, 1, 1, JSON.stringify({ display: variant, pixel: variant }), now()).run();
  const source = example(); source.doc.content.push({ type: 'image', attrs: { version: 1, assetId, policyVersion: 1, sensitive: true, warning: 'Sensitive scene', alt: 'A description', decorative: false, caption: '', credit: '' } });
  const saved = await saveDraft(env, actor, post.id, { version: 0, source }, key());
  const parts = [post.id, saved.revision, assetId, 'display'], request = new Request('https://bca.wales/media/test');
  await assert.rejects(deliverMedia(env, request, parts), { status: 404 });
  await publish(env, actor, post.id, { version: 1, revision: saved.revision }, key());
  assert.equal((await deliverMedia(env, request, parts)).status, 200);
  for (const bad of [[post.id, 'old', assetId, 'display'], [post.id, saved.revision, assetId, 'original'], [post.id, saved.revision, 'missing', 'display']]) await assert.rejects(deliverMedia(env, request, bad), { status: 404 });
  await withdraw(env, actor, post.id, { version: 2 }, key());
  await assert.rejects(deliverMedia(env, new Request(request, { method: 'HEAD' }), parts), { status: 404 });
  assert.equal((await deliverMedia(env, request, parts, actor)).status, 200);
  await env.DB.prepare('DELETE FROM administrators').run();
  await assert.rejects(deliverMedia(env, request, parts, actor), { status: 403 });
});
