import { base64url } from 'jose';
import { digest, now, requireThat, uuid } from './errors.mjs';
import { first, rows, stmt } from './storage.mjs';
import { hmac } from './auth.mjs';

export const journalKey = sequence => `journal/${String(sequence).padStart(16,'0')}.json`;
export async function journalHead(env) {
  const object=await env.RECOVERY.get('journal-head.json');
  return object ? { ...(await object.json()),etag:object.etag } : { sequence:0,etag:null };
}
export async function flushOutbox(env) {
  const pending=await rows(env,'SELECT * FROM recovery_outbox WHERE delivered_at IS NULL ORDER BY sequence LIMIT 100');
  for(const entry of pending) {
    const value=JSON.stringify({ sequence:entry.sequence,id:entry.id,action:entry.action,target:entry.target,payload:JSON.parse(entry.payload),createdAt:entry.created_at });
    const hash=await digest(value),key=journalKey(entry.sequence);
    await env.RECOVERY.put(key,value,{ customMetadata:{ sha256:hash,expiresAt:String(entry.created_at+37*86400) } });
    const stored=await env.RECOVERY.get(key);requireThat(stored&&await digest(await stored.arrayBuffer())===hash,503,'Recovery receipt pending. Please retry.');
    await stmt(env,'UPDATE recovery_outbox SET delivered_at=? WHERE id=?',now(),entry.id).run();
  }
  // Advance only through contiguous verified receipts; concurrent writers cannot
  // regress the independent high-water mark or skip a missing journal object.
  for(let i=0;i<200;i++) {
    const head=await journalHead(env),next=await env.RECOVERY.get(journalKey(head.sequence+1));if(!next) break;
    const bytes=await next.arrayBuffer();requireThat(await digest(bytes)===next.customMetadata.sha256,503,'Recovery journal integrity failure');
    const entry=JSON.parse(new TextDecoder().decode(bytes));requireThat(entry.sequence===head.sequence+1,503,'Recovery journal gap');
    const updated=await env.RECOVERY.put('journal-head.json',JSON.stringify({ sequence:entry.sequence,hash:await digest(bytes) }),{ onlyIf:head.etag?{ etagMatches:head.etag }:{ etagDoesNotMatch:'*' } });
    if(!updated) continue;
  }
  const verifiedHead=await journalHead(env);
  await stmt(env,"INSERT INTO settings VALUES ('journal_sequence',?) ON CONFLICT(key) DO UPDATE SET value=CAST(MAX(CAST(value AS INTEGER),CAST(excluded.value AS INTEGER)) AS TEXT)",String(verifiedHead.sequence)).run();
  const last=await first(env,'SELECT COALESCE(MAX(sequence),0) AS sequence FROM recovery_outbox');
  requireThat((await journalHead(env)).sequence>=last.sequence&&!await first(env,'SELECT 1 FROM recovery_outbox WHERE delivered_at IS NULL LIMIT 1'),503,'Recovery receipts pending. Please retry.');
}
export async function requestErasure(env, subject, requestKey = subject) {
  const key=await digest(requestKey);
  const receipt=await first(env,'SELECT job_id FROM deletion_requests WHERE key=?',key);
  if(receipt) { await flushOutbox(env);return { id:receipt.job_id }; }
  const existing=await first(env,"SELECT id FROM deletion_jobs WHERE subject=? AND status!='complete'",subject);
  if(existing) {
    await stmt(env,'INSERT OR IGNORE INTO deletion_requests VALUES (?,?,?)',key,existing.id,now()+37*86400).run();await flushOutbox(env);return { id:existing.id };
  }
  const id=base64url.encode(crypto.getRandomValues(new Uint8Array(32))),time=now();
  try {
    await env.DB.batch([
      stmt(env,"INSERT INTO deletion_jobs (id,subject,status,created_at,expires_at) VALUES (?,?,'pending',?,?)",id,subject,time,time+37*86400),
      stmt(env,'INSERT INTO deletion_requests VALUES (?,?,?)',key,id,time+37*86400),
      stmt(env,"INSERT INTO revocations VALUES ('subject',?,?,?) ON CONFLICT(kind,key) DO UPDATE SET cutoff=MAX(cutoff,excluded.cutoff),expires_at=MAX(expires_at,excluded.expires_at)",subject,time,time+28800),
      stmt(env,'DELETE FROM administrators WHERE subject=?',subject),
      stmt(env,"UPDATE posts SET public_revision=NULL,public_metadata=NULL,state='draft',version=version+1,deleted_at=CASE WHEN creator=? THEN ? ELSE deleted_at END WHERE creator=? OR id IN (SELECT post_id FROM media WHERE owner=?)",subject,time,subject,subject),
      stmt(env,'DELETE FROM audit WHERE target IN (SELECT id FROM comments WHERE subject=?)',subject),
      stmt(env,'UPDATE comments SET body=NULL,subject=NULL,attribution=NULL,consent_at=NULL,consent_version=NULL,reason=NULL,moderator=NULL,moderated_at=NULL,hidden=0,deleted_at=?,version=version+1 WHERE subject=?',time,subject),
      stmt(env,'INSERT INTO recovery_outbox (id,action,target,payload,created_at) VALUES (?,?,?,?,?)',uuid(),'erase-subject',id,JSON.stringify({ subject,cutoff:time,expiresAt:time+37*86400 }),time)
    ]);
  } catch(error) {
    const retry=await first(env,'SELECT job_id FROM deletion_requests WHERE key=?',key);if(!retry) throw error;
    await flushOutbox(env);return { id:retry.job_id };
  }
  await flushOutbox(env);return { id };
}
async function removePrefix(bucket, prefix) {
  // A bounded batch is resumable by listing the remaining prefix on the next run.
  const listed = await bucket.list({ prefix, limit: 100 });
  if (listed.objects.length) await bucket.delete(listed.objects.map(o => o.key));
  return !listed.truncated;
}
export async function cleanupPost(env, post) {
  requireThat(post.deleted_at !== null, 409, 'Post must be fenced before cleanup');
  if (await first(env, 'SELECT id FROM staging WHERE post_id=? LIMIT 1', post.id)) return false;
  const media = await rows(env, 'SELECT id FROM media WHERE post_id=?', post.id);
  let done = await removePrefix(env.CONTENT, `posts/${post.id}/`);
  for (const item of media) done = await removePrefix(env.CONTENT, `media/${item.id}/`) && done;
  if (!done) return false;
  await env.DB.batch([
    stmt(env, 'DELETE FROM comments WHERE post_id=?', post.id),
    stmt(env, 'DELETE FROM revisions WHERE post_id=?', post.id),
    stmt(env, 'DELETE FROM media WHERE post_id=?', post.id),
    stmt(env, "DELETE FROM operations WHERE target=? AND action!='delete-post'", post.id),
    stmt(env, 'DELETE FROM audit WHERE target=?', post.id),
    stmt(env, 'UPDATE posts SET creator=NULL,attribution=NULL,consent_version=NULL,consent_at=NULL,last_editor=NULL,draft_revision=NULL WHERE id=? AND deleted_at IS NOT NULL', post.id)
  ]);
  return true;
}
export async function runErasure(env, job) {
  const subject = job.subject; if (!subject) return;
  if (await first(env, 'SELECT id FROM staging WHERE actor=? OR post_id IN (SELECT id FROM posts WHERE creator=?) OR post_id IN (SELECT post_id FROM media WHERE owner=?) LIMIT 1', subject, subject, subject)) return;
  let done = true;
  for (const post of await rows(env, 'SELECT * FROM posts WHERE creator=?', subject)) done = await cleanupPost(env, post) && done;
  for (const asset of await rows(env, 'SELECT * FROM media WHERE owner=?', subject)) {
    const removed = await removePrefix(env.CONTENT, `media/${asset.id}/`); done = removed && done;
    if (removed) await stmt(env, 'DELETE FROM media WHERE id=?', asset.id).run();
  }
  await env.DB.batch([
    stmt(env, 'DELETE FROM operations WHERE actor=?', subject),
    stmt(env, 'DELETE FROM audit WHERE actor=?', subject),
    stmt(env, 'UPDATE posts SET last_editor=NULL WHERE last_editor=?', subject),
    stmt(env, 'UPDATE revisions SET editor=NULL WHERE editor=?', subject),
    stmt(env, 'UPDATE comments SET moderator=NULL,reason=NULL WHERE moderator=?', subject)
  ]);
  if (env.RATE_KEY) await stmt(env, 'DELETE FROM rate_attempts WHERE tag=?', `subject:${base64url.encode(await hmac(env.RATE_KEY, subject))}`).run();
  await flushOutbox(env);
  if (done && env.BACKUP_RETENTION_CONFIRMED === 'true') await stmt(env, "UPDATE deletion_jobs SET status='complete',cursor=NULL WHERE id=?", job.id).run();
}
export async function maintenance(env) {
  await flushOutbox(env); // Never purge recovery state before durable delivery.
  for (const job of await rows(env, "SELECT * FROM deletion_jobs WHERE status!='complete' ORDER BY created_at LIMIT 20")) await runErasure(env, job);
  for (const post of await rows(env, 'SELECT * FROM posts WHERE deleted_at IS NOT NULL AND draft_revision IS NOT NULL LIMIT 20')) await cleanupPost(env, post);
  const time = now();
  await env.DB.batch([
    stmt(env, 'DELETE FROM oauth_transactions WHERE expires_at<=?', time),
    stmt(env, 'DELETE FROM revocations WHERE expires_at<=?', time),
    stmt(env, 'DELETE FROM operations WHERE expires_at<=?', time),
    stmt(env, 'DELETE FROM rate_attempts WHERE created_at<=?', time - 86400),
    stmt(env, 'DELETE FROM audit WHERE created_at<=?', time - 90 * 86400),
    stmt(env, 'DELETE FROM recovery_outbox WHERE delivered_at IS NOT NULL AND created_at<=?', time - 37 * 86400),
    stmt(env, "DELETE FROM deletion_jobs WHERE status='complete' AND expires_at<=?", time),
    stmt(env, 'DELETE FROM deletion_requests WHERE expires_at<=?', time)
  ]);
  const journals = await env.RECOVERY.list({ prefix: 'journal/', limit: 1000,include:['customMetadata'] });
  const expired = journals.objects.filter(o => Number(o.customMetadata?.expiresAt || Infinity) <= time).map(o => o.key);
  if (expired.length) await env.RECOVERY.delete(expired);
  // Old noncurrent sources expire, but current draft/public sources remain authoritative.
  const revisions = await rows(env, 'SELECT r.* FROM revisions r JOIN posts p ON p.id=r.post_id WHERE r.created_at<? AND r.id!=COALESCE(p.draft_revision,\'\') AND r.id!=COALESCE(p.public_revision,\'\') LIMIT 100', time - 30 * 86400);
  for (const r of revisions) {
    // Rollback never installs old pointers: it saves retained source as a NEW revision.
    if (await removePrefix(env.CONTENT, `posts/${r.post_id}/${r.id}/`)) await stmt(env, 'DELETE FROM revisions WHERE id=? AND id NOT IN (SELECT draft_revision FROM posts WHERE draft_revision IS NOT NULL) AND id NOT IN (SELECT public_revision FROM posts WHERE public_revision IS NOT NULL)', r.id).run();
  }
  await cleanupOrphans(env);
  return { pendingDeletion: (await first(env, "SELECT COUNT(*) AS n FROM deletion_jobs WHERE status!='complete'")).n };
}

