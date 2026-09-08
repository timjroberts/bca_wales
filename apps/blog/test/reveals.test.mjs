import test from 'node:test';
import assert from 'node:assert/strict';
import { RevealStore,revealKey } from '../client/reveals.mjs';
test('exact reveal keys separate assets, warning policy and private preview; storage failure remains memory-only',()=>{
  let serialized='[]';const storage={ getItem:()=>serialized,setItem:(_key,value)=>serialized=value },store=new RevealStore(storage);
  const key=revealKey('public','post','asset','warning-v1');store.set(key,true);
  assert.equal(new RevealStore(storage).has(key),true);
  assert.equal(store.has(revealKey('public','post','replacement','warning-v1')),false);
  assert.equal(store.has(revealKey('public','post','asset','warning-v2')),false);
  assert.equal(store.has(revealKey('preview','post','asset','warning-v1')),false);
  const broken=new RevealStore({ getItem(){throw new Error('disabled');} });assert.equal(broken.has(key),false);broken.set(key,true);assert.equal(broken.has(key),true);broken.clear();assert.equal(broken.has(key),false);
  const readOnly=new RevealStore({ getItem:()=>JSON.stringify([key]),setItem(){throw new Error('read-only');} });assert.equal(readOnly.has(key),false);
  serialized='not JSON';assert.equal(new RevealStore(storage).has(key),false);
});
