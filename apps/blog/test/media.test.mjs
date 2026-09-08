import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { setup, key } from './helpers.mjs';
import { createPost, first } from '../src/storage.mjs';
import { uploadImage, stripPngMetadata, imageType } from '../src/media.mjs';
const bytesOf = async stream => Buffer.from(await new Response(stream).arrayBuffer());
export const localImagesAdapter = {
  async info(stream) { const bytes=await bytesOf(stream),info=await sharp(bytes).metadata(); return { format:`image/${info.format==='jpg'?'jpeg':info.format}`,width:info.width,height:info.height,fileSize:bytes.length }; },
  input(stream) { let transform; return { transform(options) { transform=options; return this; },async output() { const bytes=await bytesOf(stream); const output=await sharp(bytes).resize({ width:transform.width,height:transform.height,fit:'inside',withoutEnlargement:true }).png().toBuffer(); return { response:()=>new Response(output,{ headers:{ 'Content-Type':'image/png' } }) }; } }; }
};
test('private image processing stores stripped PNG derivatives and real tiny pixels, never an original public variant',async t=>{
  const { env,actor }=await setup(t);env.IMAGES=localImagesAdapter;
  const post=await createPost(env,actor,{ slug:'images',consent:'public-attribution-v1' },key());
  const bytes=await sharp({ create:{ width:200,height:100,channels:3,background:'#649260' } }).withMetadata({ exif:{ IFD0:{ Artist:'Private attribution',Copyright:'Private metadata' } } }).png().toBuffer();
  assert.match(bytes.toString('latin1'),/Private/);
  const cleaned=stripPngMetadata(bytes);assert.doesNotMatch(Buffer.from(cleaned).toString('latin1'),/Private|eXIf|iCCP/);assert.equal((await sharp(cleaned).metadata()).width,200);
  const operation=key(),options={ type:'image/png',sensitive:true,placeholder:'pixel' };
  const result=await uploadImage(env,actor,post.id,bytes,options,operation);assert.deepEqual(await uploadImage(env,actor,post.id,bytes,options,operation),result);
  const row=await first(env,'SELECT * FROM media WHERE id=?',result.assetId),manifest=JSON.parse(row.manifest);assert.equal(manifest.original,undefined);
  const pixel=await env.CONTENT.get(manifest.pixel.key),meta=await sharp(Buffer.from(await pixel.arrayBuffer())).metadata();assert.ok(meta.width<=16&&meta.height<=16);
  const display=await env.CONTENT.get(manifest.display.key);assert.doesNotMatch(Buffer.from(await display.arrayBuffer()).toString('latin1'),/Private metadata|Private attribution/);
});
test('unconfigured/failed processing and hostile uploads never create valid media',async t=>{
  const { env,actor }=await setup(t),post=await createPost(env,actor,{ slug:'fail-image',consent:'public-attribution-v1' },key());
  const bytes=await sharp({ create:{ width:20,height:20,channels:3,background:'white' } }).png().toBuffer();
  await assert.rejects(uploadImage(env,actor,post.id,bytes,{ type:'image/png',sensitive:true,placeholder:'pixel' },key()),{ status:503 });
  env.IMAGES={ ...localImagesAdapter,input(){ throw new Error('transform failed'); } };
  await assert.rejects(uploadImage(env,actor,post.id,bytes,{ type:'image/png',sensitive:true,placeholder:'pixel' },key()));assert.equal(await first(env,'SELECT * FROM media'),null);
  assert.throws(()=>imageType(new TextEncoder().encode('<svg onload="evil"/>')),{ status:422 });
  await assert.rejects(uploadImage(env,actor,post.id,bytes,{ type:'image/jpeg',sensitive:true,placeholder:'pixel' },key()),{ status:422 });
});
