import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { setup, example, key } from './helpers.mjs';
import { localImagesAdapter } from './images-adapter.mjs';
import { uploadImage } from '../src/media.mjs';
import { validateDocument } from '../src/document.mjs';
import { createPost, saveDraft, publish, withdraw, deliverMedia, first } from '../src/storage.mjs';
import { createBackup, restoreBackup } from '../src/backup.mjs';
import { requestErasure, maintenance, flushOutbox, journalHead } from '../src/recovery.mjs';

const options = { type:'image/png',sensitive:false,placeholder:'neutral',sharing:true,sharingConsent:'public-sharing-v1' };
const bytes = () => sharp({ create:{ width:1800,height:900,channels:3,background:'#43804c' } }).withMetadata({ exif:{ IFD0:{ Artist:'Private metadata' } } }).png().toBuffer();
const descriptor = asset => ({ assetId:asset.assetId,policyVersion:asset.policyVersion,alt:'Green common land',consent:'public-sharing-v1' });

test('sharing selection requires explicit consent, meaningful description and exact fields',()=>{
  const source=example(); validateDocument(source);
  source.sharingImage=descriptor({ assetId:crypto.randomUUID(),policyVersion:1 }); assert.equal(validateDocument(source).assets.length,1);
  for(const update of [{ consent:'' },{ alt:' ' },{ url:'https://example.test/private.png' },{ policyVersion:0 }]) assert.throws(()=>validateDocument({ ...source,sharingImage:{ ...source.sharingImage,...update } }),{ status:422 });
});

test('sharing image is a stripped crop, private until publication, revision gated, backed up and erased with its owner',async t=>{
  const { env,actor,mf }=await setup(t,true,{ BACKUP_RETENTION_CONFIRMED:'true',COMMENTS_ENABLED:'false' }); env.IMAGES=localImagesAdapter;
  const post=await createPost(env,actor,{ slug:'sharing',consent:'public-attribution-v1' },key());
  const input=await bytes();
  await assert.rejects(uploadImage(env,actor,post.id,input,{ ...options,sharingConsent:'' },key()),{ status:422 });
  const asset=await uploadImage(env,actor,post.id,input,options,key()),source={ ...example(),sharingImage:descriptor(asset) };
  const row=await first(env,'SELECT * FROM media WHERE id=?',asset.assetId),manifest=JSON.parse(row.manifest);
  const crop=Buffer.from(await (await env.CONTENT.get(manifest.share.key)).arrayBuffer()),info=await sharp(crop).metadata();
  assert.equal(info.width,1200);assert.equal(info.height,630);assert.doesNotMatch(crop.toString('latin1'),/Private metadata|eXIf/);
  const saved=await saveDraft(env,actor,post.id,{ version:0,source },key()),path=`/media/${post.id}/${saved.revision}/${asset.assetId}/share`;
  const fetch=(suffix,init)=>mf.dispatchFetch(`https://bca.wales${suffix}`,init);
  assert.equal((await fetch(path)).status,404);
  assert.equal((await fetch(`/preview/media/${post.id}/buffer/${asset.assetId}/share`)).status,401);
  assert.equal((await deliverMedia(env,new Request('https://bca.wales/preview'),[post.id,'buffer',asset.assetId,'share'],actor)).status,200);
  await publish(env,actor,post.id,{ version:1,revision:saved.revision },key());
  const html=await (await fetch('/blog/sharing/')).text();assert.ok(html.includes(`content="https://bca.wales${path}"`));assert.match(html,/og:image:alt" content="Green common land/);
  const payload=await (await fetch('/api/blog/posts/sharing')).json();assert.equal(payload.sharingImage.url,path);
  for(const method of ['GET','HEAD']) { const response=await fetch(path,{ method });assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);if(method==='HEAD')assert.equal(await response.text(),''); }
  for (const variant of ['original','display','1920','pixel']) assert.equal((await fetch(path.replace(/share$/,variant))).status,404);
  assert.equal((await fetch(path,{ headers:{ Range:'bytes=0-10' } })).status,416);
  const backup=await createBackup(env);
  const backupManifest=JSON.parse(await (await env.RECOVERY.get(backup.manifestKey)).text());
  assert.ok(backupManifest.objects.some(object=>object.key===manifest.share.key));
  assert.ok((await first(env,'SELECT assets FROM revisions WHERE id=?',saved.revision)).assets.includes(asset.assetId));
  const replacement=await saveDraft(env,actor,post.id,{ version:2,source:example() },key());
  assert.equal((await fetch(path)).status,200); // A saved private correction cannot change public sharing.
  await publish(env,actor,post.id,{ version:3,revision:replacement.revision },key());assert.equal((await fetch(path)).status,404);
  assert.match(await (await fetch('/blog/sharing/')).text(),/og:image" content="https:\/\/bca.wales\/static\/share.png/);
  const again=await saveDraft(env,actor,post.id,{ version:4,source },key());await publish(env,actor,post.id,{ version:5,revision:again.revision },key());
  const active=[post.id,again.revision,asset.assetId,'share'];
  // Withdrawal while R2 is being read must fail closed too.
  const racing={ ...env,CONTENT:{ get:async objectKey=>{ const object=await env.CONTENT.get(objectKey);if(objectKey===manifest.share.key)await withdraw(env,actor,post.id,{ version:6 },key());return object; } } };
  await assert.rejects(deliverMedia(racing,new Request('https://bca.wales/media'),active),{ status:404 });
  await requestErasure(env,actor.subject);await maintenance(env);
  assert.equal(await first(env,'SELECT * FROM media WHERE id=?',asset.assetId),null);assert.equal(await env.CONTENT.get(manifest.share.key),null);
  await flushOutbox(env);const head=await journalHead(env);
  const { env:restored }=await setup(t,false,{ RESTRICTED:'true',BACKUP_RETENTION_CONFIRMED:'true' });restored.RECOVERY=env.RECOVERY;
  await restoreBackup(restored,{ ...backup,expectedJournalSequence:head.sequence,journalComplete:true });
  await maintenance(restored);assert.equal(await restored.CONTENT.get(manifest.share.key),null);
  assert.equal(await first(restored,'SELECT * FROM administrators'),null);
});

