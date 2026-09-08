#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { S3Client,GetObjectCommand,PutObjectCommand,HeadObjectCommand,ListObjectsV2Command,DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createBackup,restoreBackup } from '../src/backup.mjs';
import { flushOutbox,journalHead,maintenance } from '../src/recovery.mjs';
import { first,stmt } from '../src/storage.mjs';
import { now,requireThat,uuid } from '../src/errors.mjs';
export function remoteEnvironment(config,secrets=process.env,fetcher=fetch) {
  requireThat(/^[a-f0-9]{32}$/.test(config.accountId)&&/^[a-f0-9-]{36}$/.test(config.databaseId),400,'Configure isolated blog account/database identifiers');
  requireThat(/^bca-wales-blog-[a-z-]+$/.test(config.contentBucket)&&/^bca-wales-blog-[a-z-]+$/.test(config.recoveryBucket)&&config.contentBucket!==config.recoveryBucket,400,'Only dedicated blog buckets are permitted');
  requireThat(['staging','production','recovery'].includes(config.environment),400,'Explicit environment required');
  requireThat(secrets.BCA_BLOG_D1_TOKEN,400,'Set the scoped BCA_BLOG_D1_TOKEN');
  const endpoint=`https://${config.accountId}${config.jurisdiction==='eu'?'.eu':''}.r2.cloudflarestorage.com`;
  const s3=new S3Client({ region:'auto',endpoint,credentials:{ accessKeyId:secrets.BCA_BLOG_R2_ACCESS_KEY_ID||'',secretAccessKey:secrets.BCA_BLOG_R2_SECRET_ACCESS_KEY||'' },requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED' });
  const query=async queries=>{
    const response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,{ method:'POST',headers:{ Authorization:`Bearer ${secrets.BCA_BLOG_D1_TOKEN}`,'Content-Type':'application/json' },body:JSON.stringify(queries),signal:AbortSignal.timeout(60000) });
    requireThat(response.ok,503,`D1 operator request failed (${response.status})`);const data=await response.json();requireThat(data.success&&Array.isArray(data.result),503,'D1 operator query failed');return data.result;
  };
  const DB={ prepare(sql) { const item={ sql,params:[],bind(...params){ return { ...this,params }; },async first(){ return (await query({ sql:this.sql,params:this.params }))[0].results[0]||null; },async all(){ return (await query({ sql:this.sql,params:this.params }))[0]; },async run(){ return this.all(); } };return item; },async batch(items){ return query(items.map(item=>({ sql:item.sql,params:item.params }))); } };
  const bucket=name=>({
    async get(key) {
      try { const object=await s3.send(new GetObjectCommand({ Bucket:name,Key:key })),bytes=await object.Body.transformToByteArray();return { etag:object.ETag,size:bytes.length,customMetadata:{ ...object.Metadata,expiresAt:object.Metadata?.expiresat||object.Metadata?.expiresAt },arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),json:async()=>JSON.parse(new TextDecoder().decode(bytes)) }; }
      catch(error){ if(error.$metadata?.httpStatusCode===404) return null;throw new Error('R2 operator read failed'); }
    },
    async put(key,body,options={}) {
      try { const result=await s3.send(new PutObjectCommand({ Bucket:name,Key:key,Body:typeof body==='string'?body:new Uint8Array(body),Metadata:options.customMetadata,ContentType:options.httpMetadata?.contentType,...(options.onlyIf?.etagMatches?{ IfMatch:options.onlyIf.etagMatches }:{}),...(options.onlyIf?.etagDoesNotMatch?{ IfNoneMatch:options.onlyIf.etagDoesNotMatch }:{}) }));return { etag:result.ETag }; }
      catch(error){ if(error.$metadata?.httpStatusCode===412) return null;throw new Error('R2 operator write failed'); }
    },
    async delete(keys) { const result = await s3.send(new DeleteObjectsCommand({ Bucket:name,Delete:{ Objects:(Array.isArray(keys)?keys:[keys]).map(Key=>({ Key })) } })); requireThat(!result.Errors?.length,503,'R2 deletion incomplete'); },
    async list(options={}) {
      const result=await s3.send(new ListObjectsV2Command({ Bucket:name,Prefix:options.prefix,MaxKeys:options.limit||100,ContinuationToken:options.cursor||undefined }));
      const objects=[];
      for(const object of result.Contents||[]) { let customMetadata={};if(options.include?.includes('customMetadata')) { const head=await s3.send(new HeadObjectCommand({ Bucket:name,Key:object.Key }));customMetadata={ ...head.Metadata,expiresAt:head.Metadata?.expiresat }; }objects.push({ key:object.Key,size:object.Size,uploaded:object.LastModified,customMetadata }); }
      return { objects,truncated:!!result.IsTruncated,cursor:result.NextContinuationToken };
    }
  });
  return { DB,CONTENT:bucket(config.contentBucket),RECOVERY:bucket(config.recoveryBucket),RESTRICTED:config.restricted?'true':'false',BACKUP_RETENTION_CONFIRMED:config.backupRetentionConfirmed?'true':'false',RATE_KEY:secrets.BCA_BLOG_RATE_KEY };
}
async function main() {
  const [command,configPath,...args]=process.argv.slice(2);
  if(command==='help'||!command) { console.log('operator.mjs <status|grant-admin|remove-admin|pause|resume|restrict|clear-staging|backup|maintenance|restore> CONFIG.json --remote [arguments]');return; }
  requireThat(args.includes('--remote'),400,'Remote operations require --remote and explicit environment configuration');
  const config=JSON.parse(await readFile(configPath,'utf8')),env=remoteEnvironment(config),values=args.filter(a=>a!=='--remote');
  if(command==='status') { console.log(JSON.stringify({ environment:config.environment,administrators:(await first(env,'SELECT COUNT(*) AS n FROM administrators')).n,pendingErasure:(await first(env,"SELECT COUNT(*) AS n FROM deletion_jobs WHERE status!='complete'")).n,pendingJournal:(await first(env,'SELECT COUNT(*) AS n FROM recovery_outbox WHERE delivered_at IS NULL')).n,staleStaging:(await first(env,'SELECT COUNT(*) AS n FROM staging WHERE expires_at<?',now())).n,lastBackup:Number((await first(env,"SELECT value FROM settings WHERE key='last_backup'"))?.value||0) },null,2));return; }
  if(command==='grant-admin'||command==='remove-admin') {
    const subject=values[0];requireThat(/^facebook:[0-9]{1,100}:[0-9]{1,100}$/.test(subject),400,'Use the private app-scoped identifier verified out of band');
    if(command==='grant-admin') { requireThat(!await first(env,"SELECT id FROM deletion_jobs WHERE subject=? AND status!='complete'",subject),409,'Erasure pending');await stmt(env,'INSERT OR IGNORE INTO administrators VALUES (?,?)',subject,now()).run(); }
    else { await env.DB.batch([stmt(env,'DELETE FROM administrators WHERE subject=?',subject),stmt(env,'INSERT INTO recovery_outbox (id,action,target,payload,created_at) VALUES (?,?,?,?,?)',uuid(),'remove-admin','administrator',JSON.stringify({ subject }),now())]);await flushOutbox(env); }
    console.log('Administrator configuration updated.');return;
  }
  if(['pause','resume','restrict'].includes(command)) { await stmt(env,'UPDATE settings SET value=? WHERE key=?',command==='resume'?'false':'true',command==='restrict'?'restricted':'publish_paused').run();console.log('Operator switch updated.');return; }
  if(command==='clear-staging') { requireThat(config.restricted===true&&values[1]==='WRITER-CONFIRMED-STOPPED',409,'Confirm restricted mode and terminated writer'); const result=await stmt(env,'DELETE FROM staging WHERE id=? AND expires_at<? RETURNING id',values[0],now()).first();requireThat(result,409,'No expired staging record matched');console.log('Expired staging fence removed after operator confirmation.');return; }
  if(command==='backup') { console.log(JSON.stringify(await createBackup(env)));return; }
  if(command==='maintenance') { console.log(JSON.stringify(await maintenance(env)));return; }
  if(command==='restore') {
    requireThat(config.environment==='recovery'&&config.restricted===true&&values[3]==='JOURNAL-COMPLETE-AND-WORKER-RESTRICTED',409,'Use a separate restricted recovery environment and reconcile the independent journal first');
    console.log(JSON.stringify(await restoreBackup(env,{ manifestKey:values[0],hash:values[1],expectedJournalSequence:Number(values[2]),journalComplete:true }),null,2));return;
  }
  if(command==='journal-head') { console.log(JSON.stringify(await journalHead(env)));return; }
  throw new Error('Unknown operator command');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{ console.error(error.status?error.message:'Operator action failed; inspect scoped credentials and service health. No private provider/storage error is printed.');process.exitCode=1; });
