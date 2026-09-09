import { digest, now, requireThat, uuid } from './errors.mjs';
import { authority, checkAuthority, commit, first, getPost, objectJson, operationInput, readOperation, stmt, withStaging } from './storage.mjs';
const signature = [137,80,78,71,13,10,26,10];
const ascii = bytes => new TextDecoder('ascii').decode(bytes);
function pngChunks(bytes) {
  requireThat(bytes.length >= 33 && signature.every((b,i) => bytes[i] === b), 422, 'Invalid PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), chunks = []; let offset = 8;
  while (offset + 12 <= bytes.length) {
    const size = view.getUint32(offset), type = ascii(bytes.slice(offset + 4, offset + 8));
    requireThat(size <= bytes.length - offset - 12, 422, 'Invalid PNG chunk');
    chunks.push({ type, start: offset, end: offset + size + 12, size }); offset += size + 12;
    if (type === 'IEND') break;
  }
  requireThat(chunks[0]?.type === 'IHDR' && chunks[0].size === 13 && chunks.at(-1)?.type === 'IEND' && offset === bytes.length, 422, 'Invalid PNG structure');
  return chunks;
}
export function imageType(bytes) {
  if (signature.every((b,i) => bytes[i] === b)) {
    const chunks = pngChunks(bytes); requireThat(!chunks.some(c => ['acTL','fcTL','fdAT'].includes(c.type)), 422, 'Animated images are not supported'); return 'image/png';
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    // MPF is the JPEG multi-picture extension. Decode/re-encode still happens below.
    requireThat(!ascii(bytes).includes('MPF\u0000'), 422, 'Multi-frame JPEG is not supported'); return 'image/jpeg';
  }
  if (ascii(bytes.slice(0,4)) === 'RIFF' && ascii(bytes.slice(8,12)) === 'WEBP') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); requireThat(view.getUint32(4,true) + 8 === bytes.length, 422, 'Invalid WebP');
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const type = ascii(bytes.slice(offset,offset + 4)), size = view.getUint32(offset + 4,true);
      requireThat(offset + 8 + size <= bytes.length && !['ANIM','ANMF'].includes(type), 422, 'Animated or invalid WebP');
      if (type === 'VP8X') requireThat(!(bytes[offset + 8] & 2), 422, 'Animated WebP is not supported');
      offset += 8 + size + size % 2;
    }
    requireThat(offset === bytes.length, 422, 'Invalid WebP'); return 'image/webp';
  }
  requireThat(false, 422, 'Only single-frame JPEG, PNG and WebP are supported');
}
// Images binding exposes no metadata-removal switch. Retain only PNG pixel /
// palette/transparency chunks after re-encoding; remove EXIF, text, ICC and XMP.
export function stripPngMetadata(bytes) {
  const allowed = ['IHDR','PLTE','tRNS','IDAT','IEND'];
  const chunks = pngChunks(bytes); requireThat(chunks.some(c => c.type === 'IDAT'), 422, 'PNG pixels missing');
  const kept = chunks.filter(c => allowed.includes(c.type)); const result = new Uint8Array(8 + kept.reduce((n,c) => n + c.end - c.start, 0)); result.set(signature);
  let offset = 8; for (const chunk of kept) { result.set(bytes.slice(chunk.start,chunk.end),offset); offset += chunk.end - chunk.start; } return result;
}
const neutral = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), c => c.charCodeAt(0));
export async function uploadImage(env, actor, postId, bytes, options, key) {
  await checkAuthority(env, actor);
  requireThat(env.PUBLISH_PAUSED !== 'true' && (await first(env, "SELECT value FROM settings WHERE key='publish_paused'"))?.value !== 'true', 503, 'Uploads paused by the operator');
  requireThat(env.IMAGES, 503, 'Image processing is not configured');
  requireThat(bytes.length > 0 && bytes.length <= 10 * 1024 * 1024, 413, 'Image must be at most 10 MiB');
  const type = imageType(bytes); requireThat(type === options.type, 422, 'Image bytes do not match the declared type');
  requireThat(typeof options.sensitive === 'boolean' && ['pixel','neutral'].includes(options.placeholder), 422, 'Review image sensitivity');
  const input = await operationInput('upload', postId, key, { hash: await digest(bytes), ...options });
  const previous = await readOperation(env, actor, input); if (previous) return previous;
  return withStaging(env, actor, postId, async () => {
    const stream = () => new Blob([bytes]).stream();
    const info = await env.IMAGES.info(stream());
    requireThat(info.format === type && Number.isInteger(info.width) && Number.isInteger(info.height) && info.width > 0 && info.height > 0 && info.width <= 8192 && info.height <= 8192 && info.width * info.height <= 24000000, 422, 'Image dimensions exceed 24 megapixels or 8192 pixels');
    const id = uuid(), manifest = {}, guard = authority(actor);
    const pending = await stmt(env, `INSERT INTO media (id,post_id,owner,policy_version,sensitive,ready,manifest,created_at) SELECT ?,?,?,1,?,0,'{}',? WHERE ${guard.sql} AND EXISTS (SELECT 1 FROM posts WHERE id=? AND deleted_at IS NULL) RETURNING id`, id,postId,actor.subject,options.sensitive?1:0,now(),...guard.values,postId).first();
    requireThat(pending,403,'Administrator authority changed during upload');
    await env.CONTENT.put(`media/${id}/original`, bytes, { customMetadata: { sha256: await digest(bytes),postId } });
    const persist = async (variant, output) => {
      const clean = stripPngMetadata(output), hash = await digest(clean), objectKey = `media/${id}/${variant}.png`;
      await env.CONTENT.put(objectKey, clean, { customMetadata: { sha256: hash,postId }, httpMetadata: { contentType: 'image/png' } });
      const stored = await env.CONTENT.get(objectKey); requireThat(stored && await digest(await stored.arrayBuffer()) === hash, 503, 'Processed image could not be verified');
      manifest[variant] = { key: objectKey, hash, size: clean.byteLength, type: 'image/png' };
    };
    for (const width of [640,1280,1920]) {
      const output = await env.IMAGES.input(stream()).transform({ width: Math.min(width, info.width), fit: 'scale-down' }).output({ format: 'image/png', anim: false });
      const response = output.response(); requireThat(response.ok, 503, 'Image processing failed');
      const result = new Uint8Array(await response.arrayBuffer()); requireThat(result.length <= 10 * 1024 * 1024, 422, 'Display image too large'); await persist(String(width), result);
    }
    manifest.display = manifest['1920'];
    let pixel = neutral;
    if (options.placeholder === 'pixel') {
      const output = await env.IMAGES.input(stream()).transform({ width: 16, height: 16, fit: 'scale-down' }).output({ format: 'image/png', anim: false });
      pixel = new Uint8Array(await output.response().arrayBuffer());
      const pinfo = await env.IMAGES.info(new Blob([pixel]).stream()); requireThat(pinfo.width <= 16 && pinfo.height <= 16, 503, 'Safe placeholder unavailable');
    }
    await persist('pixel', pixel);
    const result = { assetId: id, policyVersion: 1, sensitive: options.sensitive, pixel: `/preview/media/${postId}/buffer/${id}/pixel`, width: info.width, height: info.height };
    return commit(env, actor, input, "EXISTS (SELECT 1 FROM posts WHERE id=? AND deleted_at IS NULL) AND NOT EXISTS (SELECT 1 FROM settings WHERE key='publish_paused' AND value='true')", [postId], result, (gate, execution) => [stmt(env, `UPDATE media SET manifest=?,ready=1 WHERE id=? AND post_id=? AND ${gate}`, JSON.stringify(manifest), id, postId, execution)]);
  });
}
export async function imageDetails(env, postId, revisionId, assetId, index = 0) {
  const post = await getPost(env, postId, true); requireThat(post.public_revision === revisionId, 404, 'Not found');
  const revision = await first(env, 'SELECT * FROM revisions WHERE id=? AND post_id=?', revisionId, postId); requireThat(revision, 503, 'Image unavailable');
  const artifact = await objectJson(env, revision.manifest_key, revision.manifest_hash), media = artifact.media[assetId]; requireThat(media, 404, 'Not found');
  const source = await objectJson(env, revision.source_key, revision.source_hash); let attrs, position = 0;
  requireThat(Number.isSafeInteger(index) && index >= 0 && index < 30, 404, 'Not found');
  const visit = n => { if (n.type === 'image') { if(position === index && n.attrs.assetId === assetId) attrs = n.attrs; position++; } (n.content || []).forEach(visit); }; visit(source.doc);
  requireThat(attrs, 404, 'Not found');
  return { assetId, policyVersion: media.policyVersion, sensitive: media.sensitive || attrs.sensitive, alt: attrs.alt, caption: attrs.caption, credit: attrs.credit, display: `/media/${postId}/${revisionId}/${assetId}/display` };
}
