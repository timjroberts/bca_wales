// Disposable local-only visual preview. No credentials, persistent data or login bypass.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { createPost, saveDraft, publish } from '../src/storage.mjs';
const origin='http://localhost:8793';
const mf=new Miniflare(convertV4MiniflareOptions({ name:'blog-preview',host:'127.0.0.1',port:8793,modules:true,scriptPath:new URL('../dist/worker.mjs',import.meta.url).pathname,compatibilityDate:'2026-08-01',bindings:{ ORIGIN:origin,AUTH_ENABLED:'false' },d1Databases:['DB'],r2Buckets:['CONTENT','RECOVERY'],assets:{ directory:new URL('../dist/static',import.meta.url).pathname,binding:'ASSETS',run_worker_first:true,routerConfig:{ has_user_worker:true,invoke_user_worker_ahead_of_assets:true } } }));
const env={ DB:await mf.getD1Database('DB'),CONTENT:await mf.getR2Bucket('CONTENT'),RECOVERY:await mf.getR2Bucket('RECOVERY'),ORIGIN:origin,AUTH_ENABLED:'false' };
await env.DB.exec((await readFile(new URL('../migrations/0001_blog.sql',import.meta.url),'utf8')).replace(/\n/g,' '));
const time=Math.floor(Date.now()/1000),actor={ subject:'local-preview',sid:crypto.randomUUID(),iat:time,exp:time+28800,attribution:{ name:'BCA Wales · Preview author' } };
await env.DB.prepare('INSERT INTO administrators VALUES (?,?)').bind(actor.subject,time).run();
const stories=[
  ['reading-the-landscape','Learning to read the landscape','A closer look at the places we pass every day — and the questions that help us see them differently.'],
  ['room-for-recovery','Making room for recovery','What it means to give a landscape time, space and the chance to change.'],
  ['shared-ground','Finding our shared ground','Local knowledge starts with a conversation. A few thoughts on listening, noticing and taking part.'],
  ['landscape-over-time','A landscape, seen over time','Looking beyond a single moment to understand the patterns that connect a place.']
];
const text=value=>({ type:'text',text:value }),paragraph=value=>({ type:'paragraph',content:[text(value)] });
for (const [index,[slug,title,excerpt]] of stories.entries()) {
  const post=await createPost(env,actor,{ slug,consent:'public-attribution-v1' },crypto.randomUUID());
  const source={ schemaVersion:1,title,excerpt,doc:{ type:'doc',content:[
    { type:'callout',attrs:{ version:1,tone:'note' },content:[text('Design preview — this is sample writing, not a published BCA Wales report.')] },
    paragraph('A landscape is more than the view in front of us. It holds traces of work, weather and the lives of people who know it well. Looking carefully is a way to begin understanding how those stories fit together.'),
    { type:'heading',attrs:{ level:2 },content:[text('Start with what you notice')] },
    paragraph('Follow a path twice and you will rarely see exactly the same place. Light catches a different edge. Water finds a new route. Something that seemed unremarkable becomes a question worth asking.'),
    paragraph('Those small observations matter. Alongside maps and evidence, they offer another way into a bigger conversation about the future of our landscape.'),
    { type:'blockquote',content:[paragraph('The more closely we look, the more there is to understand.')] },
    { type:'heading',attrs:{ level:2 },content:[text('A conversation that continues')] },
    paragraph('There is no single way to know a place. Sharing what we see, checking what we think we know and making room for other perspectives are all part of the work.'),
    paragraph('This journal is a space for those conversations: landscape, community and recovery, considered together.')
  ] } };
  const saved=await saveDraft(env,actor,post.id,{ version:0,source },crypto.randomUUID());
  await publish(env,actor,post.id,{ version:1,revision:saved.revision },crypto.randomUUID());
  await env.DB.prepare('UPDATE posts SET first_published_at=?,updated_at=? WHERE id=?').bind(time-index*86400*3,time-index*86400*3,post.id).run();
}
await mf.ready;
console.log(`Disposable design preview: ${origin}/blog/\nSample content only. Authentication disabled. Ctrl+C stops the preview.`);
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{ await mf.dispose();process.exit(0); });
