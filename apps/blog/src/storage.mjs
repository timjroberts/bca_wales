import { digest, HttpError, now, requireThat, uuid } from './errors.mjs';
import { validateDocument, renderDocument, RENDERER_VERSION } from './document.mjs';

export const stmt = (env, sql, ...values) => env.DB.prepare(sql).bind(...values);
export const first = (env, sql, ...values) => stmt(env, sql, ...values).first();
export async function rows(env, sql, ...values) { return (await stmt(env, sql, ...values).all()).results; }
// All authority reads use the primary binding directly, never a read-replica session.
export function authority(actor, admin = true) {
  requireThat(actor && typeof actor.subject === 'string' && typeof actor.sid === 'string', 401, 'Sign in required');
  const time = now();
  return {
    sql: `? > ? AND NOT EXISTS (SELECT 1 FROM settings WHERE key='restricted' AND value='true') AND NOT EXISTS (SELECT 1 FROM revocations WHERE expires_at > ? AND ((kind='session' AND key=?) OR (kind='subject' AND key=? AND cutoff>=?))) AND NOT EXISTS (SELECT 1 FROM deletion_jobs WHERE subject=? AND status!='complete') ${admin ? 'AND EXISTS (SELECT 1 FROM administrators WHERE subject=?)' : ''}`,
    values: [actor.exp, time, time, actor.sid, actor.subject, actor.iat, actor.subject, ...(admin ? [actor.subject] : [])]
  };
}
export async function checkAuthority(env, actor, admin = true) {
  const guard = authority(actor, admin);
  requireThat(await first(env, `SELECT 1 AS ok WHERE ${guard.sql}`, ...guard.values), admin ? 403 : 401, admin ? 'Administrator access required' : 'Session expired or revoked');
}
export async function getPost(env, id, isPublic = false) {
  const post = await first(env, `SELECT * FROM posts WHERE id=? AND deleted_at IS NULL ${isPublic ? "AND state='published'" : ''}`, id);
  requireThat(post, 404, 'Not found'); return post;
}
export async function objectJson(env, key, checksum) {
  const object = await env.CONTENT.get(key); requireThat(object, 503, 'Content temporarily unavailable');
  const bytes = await object.arrayBuffer(); requireThat(await digest(bytes) === checksum, 503, 'Content temporarily unavailable');
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(503, 'Content temporarily unavailable'); }
}
async function stage(env, key, value) {
  const text = JSON.stringify(value), hash = await digest(text);
  await env.CONTENT.put(key, text, { httpMetadata: { contentType: 'application/json' }, customMetadata: { sha256: hash } });
  await objectJson(env, key, hash); return hash;
}
export async function readOperation(env, actor, input) {
  const op = await first(env, 'SELECT * FROM operations WHERE key=? AND expires_at>?', input.key, now());
  if (!op) return null;
  requireThat(op.actor === actor.subject && op.action === input.action && op.target === input.target && op.digest === input.digest, 409, 'Operation key already used for different input');
  return JSON.parse(op.result);
}
export async function operationInput(action, target, key, body) {
  requireThat(typeof key === 'string' && /^[a-zA-Z0-9_-]{16,100}$/.test(key), 400, 'A stable operation key is required');
  return { action, target, key, digest: await digest(JSON.stringify(body)) };
}
// Receipt and every dependent write commit together. A unique execution nonce gates
// dependent statements even when the conditional receipt insertion changes zero rows.
export async function commit(env, actor, input, condition, values, result, changes, { admin = true, journal } = {}) {
  await checkAuthority(env, actor, admin);
  const previous = await readOperation(env, actor, input); if (previous) return previous;
  const guard = authority(actor, admin), execution = uuid(), time = now();
  const gate = 'EXISTS (SELECT 1 FROM operations WHERE execution=?)';
  const batch = [stmt(env, `INSERT INTO operations (key,actor,target,action,digest,execution,result,created_at,expires_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard.sql} AND (${condition})`, input.key, actor.subject, input.target, input.action, input.digest, execution, JSON.stringify(result), time, time + 86400, ...guard.values, ...values), ...changes(gate, execution)];
  if (journal) batch.push(stmt(env, `INSERT INTO recovery_outbox (id,action,target,payload,created_at) SELECT ?,?,?,?,? WHERE ${gate}`, uuid(), input.action, input.target, JSON.stringify(journal), time, execution));
  try { await env.DB.batch(batch); }
  catch (error) {
    const retried = await readOperation(env, actor, input); if (retried) return retried;
    if (String(error).includes('UNIQUE constraint')) throw new HttpError(409, 'Conflicting operation or reserved slug');
    throw error;
  }
  const recorded = await readOperation(env, actor, input);
  if (!recorded) { await checkAuthority(env, actor, admin); throw new HttpError(409, 'The content changed. Keep your local work and load the latest version.'); }
  return recorded;
}
export async function createPost(env, actor, body, key) {
  requireThat(typeof body.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) && body.slug.length <= 100 && !['admin', 'privacy', 'guidelines'].includes(body.slug), 422, 'Choose a lowercase URL slug');
  requireThat(body.consent === 'public-attribution-v1', 422, 'Acknowledge public author attribution');
  const input = await operationInput('create', 'posts', key, body);
  await checkAuthority(env, actor); const previous = await readOperation(env, actor, input); if (previous) return previous;
  const id = uuid(), time = now(), result = { id, slug: body.slug, version: 0 };
  return commit(env, actor, input, 'NOT EXISTS (SELECT 1 FROM slugs WHERE slug=?)', [body.slug], result, (gate, execution) => [
    stmt(env, `INSERT INTO posts (id,slug,creator,attribution,consent_version,consent_at,last_editor,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ${gate}`, id, body.slug, actor.subject, JSON.stringify(actor.attribution), body.consent, time, actor.subject, time, execution),
    stmt(env, `INSERT INTO slugs (slug,post_id) SELECT ?,? WHERE ${gate}`, body.slug, id, execution)
  ]);
}
export async function mediaForSource(env, postId, source, revision, preview = false) {
  const { assets } = validateDocument(source); const media = {};
  for (const id of assets) {
    const row = await first(env, 'SELECT * FROM media WHERE id=? AND post_id=?', id, postId); requireThat(row, 422, 'Upload incomplete or belongs to another post');
    const manifest = JSON.parse(row.manifest);
    requireThat(manifest.display && manifest.pixel, 422, 'Image processing incomplete');
    for (const variant of Object.values(manifest)) {
      const object = await env.CONTENT.head(variant.key); requireThat(object && object.size === variant.size && object.customMetadata?.sha256 === variant.hash, 503, 'Image unavailable');
    }
    media[id] = { ...row, manifest };
  }
  const resolve = attrs => {
    const asset = media[attrs.assetId]; requireThat(asset && asset.policy_version === attrs.policyVersion, 422, 'Review replacement image policy');
    if (asset.sensitive || attrs.sensitive) requireThat(!attrs.decorative && attrs.alt.trim() && attrs.warning.trim(), 422, 'Sensitive assets require reviewed alt text and warning');
    const base = `${preview ? '/preview/media' : '/media'}/${postId}/${revision}/${attrs.assetId}`;
    return { sensitive: !!asset.sensitive, pixel: `${base}/pixel`, display: `${base}/display` };
  };
  const inspect = node => { if (node.type === 'image') resolve(node.attrs); (node.content || []).forEach(inspect); }; inspect(source.doc);
  return { media, resolve };
}
async function saveDraftInternal(env, actor, id, body, key) {
  await checkAuthority(env, actor); requireThat(Number.isSafeInteger(body.version) && body.version >= 0, 422, 'Version required');
  const input = await operationInput('save', id, key, body), previous = await readOperation(env, actor, input); if (previous) return previous;
  await getPost(env, id); validateDocument(body.source);
  const revision = uuid(); const { media } = await mediaForSource(env, id, body.source, revision);
  const sourceKey = `posts/${id}/${revision}/source.json`, hash = await stage(env, sourceKey, body.source);
  const result = { id, revision, version: body.version + 1 };
  return commit(env, actor, input, 'EXISTS (SELECT 1 FROM posts WHERE id=? AND version=? AND deleted_at IS NULL)', [id, body.version], result, (gate, execution) => [
    stmt(env, `INSERT INTO revisions (id,post_id,source_key,source_hash,assets,created_at,editor) SELECT ?,?,?,?,?,?,? WHERE ${gate}`, revision, id, sourceKey, hash, JSON.stringify(Object.keys(media)), now(), actor.subject, execution),
    stmt(env, `UPDATE posts SET draft_revision=?,version=version+1,last_editor=? WHERE id=? AND ${gate}`, revision, actor.subject, id, execution)
  ]);
}
export async function draft(env, actor, id) {
  await checkAuthority(env, actor); const post = await getPost(env, id);
  const revision = await first(env, 'SELECT * FROM revisions WHERE id=? AND post_id=?', post.draft_revision, id);
  const source = revision ? await objectJson(env, revision.source_key, revision.source_hash) : null;
  await checkAuthority(env, actor);
  return { id, slug: post.slug, version: post.version, state: post.state, draftRevision: post.draft_revision, publicRevision: post.public_revision, source };
}
async function publishInternal(env, actor, id, body, key) {
  await checkAuthority(env, actor);
  requireThat(env.PUBLISH_PAUSED !== 'true' && (await first(env, "SELECT value FROM settings WHERE key='publish_paused'"))?.value !== 'true', 503, 'Publication paused by the operator');
  const input = await operationInput('publish', id, key, body), previous = await readOperation(env, actor, input); if (previous) return previous;
  const post = await getPost(env, id);
  requireThat(post.version === body.version && post.draft_revision === body.revision, 409, 'Load the latest saved draft before publishing');
  const revision = await first(env, 'SELECT * FROM revisions WHERE id=? AND post_id=?', body.revision, id); requireThat(revision, 409, 'Save a draft first');
  const source = await objectJson(env, revision.source_key, revision.source_hash);
  const { media, resolve } = await mediaForSource(env, id, source, revision.id);
  const html = renderDocument(source, resolve);
  const metadata = { title: source.title, excerpt: source.excerpt || 'News and updates from BCA Wales.', attribution: JSON.parse(post.attribution), slug: post.slug };
  // Public SPA payload contains sanitized HTML, never the canonical draft tree or subjects.
  const artifact = { rendererVersion: RENDERER_VERSION, html, metadata, media: Object.fromEntries(Object.entries(media).map(([assetId, m]) => [assetId, { policyVersion: m.policy_version, sensitive: !!m.sensitive, variants: m.manifest }])) };
  const manifestKey = `posts/${id}/${revision.id}/render-${uuid()}.json`, hash = await stage(env, manifestKey, artifact), time = now();
  const result = { id, revision: revision.id, version: body.version + 1, state: 'published' };
  return commit(env, actor, input, "EXISTS (SELECT 1 FROM posts WHERE id=? AND version=? AND draft_revision=? AND deleted_at IS NULL) AND NOT EXISTS (SELECT 1 FROM settings WHERE key='publish_paused' AND value='true')", [id, body.version, revision.id], result, (gate, execution) => [
    stmt(env, `UPDATE revisions SET manifest_key=?,manifest_hash=? WHERE id=? AND ${gate}`, manifestKey, hash, revision.id, execution),
    stmt(env, `UPDATE posts SET public_revision=?,public_metadata=?,state='published',version=version+1,first_published_at=COALESCE(first_published_at,?),updated_at=?,last_editor=? WHERE id=? AND ${gate}`, revision.id, JSON.stringify(metadata), time, time, actor.subject, id, execution)
  ]);
}
export async function withdraw(env, actor, id, body, key, remove = false) {
  const input = await operationInput(remove ? 'delete-post' : 'unpublish', id, key, body);
  const result = { id, version: body.version + 1, state: 'draft', deleted: remove };
  return commit(env, actor, input, `EXISTS (SELECT 1 FROM posts WHERE id=? AND version=? AND deleted_at IS NULL ${remove ? "AND state='draft'" : ''})`, [id, body.version], result, (gate, execution) => [
    stmt(env, `UPDATE posts SET state='draft',public_revision=NULL,public_metadata=NULL,version=version+1,deleted_at=?,last_editor=? WHERE id=? AND ${gate}`, remove ? now() : null, actor.subject, id, execution)
  ], { journal: { id, deleted: remove, version: result.version } });
}
export async function publicArticle(env, slug) {
  const post = await first(env, "SELECT p.* FROM posts p JOIN slugs s ON s.post_id=p.id WHERE s.slug=? AND p.state='published' AND p.deleted_at IS NULL", slug); requireThat(post, 404, 'Not found');
  if (post.slug !== slug) return { redirect: `/blog/${post.slug}/` };
  const revision = await first(env, 'SELECT * FROM revisions WHERE id=? AND post_id=?', post.public_revision, post.id); requireThat(revision?.manifest_key, 503, 'Content temporarily unavailable');
  const artifact = await objectJson(env, revision.manifest_key, revision.manifest_hash);
  requireThat(artifact.rendererVersion === RENDERER_VERSION, 503, 'Renderer temporarily unavailable');
  return { id: post.id, revision: revision.id, rendererVersion: artifact.rendererVersion, html: artifact.html, ...JSON.parse(post.public_metadata), publishedAt: post.first_published_at, updatedAt: post.updated_at };
}
export async function publicIndex(env) {
  return (await rows(env, "SELECT id,public_metadata,first_published_at,updated_at FROM posts WHERE state='published' AND deleted_at IS NULL ORDER BY first_published_at DESC,id LIMIT 100")).map(p => ({ id: p.id, ...JSON.parse(p.public_metadata), publishedAt: p.first_published_at, updatedAt: p.updated_at }));
}
export async function renameSlug(env, actor, id, body, key) {
  requireThat(typeof body.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) && body.slug.length <= 100, 422, 'Invalid slug');
  const input = await operationInput('rename-slug', id, key, body);
  return commit(env, actor, input, 'EXISTS (SELECT 1 FROM posts WHERE id=? AND version=? AND deleted_at IS NULL) AND NOT EXISTS (SELECT 1 FROM slugs WHERE slug=? AND post_id!=?)', [id, body.version, body.slug, id], { id, slug: body.slug, version: body.version + 1 }, (gate, execution) => [
    stmt(env, `INSERT OR IGNORE INTO slugs (slug,post_id) SELECT ?,? WHERE ${gate}`, body.slug, id, execution),
    stmt(env, `UPDATE posts SET slug=?,public_metadata=CASE WHEN public_metadata IS NULL THEN NULL ELSE json_set(public_metadata,'$.slug',?) END,version=version+1,last_editor=? WHERE id=? AND ${gate}`, body.slug, body.slug, actor.subject, id, execution)
  ]);
}
export async function preview(env, actor, id, source) {
  await checkAuthority(env, actor); await getPost(env, id);
  const { resolve } = await mediaForSource(env, id, source, 'buffer', true);
  const html = renderDocument(source, resolve); await checkAuthority(env, actor);
  return { id, revision: 'buffer', rendererVersion: RENDERER_VERSION, title: source.title, excerpt: source.excerpt, html, private: true };
}
export async function deliverMedia(env, request, parts, actor = null) {
  const [postId, revisionId, assetId, variant] = parts;
  requireThat(parts.length === 4 && ['pixel', 'display', '640', '1280', '1920'].includes(variant), 404, 'Not found');
  requireThat(!request.headers.has('range'), 416, 'Image ranges are not supported');
  let manifest;
  if (actor) {
    await checkAuthority(env, actor); await getPost(env, postId);
    const media = await first(env, 'SELECT manifest FROM media WHERE id=? AND post_id=?', assetId, postId); requireThat(media, 404, 'Not found'); manifest = JSON.parse(media.manifest);
  } else {
    const post = await getPost(env, postId, true); requireThat(post.public_revision === revisionId, 404, 'Not found');
    const revision = await first(env, 'SELECT * FROM revisions WHERE id=? AND post_id=?', revisionId, postId); requireThat(revision?.manifest_key, 503, 'Content temporarily unavailable');
    const artifact = await objectJson(env, revision.manifest_key, revision.manifest_hash); manifest = artifact.media[assetId]?.variants; requireThat(manifest, 404, 'Not found');
  }
  const item = manifest[variant]; requireThat(item, 404, 'Not found');
  const object = await env.CONTENT.get(item.key); requireThat(object, 503, 'Image temporarily unavailable');
  const bytes = await object.arrayBuffer(); requireThat(bytes.byteLength === item.size && await digest(bytes) === item.hash, 503, 'Image temporarily unavailable');
  if (actor) await checkAuthority(env, actor);
  return new Response(request.method === 'HEAD' ? null : bytes, { headers: { 'Content-Type': item.type, 'Content-Length': String(bytes.byteLength), 'Cache-Control': actor ? 'private, no-store' : 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function withStaging(env, actor, postId, work) {
  const id = uuid(), guard = authority(actor);
  const started = await stmt(env, `INSERT INTO staging SELECT ?,?,?,? WHERE ${guard.sql} AND EXISTS (SELECT 1 FROM posts WHERE id=? AND deleted_at IS NULL) RETURNING id`, id, actor.subject, postId, now() + 3600, ...guard.values, postId).first();
  if (!started) { await checkAuthority(env, actor); throw new HttpError(404, 'Not found'); }
  try { return await work(); }
  finally { await stmt(env, 'DELETE FROM staging WHERE id=?', id).run(); }
}
export async function saveDraft(env, actor, id, body, key) { return withStaging(env, actor, id, () => saveDraftInternal(env, actor, id, body, key)); }
export async function publish(env, actor, id, body, key) { return withStaging(env, actor, id, () => publishInternal(env, actor, id, body, key)); }
