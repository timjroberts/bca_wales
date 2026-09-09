import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { setup, authConfig, key, example } from './helpers.mjs';
import { issueSession } from '../src/auth.mjs';
import { now } from '../src/errors.mjs';
import { createPost,saveDraft,publish,first } from '../src/storage.mjs';
import { writeFile } from 'node:fs/promises';

test('browser editor round-trip, private corrections, conflict rescue, reader navigation and mobile keyboard', { timeout:120000 }, async t=>{
  const origin='https://localhost:8791';
  const { env,mf }=await setup(t,true,{ ...authConfig(),ORIGIN:origin },{ name:'blog',https:true,port:8791,assets:{ directory:new URL('../dist/static',import.meta.url).pathname,binding:'ASSETS',run_worker_first:true,routerConfig:{ has_user_worker:true,invoke_user_worker_ahead_of_assets:true } } });
  await mf.ready;
  const issued=await issueSession(env,{ id:'987',name:'Local test author' },now()+10000),actor=issued.actor;
  await env.DB.prepare('INSERT INTO administrators VALUES (?,?)').bind(actor.subject,now()).run();
  const post=await createPost(env,actor,{ slug:'browser-post',consent:'public-attribution-v1' },key());
  const rich=example('Browser post');rich.doc.content.push({ type:'heading',attrs:{ level:2 },content:[{ type:'text',text:'A section' }] },{ type:'orderedList',attrs:{ start:1,type:null },content:[{ type:'listItem',content:[{ type:'paragraph',content:[{ type:'text',text:'One',marks:[{ type:'italic' }] }] }] }] },{ type:'callout',attrs:{ version:1,tone:'note' },content:[{ type:'text',text:'A helpful note',marks:[{ type:'bold' }] }] });
  const saved=await saveDraft(env,actor,post.id,{ version:0,source:rich },key());await publish(env,actor,post.id,{ version:1,revision:saved.revision },key());
  const browser=await chromium.launch({ headless:true,...(process.env.BCA_BROWSER_EXECUTABLE?{ executablePath:process.env.BCA_BROWSER_EXECUTABLE }:{}) });t.after(()=>browser.close());
  const context=await browser.newContext({ ignoreHTTPSErrors:true });await context.addCookies([{ name:'__Host-bca-session',value:issued.token,url:origin,secure:true,httpOnly:true,sameSite:'Lax' }]);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(15000);
  page.on('console', message=>{ if(message.type()==='error') console.log('Browser console:',message.text()); });
  page.on('response',response=>{ if(response.status()>=400) console.log('Failed browser response:',response.status(),response.url()); });
  await page.goto(`${origin}/admin/?post=${post.id}`);
  try { await page.getByRole('textbox',{ name:'Post body' }).waitFor(); } catch(error) { console.log('Editor errors:', errors); console.log((await page.content()).slice(0,5000)); await page.screenshot({ path:'/tmp/bca-blog-browser-failure.png' }); throw error; }
  await page.getByRole('button',{ name:'Save draft',exact:true }).click();await page.getByText(/Saved at/).waitFor();
  const firstDraft=JSON.parse(await (await env.CONTENT.get((await first(env,'SELECT source_key FROM revisions WHERE id=(SELECT draft_revision FROM posts WHERE id=?)',post.id)).source_key)).text());
  await page.reload();await page.getByRole('textbox',{ name:'Post body' }).waitFor();await page.getByRole('button',{ name:'Save draft',exact:true }).click();await page.getByText(/Saved at/).waitFor();
  const secondDraft=JSON.parse(await (await env.CONTENT.get((await first(env,'SELECT source_key FROM revisions WHERE id=(SELECT draft_revision FROM posts WHERE id=?)',post.id)).source_key)).text());assert.deepEqual(firstDraft,secondDraft);
  await page.getByLabel('Title',{ exact:true }).fill('Private title change');await page.getByRole('button',{ name:'Save draft',exact:true }).click();await page.getByText(/Saved at/).waitFor();
  const reader=await context.newPage();await reader.goto(`${origin}/blog/browser-post/`);assert.equal(await reader.getByRole('heading',{ level:1 }).textContent(),'Browser post');
  await page.getByLabel('Title',{ exact:true }).fill('My unsaved title');
  const current=await first(env,'SELECT version FROM posts WHERE id=?',post.id);await saveDraft(env,actor,post.id,{ version:current.version,source:example('Other administrator') },key());
  await page.getByRole('button',{ name:'Save draft',exact:true }).click();await page.getByText(/Conflict: your local work is preserved/).waitFor();assert.equal(await page.getByLabel('Title',{ exact:true }).inputValue(),'My unsaved title');
  await page.setViewportSize({ width:390,height:844 });await page.getByRole('button',{ name:'Callout',exact:true }).click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByRole('button',{ name:'Apply callout' }).isVisible());await page.keyboard.press('Escape');
  await page.screenshot({ path:'/tmp/bca-blog-editor-mobile.png',fullPage:true });
  await reader.getByRole('link',{ name:'Blog',exact:true }).first().click();await reader.getByRole('heading',{ name:'BCA Wales blog' }).waitFor();assert.match(reader.url(),/\/blog\/$/);await reader.getByRole('link',{ name:'Browser post',exact:true }).click();await reader.getByRole('heading',{ name:'Browser post',exact:true }).waitFor();
  await reader.screenshot({ path:'/tmp/bca-blog-reader.png',fullPage:true });
  assert.deepEqual(errors,[]);await writeFile('/tmp/bca-blog-browser-validation.json',JSON.stringify({ normalizedRoundTrip:true,privateCorrections:true,conflictBufferPreserved:true,mobileDialog:true,spaNavigation:true,errors },null,2));
});

