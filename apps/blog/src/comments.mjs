import { base64url } from 'jose';
import { bounded } from './document.mjs';
import { now, requireThat, uuid } from './errors.mjs';
import { hmac } from './auth.mjs';
import { authority, checkAuthority, commit, first, getPost, operationInput, readOperation, rows, stmt } from './storage.mjs';

export function publicComment(row) {
  if (row.deleted_at !== null) return { id: row.id, status: 'deleted', message: 'Comment deleted' };
  if (row.hidden) return { id: row.id, status: 'hidden', message: 'Comment hidden' };
  return { id: row.id, status: 'visible', body: row.body, attribution: JSON.parse(row.attribution), createdAt: row.created_at };
}
export async function listComments(env, postId, cursor) {
  await getPost(env, postId, true);
  let after = { created_at: 0, id: '' };
  if (cursor) { after = await first(env, 'SELECT created_at,id FROM comments WHERE post_id=? AND id=?', postId, cursor); requireThat(after, 400, 'Invalid comment cursor'); }
  const page = await rows(env, 'SELECT * FROM comments WHERE post_id=? AND (created_at>? OR (created_at=? AND id>?)) ORDER BY created_at,id LIMIT 51', postId, after.created_at, after.created_at, after.id);
  return { comments: page.slice(0, 50).map(publicComment), next: page.length > 50 ? page[49].id : null };
}
export async function commentCapabilities(env, actor, postId) {
  await checkAuthority(env, actor, false); await getPost(env, postId, true);
  return { deletable: (await rows(env, 'SELECT id FROM comments WHERE post_id=? AND subject=? AND deleted_at IS NULL', postId, actor.subject)).map(c => c.id) };
}
async function tags(env, actor, ip) {
  requireThat(typeof env.RATE_KEY === 'string' && env.RATE_KEY.length >= 32, 503, 'Commenting is not configured');
  return { subject: `subject:${base64url.encode(await hmac(env.RATE_KEY, actor.subject))}`, ip: `ip:${base64url.encode(await hmac(env.RATE_KEY, `${Math.floor(now() / 86400)}:${ip || 'unknown'}`))}` };
}
async function checkRate(env, tag) {
  const time = now();
  const counts = await first(env, 'SELECT SUM(created_at>?) AS recent, COUNT(*) AS daily FROM rate_attempts WHERE tag=? AND created_at>?', time - 600, tag, time - 86400);
  requireThat(counts.recent < 5 && counts.daily < 30, 429, 'Comment limit reached. Please try later.');
}
export async function submitComment(env, actor, postId, body, key, ip) {
  await checkAuthority(env, actor, false);
  const input = await operationInput('comment', postId, key, body), previous = await readOperation(env, actor, input);
  if (previous) {
    await getPost(env, postId, true);
    const row = await first(env, 'SELECT * FROM comments WHERE id=?', previous.id); requireThat(row, 404, 'Not found'); return publicComment(row);
  }
  const tag = await tags(env, actor, ip), time = now();
  const guard = authority(actor, false);
  const attempt = await stmt(env, `INSERT INTO rate_attempts (tag,created_at,id) SELECT ?,?,? WHERE ${guard.sql} AND (SELECT COUNT(*) FROM rate_attempts WHERE tag=? AND created_at>?)<60 RETURNING id`, tag.ip, time, uuid(), ...guard.values, tag.ip, time - 600).first();
  requireThat(attempt, 429, 'Too many attempts. Please try later.');
  bounded(body.text, 2000, 1); const text = body.text.trim(); requireThat([...text].length >= 1, 422, 'Write a comment');
  requireThat(body.consent === 'public-attribution-v1', 422, 'Acknowledge public attribution before submitting');
  await checkRate(env, tag.subject);
  const id = uuid();
  let accepted;
  try {
    accepted = await commit(env, actor, input, "EXISTS (SELECT 1 FROM posts WHERE id=? AND state='published' AND deleted_at IS NULL) AND (SELECT COUNT(*) FROM rate_attempts WHERE tag=? AND created_at>?)<5 AND (SELECT COUNT(*) FROM rate_attempts WHERE tag=? AND created_at>?)<30", [postId, tag.subject, time - 600, tag.subject, time - 86400], { id }, (gate, execution) => [
      stmt(env, `INSERT INTO comments (id,post_id,created_at,subject,attribution,consent_version,consent_at,body) SELECT ?,?,?,?,?,?,?,? WHERE ${gate}`, id, postId, time, actor.subject, JSON.stringify(actor.attribution), body.consent, time, text, execution),
      stmt(env, `INSERT INTO rate_attempts (tag,created_at,id) SELECT ?,?,? WHERE ${gate}`, tag.subject, time, uuid(), execution)
    ], { admin: false });
  } catch (error) {
    if (error.status === 409) {
      await checkRate(env, tag.subject);
      requireThat(await first(env, "SELECT id FROM posts WHERE id=? AND state='published' AND deleted_at IS NULL", postId), 409, 'This post is no longer available');
    }
    throw error;
  }
  return publicComment(await first(env, 'SELECT * FROM comments WHERE id=?', accepted.id));
}
const reasons = ['abuse/harassment','identifying personal information','discriminatory language','spam','other'];
export async function moderateComment(env, actor, id, body, key) {
  requireThat(['hide','restore'].includes(body.action) && Number.isSafeInteger(body.version), 422, 'Invalid moderation action');
  let reason = null;
  if (body.action === 'hide') {
    requireThat(reasons.includes(body.reason), 422, 'Choose a moderation reason');
    bounded(body.explanation || '', 300, body.reason === 'other' ? 1 : 0);
    reason = `${body.reason}${body.explanation ? `: ${body.explanation}` : ''}`;
  }
  const time = now(), input = await operationInput(body.action, id, key, body);
  return commit(env, actor, input, 'EXISTS (SELECT 1 FROM comments c JOIN posts p ON c.post_id=p.id WHERE c.id=? AND c.version=? AND c.deleted_at IS NULL AND p.deleted_at IS NULL)', [id, body.version], { id, version: body.version + 1, status: body.action === 'hide' ? 'hidden' : 'visible' }, (gate, execution) => [
    stmt(env, `UPDATE comments SET hidden=?,version=version+1,reason=?,moderator=?,moderated_at=? WHERE id=? AND ${gate}`, body.action === 'hide' ? 1 : 0, reason, actor.subject, time, id, execution),
    stmt(env, `INSERT INTO audit (id,actor,target,action,reason,created_at) SELECT ?,?,?,?,?,? WHERE ${gate}`, uuid(), actor.subject, id, body.action, reason, time, execution)
  ], { journal: { id, hidden: body.action === 'hide', version: body.version + 1 } });
}
export async function inspectComment(env, actor, id) {
  const input = await operationInput('inspect-comment', id, uuid(), {});
  // The body read is in the SAME guarded transaction as the deliberate access audit.
  const guard = authority(actor), auditId = uuid(), time = now();
  await checkAuthority(env, actor);
  const result = await env.DB.batch([
    stmt(env, `INSERT INTO audit (id,actor,target,action,created_at) SELECT ?,?,?,?,? WHERE ${guard.sql}`, auditId, actor.subject, id, input.action, time, ...guard.values),
    stmt(env, 'SELECT c.* FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=? AND p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM audit WHERE id=?)', id, auditId)
  ]);
  const row = result[1].results[0]; requireThat(row, 404, 'Not found');
  return row.deleted_at !== null ? { id, version: row.version, status: 'deleted', message: 'Comment deleted' } : { id, version: row.version, body: row.body, attribution: JSON.parse(row.attribution), hidden: !!row.hidden, reason: row.reason };
}
export async function deleteComment(env, actor, id, key) {
  const input = await operationInput('delete-comment', id, key, {}), time = now();
  return commit(env, actor, input, 'EXISTS (SELECT 1 FROM comments WHERE id=? AND subject=? AND deleted_at IS NULL)', [id, actor.subject], { id, status: 'deleted', message: 'Comment deleted' }, (gate, execution) => [
    stmt(env, `UPDATE comments SET deleted_at=?,body=NULL,subject=NULL,attribution=NULL,consent_version=NULL,consent_at=NULL,reason=NULL,moderator=NULL,moderated_at=NULL,hidden=0,version=version+1 WHERE id=? AND ${gate}`, time, id, execution),
    stmt(env, `DELETE FROM audit WHERE target=? AND ${gate}`, id, execution)
  ], { admin: false, journal: { id, deletedAt: time } });
}
