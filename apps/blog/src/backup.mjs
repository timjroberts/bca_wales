import { digest, now, requireThat, uuid } from './errors.mjs';
import { stmt } from './storage.mjs';
import { flushOutbox, journalHead, journalKey } from './recovery.mjs';
export const BACKUP_TABLES=['administrators','revocations','oauth_transactions','deletion_jobs','posts','slugs','revisions','media','operations','comments','rate_attempts','audit','recovery_outbox','settings','staging','deletion_requests'];
export async function createBackup(env) {
  await flushOutbox(env);
  const startedAt=now(),id=`${startedAt}-${uuid()}`,prefix=`backups/${id}/`;
  const result=await env.DB.batch(BACKUP_TABLES.map(table=>stmt(env,`SELECT * FROM ${table} LIMIT 100001`)));
  const database=Object.fromEntries(BACKUP_TABLES.map((table,i)=>[table,result[i].results]));
  requireThat(Object.values(database).every(table=>table.length<=100000),503,'Backup row limit reached; operator action required');
  const databaseBytes=new TextEncoder().encode(JSON.stringify(database));requireThat(databaseBytes.length<=20*1024*1024,503,'Backup size limit reached; operator action required');
  const references=new Map();
  for(const revision of database.revisions) { references.set(revision.source_key,revision.source_hash);if(revision.manifest_key) references.set(revision.manifest_key,revision.manifest_hash); }
  for(const media of database.media.filter(row=>row.ready===1)) { for(const variant of Object.values(JSON.parse(media.manifest))) references.set(variant.key,variant.hash);references.set(`media/${media.id}/original`,null); }
  const objects=[];
  for(const [key,expected] of references) {
    const object=await env.CONTENT.get(key);requireThat(object,503,'Backup references a missing object');
    const bytes=await object.arrayBuffer(),hash=await digest(bytes);requireThat(!expected||expected===hash,503,'Backup source checksum failed');
    const backupKey=`${prefix}objects/${key}`;
    await env.RECOVERY.put(backupKey,bytes,{ customMetadata:{ sha256:hash,expiresAt:String(startedAt+30*86400) } });
    const copy=await env.RECOVERY.get(backupKey);requireThat(copy&&await digest(await copy.arrayBuffer())===hash,503,'Backup copy verification failed');
    objects.push({ key,backupKey,hash,size:bytes.byteLength });
  }
  const databaseHash=await digest(databaseBytes),databaseKey=`${prefix}database.json`;
  await env.RECOVERY.put(databaseKey,databaseBytes,{ customMetadata:{ sha256:databaseHash,expiresAt:String(startedAt+30*86400) } });
  requireThat(await digest(await (await env.RECOVERY.get(databaseKey)).arrayBuffer())===databaseHash,503,'Backup database verification failed');
  const lastSequence=Math.max(Number(database.settings.find(row=>row.key==='journal_sequence')?.value||0),Number(database.settings.find(row=>row.key==='reconciled_sequence')?.value||0),...database.recovery_outbox.map(row=>row.sequence));
  await flushOutbox(env);
  const manifest={ schemaVersion:1,id,startedAt,expiresAt:startedAt+30*86400,lastSequence,databaseKey,databaseHash,objects };
  const value=JSON.stringify(manifest),hash=await digest(value),manifestKey=`${prefix}manifest.json`;
  await env.RECOVERY.put(manifestKey,value,{ customMetadata:{ sha256:hash,expiresAt:String(manifest.expiresAt) } });
  await checked(env.RECOVERY,manifestKey,hash);
  await env.RECOVERY.put('backup-latest.json',JSON.stringify({ manifestKey,hash,completedAt:now() }));
  await stmt(env,"INSERT INTO settings VALUES ('last_backup',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String(startedAt)).run();
  return { manifestKey,hash,objects:objects.length,databaseBytes:databaseBytes.length };
}
async function checked(bucket,key,hash) {
  const object=await bucket.get(key);requireThat(object,503,'Recovery object missing');const bytes=await object.arrayBuffer();requireThat(await digest(bytes)===hash,503,'Recovery checksum mismatch');return bytes;
}
export async function replayEvent(env,entry) {
  const p=entry.payload;
  if(entry.action==='hide'||entry.action==='restore') {
    await stmt(env,'UPDATE comments SET hidden=?,version=MAX(version,?),reason=NULL,moderator=NULL WHERE id=? AND version<=? AND deleted_at IS NULL',p.hidden?1:0,p.version,p.id,p.version).run();
  } else if(entry.action==='delete-comment') {
    await stmt(env,'UPDATE comments SET deleted_at=?,body=NULL,subject=NULL,attribution=NULL,consent_at=NULL,consent_version=NULL,reason=NULL,moderator=NULL,moderated_at=NULL,hidden=0,version=version+1 WHERE id=? AND deleted_at IS NULL',p.deletedAt,p.id).run();
    await stmt(env,'DELETE FROM audit WHERE target=?',p.id).run();
  } else if(entry.action==='unpublish'||entry.action==='delete-post') {
    await stmt(env,"UPDATE posts SET state='draft',public_revision=NULL,public_metadata=NULL,version=MAX(version,?),deleted_at=CASE WHEN ? THEN ? ELSE deleted_at END WHERE id=? AND (version<=? OR ?)",p.version,p.deleted?1:0,entry.createdAt,p.id,p.version,p.deleted?1:0).run();
  } else if(entry.action==='revoke-session') {
    await stmt(env,"INSERT INTO revocations VALUES ('session',?,?,?) ON CONFLICT(kind,key) DO UPDATE SET expires_at=MAX(expires_at,excluded.expires_at)",p.sid,p.cutoff,p.expiresAt).run();
  } else if(entry.action==='remove-admin') {
    await stmt(env,'DELETE FROM administrators WHERE subject=?',p.subject).run();
  } else if(entry.action==='erase-subject') {
    await env.DB.batch([
      stmt(env,'DELETE FROM administrators WHERE subject=?',p.subject),
      stmt(env,"INSERT INTO revocations VALUES ('subject',?,?,?) ON CONFLICT(kind,key) DO UPDATE SET cutoff=MAX(cutoff,excluded.cutoff),expires_at=MAX(expires_at,excluded.expires_at)",p.subject,p.cutoff,p.cutoff+28800),
      stmt(env,"UPDATE posts SET state='draft',public_revision=NULL,public_metadata=NULL,deleted_at=CASE WHEN creator=? THEN ? ELSE deleted_at END,version=version+1 WHERE (creator=? AND created_at<=?) OR id IN (SELECT post_id FROM media WHERE owner=? AND created_at<=?)",p.subject,p.cutoff,p.subject,p.cutoff,p.subject,p.cutoff),
      stmt(env,'DELETE FROM audit WHERE actor=? OR target IN (SELECT id FROM comments WHERE subject=? AND created_at<=?)',p.subject,p.subject,p.cutoff),
      stmt(env,'UPDATE comments SET deleted_at=?,body=NULL,subject=NULL,attribution=NULL,consent_at=NULL,consent_version=NULL,reason=NULL,moderator=NULL,moderated_at=NULL,hidden=0,version=version+1 WHERE subject=? AND created_at<=?',p.cutoff,p.subject,p.cutoff),
      stmt(env,'DELETE FROM operations WHERE actor=?',p.subject),
      stmt(env,'UPDATE posts SET last_editor=NULL WHERE last_editor=?',p.subject),
      stmt(env,'UPDATE revisions SET editor=NULL WHERE editor=?',p.subject),
      stmt(env,"INSERT INTO deletion_jobs (id,subject,status,created_at,expires_at) VALUES (?,?,'pending',?,?) ON CONFLICT(id) DO UPDATE SET status='pending'",entry.target,p.subject,p.cutoff,p.expiresAt)
    ]);
  } else throw new Error('Unknown recovery action; keep restore restricted');
}
export async function restoreBackup(env,{ manifestKey,hash,expectedJournalSequence,journalComplete }) {
  requireThat(env.RESTRICTED==='true'&&journalComplete===true&&Number.isSafeInteger(expectedJournalSequence),409,'Restore requires restricted mode and independently confirmed journal completeness');
  const manifest=JSON.parse(new TextDecoder().decode(await checked(env.RECOVERY,manifestKey,hash)));
  requireThat(manifest.schemaVersion===1&&manifest.expiresAt>now(),409,'Backup is expired or incompatible');
  const head=await journalHead(env);requireThat(head.sequence===expectedJournalSequence&&head.sequence>=manifest.lastSequence,409,'Independent journal high-water mark does not match');
  const events=[];
  for(let sequence=manifest.lastSequence+1;sequence<=head.sequence;sequence++) {
    const object=await env.RECOVERY.get(journalKey(sequence));requireThat(object,409,'Independent recovery journal gap');
    const bytes=await object.arrayBuffer();requireThat(await digest(bytes)===object.customMetadata.sha256,409,'Independent recovery journal corruption');
    const entry=JSON.parse(new TextDecoder().decode(bytes));requireThat(entry.sequence===sequence,409,'Independent recovery journal order mismatch');events.push(entry);
  }
  const database=JSON.parse(new TextDecoder().decode(await checked(env.RECOVERY,manifest.databaseKey,manifest.databaseHash)));
  requireThat(BACKUP_TABLES.every(table=>Array.isArray(database[table])),409,'Backup schema mismatch');
  // Verify every paired object before replacing any authoritative data.
  for(const object of manifest.objects) await checked(env.RECOVERY,object.backupKey,object.hash);
  await stmt(env,"UPDATE settings SET value='true' WHERE key='restricted'").run();
  for(const table of [...BACKUP_TABLES].reverse()) await stmt(env,`DELETE FROM ${table}`).run();
  // RESTRICTED must also be set in the Worker environment; no transient settings
  // row (including an imported historical one) is allowed to reopen service.
  for(const table of BACKUP_TABLES) {
    for(let offset=0;offset<database[table].length;offset+=50) {
      await env.DB.batch(database[table].slice(offset,offset+50).map(row=>{
        const columns=Object.keys(row);requireThat(columns.every(c=>/^[a-z_]+$/.test(c)),409,'Unexpected backup column');
        return stmt(env,`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,...columns.map(c=>row[c]));
      }));
    }
  }
  await stmt(env,"INSERT INTO settings VALUES ('restricted','true') ON CONFLICT(key) DO UPDATE SET value='true'").run();
  for(const object of manifest.objects) {
    const bytes=await checked(env.RECOVERY,object.backupKey,object.hash);
    await env.CONTENT.put(object.key,bytes,{ customMetadata:{ sha256:object.hash } });
  }
  for(const entry of events) await replayEvent(env,entry);
  await stmt(env,'DELETE FROM administrators').run(); // Independent reapproval, never historical authority.
  // Account for journaled actions absent from the older D1 snapshot so the next
  // outbox receipt cannot reuse an existing independent sequence number.
  await stmt(env,"INSERT INTO sqlite_sequence (name,seq) SELECT 'recovery_outbox',? WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name='recovery_outbox')",head.sequence).run();
  await stmt(env,"UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name='recovery_outbox'",head.sequence).run();
  await stmt(env,"INSERT INTO settings VALUES ('reconciled_sequence',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String(head.sequence)).run();
  requireThat((await journalHead(env)).sequence===head.sequence,409,'Journal changed during restore; reconcile again');
  return { restricted:true,replayed:events.length,objects:manifest.objects.length,requires:'Retire session keys, reconcile erasure/unfinished staging, reapprove administrators and validate before reopening.' };
}
export async function expireBackups(env) {
  const page=await env.RECOVERY.list({ prefix:'backups/',limit:1000 });
  const expired=page.objects.filter(o=>Number(o.key.split('/')[1].split('-')[0])+30*86400<=now()).map(o=>o.key);
  if(expired.length) await env.RECOVERY.delete(expired);
}