test('sensitive image reveal is deliberate, versioned, per-tab, reversible and keyboard accessible',{ timeout:120000 },async t=>{
  const sharp=(await import('sharp')).default;
  const { digest }=await import('../src/errors.mjs');
  const origin='https://localhost:8792';
  const { env,actor,mf }=await setup(t,true,{ ORIGIN:origin },{ name:'blog',https:true,port:8792,assets:{ directory:new URL('../dist/static',import.meta.url).pathname,binding:'ASSETS',run_worker_first:true,routerConfig:{ has_user_worker:true } } });await mf.ready;
  const post=await createPost(env,actor,{ slug:'sensitive',consent:'public-attribution-v1' },key()),source=example('Sensitive images');
  const ids=[];
  for(const color of ['#aa7733','#335588']) {
    const id=crypto.randomUUID();ids.push(id);const manifest={};
    for(const [variant,width] of [['display',200],['pixel',16]]) {
      const bytes=await sharp({ create:{ width,height:Math.floor(width/2),channels:3,background:color } }).png().toBuffer(),hash=await digest(bytes),objectKey=`media/${id}/${variant}.png`;
      await env.CONTENT.put(objectKey,bytes,{ customMetadata:{ sha256:hash } });manifest[variant]={ key:objectKey,hash,size:bytes.length,type:'image/png' };
    }
    await env.DB.prepare('INSERT INTO media (id,post_id,owner,policy_version,sensitive,manifest,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,post.id,actor.subject,1,1,JSON.stringify(manifest),now()).run();
    source.doc.content.push({ type:'image',attrs:{ version:1,assetId:id,policyVersion:1,sensitive:true,warning:'Sensitive scene',alt:`Detailed image ${color}`,decorative:false,caption:'A descriptive caption',credit:'' } });
  }
  const saved=await saveDraft(env,actor,post.id,{ version:0,source },key());await publish(env,actor,post.id,{ version:1,revision:saved.revision },key());
  const browser=await chromium.launch({ headless:true,...(process.env.BCA_BROWSER_EXECUTABLE?{ executablePath:process.env.BCA_BROWSER_EXECUTABLE }:{}) });t.after(()=>browser.close());
  const context=await browser.newContext({ ignoreHTTPSErrors:true }),page=await context.newPage();page.setDefaultTimeout(15000);
  const clear=[];page.on('request',request=>{ if(request.url().endsWith('/display')) clear.push(request.url()); });
  await page.goto(`${origin}/blog/sensitive/`);await page.getByRole('button',{ name:'Show image' }).first().waitFor();assert.equal(clear.length,0);assert.equal(await page.locator('img[alt^="Detailed"]').count(),0);
  const show=page.getByRole('button',{ name:'Show image',exact:true }).first();await show.focus();await page.keyboard.press('Enter');await page.getByRole('button',{ name:'Hide image' }).waitFor();assert.equal(clear.length,1);assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Hide image');
  await page.reload();await page.getByRole('button',{ name:'Hide image' }).waitFor();assert.equal(await page.getByRole('button',{ name:'Show image' }).count(),1);
  const other=await context.newPage();await other.goto(`${origin}/blog/sensitive/`);assert.equal(await other.getByRole('button',{ name:'Show image' }).count(),2);
  await page.getByRole('button',{ name:'Reset image reveals' }).click();assert.equal(await page.getByRole('button',{ name:'Show image' }).count(),2);
  await page.route('**/display',route=>route.abort());await page.getByRole('button',{ name:'Show image' }).first().click();await page.getByRole('button',{ name:'Retry image' }).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('bca-image-reveals-v1')).length),0);await page.unroute('**/display');
  await page.getByRole('button',{ name:'Retry image' }).click();await page.getByRole('button',{ name:'Hide image' }).waitFor();
  // A changed warning policy on the same asset must require another deliberate reveal.
  source.doc.content[1].attrs.warning='Updated sensitive image warning';const correction=await saveDraft(env,actor,post.id,{ version:2,source },key());await publish(env,actor,post.id,{ version:3,revision:correction.revision },key());
  await page.reload();assert.equal(await page.getByRole('button',{ name:'Show image' }).count(),2);
  await page.screenshot({ path:'/tmp/bca-blog-sensitive.png',fullPage:true });
});