export async function cleanupOrphans(env) {
  const time = now();
  const unused = await rows(env, `SELECT m.* FROM media m WHERE m.created_at<? AND NOT EXISTS (SELECT 1 FROM revisions r,json_each(r.assets) a WHERE a.value=m.id) AND NOT EXISTS (SELECT 1 FROM staging s WHERE s.post_id=m.post_id) LIMIT 30`, time - 86400);
  for (const media of unused) {
    const deleted = await stmt(env, `DELETE FROM media WHERE id=? AND NOT EXISTS (SELECT 1 FROM revisions r,json_each(r.assets) a WHERE a.value=media.id) AND NOT EXISTS (SELECT 1 FROM staging s WHERE s.post_id=media.post_id) RETURNING id`, media.id).first();
    if (deleted) await removePrefix(env.CONTENT, `media/${media.id}/`);
  }
  const cursor = (await first(env, "SELECT value FROM settings WHERE key='cleanup_cursor'"))?.value;
  const page = await env.CONTENT.list({ limit: 100, include:['customMetadata'], ...(cursor ? { cursor } : {}) });
  for (const object of page.objects) {
    if (object.uploaded.getTime() > (time - 86400) * 1000) continue;
    const parts = object.key.split('/');
    if (parts[0] === 'posts') {
      if (await first(env, 'SELECT 1 FROM staging WHERE post_id=?', parts[1])) continue;
      if (await first(env, 'SELECT 1 FROM revisions WHERE source_key=? OR manifest_key=?', object.key, object.key)) continue;
    } else if (parts[0] === 'media') {
      if (object.customMetadata?.postId && await first(env, 'SELECT 1 FROM staging WHERE post_id=?', object.customMetadata.postId)) continue;
      if (await first(env, 'SELECT 1 FROM media WHERE id=?', parts[1])) continue;
    } else continue;
    await env.CONTENT.delete(object.key);
  }
  await stmt(env, "INSERT INTO settings VALUES ('cleanup_cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", page.truncated ? page.cursor : '').run();
}
