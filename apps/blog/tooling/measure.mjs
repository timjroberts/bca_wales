import { performance } from 'node:perf_hooks';
import { readFile,readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { renderDocument } from '../src/document.mjs';
const source={ schemaVersion:1,title:'Bounded local rendering measurement',excerpt:'Synthetic measurement only.',doc:{ type:'doc',content:Array.from({ length:2499 },()=>({ type:'paragraph',content:[{ type:'text',text:'Landscape recovery '.repeat(15) }] })) } };
const times=[];let html;
for(let i=0;i<20;i++) { const start=performance.now();html=renderDocument(source,()=>{throw new Error('No images in this synthetic render');});times.push(performance.now()-start); }
times.sort((a,b)=>a-b);
const base=new URL('../dist/',import.meta.url),files=['worker.mjs',...((await readdir(new URL('static/',base))).filter(name=>name.endsWith('.js')).map(name=>`static/${name}`)),...((await readdir(new URL('static/chunks/',base))).map(name=>`static/chunks/${name}`))];
const bundles=[];for(const file of files) { const bytes=await readFile(new URL(file,base));bundles.push({ file,bytes:bytes.length,gzipBytes:gzipSync(bytes).length }); }
console.log(JSON.stringify({ measuredAt:new Date().toISOString(),runtime:process.version,scope:'Local Node validator/renderer and bundle sizes; not hosted Worker CPU/Images or billing evidence',nodes:4999,sourceBytes:Buffer.byteLength(JSON.stringify(source)),htmlBytes:Buffer.byteLength(html),runs:20,p50Milliseconds:times[10],p95Milliseconds:times[19],bundles },null,2));