test('foreign, sensitive, mismatched and damaged sharing assets fail closed',async t=>{
  const { env,actor }=await setup(t);env.IMAGES=localImagesAdapter;
  const post=await createPost(env,actor,{ slug:'policy',consent:'public-attribution-v1' },key()),other=await createPost(env,actor,{ slug:'other',consent:'public-attribution-v1' },key());
  const asset=await uploadImage(env,actor,post.id,await bytes(),options,key()),source={ ...example(),sharingImage:descriptor(asset) };
  await assert.rejects(saveDraft(env,actor,other.id,{ version:0,source },key()),{ status:422 });
  await assert.rejects(saveDraft(env,actor,post.id,{ version:0,source:{ ...source,sharingImage:{ ...source.sharingImage,policyVersion:2 } } },key()),{ status:422 });
  const sensitive={ ...source,doc:{ type:'doc',content:[{ type:'image',attrs:{ version:1,assetId:asset.assetId,policyVersion:1,sensitive:true,warning:'Sensitive scene',alt:'Description',decorative:false,caption:'',credit:'' } }] } };
  await assert.rejects(saveDraft(env,actor,post.id,{ version:0,source:sensitive },key()),{ status:422 });
  await env.DB.prepare('UPDATE media SET sensitive=1 WHERE id=?').bind(asset.assetId).run();await assert.rejects(saveDraft(env,actor,post.id,{ version:0,source },key()),{ status:422 });
  await env.DB.prepare('UPDATE media SET sensitive=0 WHERE id=?').bind(asset.assetId).run();
  const saved=await saveDraft(env,actor,post.id,{ version:0,source },key());await publish(env,actor,post.id,{ version:1,revision:saved.revision },key());
  const manifest=JSON.parse((await first(env,'SELECT manifest FROM media WHERE id=?',asset.assetId)).manifest);await env.CONTENT.put(manifest.share.key,'corrupt');
  await assert.rejects(deliverMedia(env,new Request('https://bca.wales/media'),[post.id,saved.revision,asset.assetId,'share']),{ status:503 });
});

test('sharing upload endpoint requires approved administrator, CSRF and public-sharing consent',async t=>{
  const { authConfig }=await import('./helpers.mjs'),{ issueSession,csrfToken }=await import('../src/auth.mjs'),{ default:worker }=await import('../src/worker.mjs');
  const { env,actor }=await setup(t,false,authConfig());env.IMAGES=localImagesAdapter;
  const post=await createPost(env,actor,{slug:'upload-auth',consent:'public-attribution-v1'},key());
  const issued=await issueSession(env,{id:'987',name:'Local test author'},Math.floor(Date.now()/1000)+600);
  const headers={Origin:env.ORIGIN,Cookie:`__Host-bca-session=${issued.token}`,'X-CSRF-Token':await csrfToken(env,issued.actor),'Content-Type':'image/png','Idempotency-Key':key(),'X-Sharing-Consent':'public-sharing-v1'};
  const input=await bytes(),upload=h=>worker.fetch(new Request(`${env.ORIGIN}/api/admin/posts/${post.id}/sharing-image`,{method:'POST',headers:h,body:input}),env);
  assert.equal((await upload({...headers,Cookie:''})).status,401);assert.equal((await upload(headers)).status,403);
  await env.DB.prepare('INSERT INTO administrators VALUES (?,?)').bind(issued.actor.subject,Math.floor(Date.now()/1000)).run();
  assert.equal((await upload({...headers,'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await upload({...headers,'X-Sharing-Consent':''})).status,422);
  const response=await upload(headers);assert.equal(response.status,201);assert.equal((await response.json()).sensitive,false);
});
