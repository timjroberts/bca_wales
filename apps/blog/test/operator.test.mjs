import test from 'node:test';
import assert from 'node:assert/strict';
import { remoteEnvironment } from '../tooling/operator.mjs';
const config={ environment:'staging',accountId:'a'.repeat(32),databaseId:'11111111-1111-1111-1111-111111111111',contentBucket:'bca-wales-blog-staging-content',recoveryBucket:'bca-wales-blog-staging-recovery',jurisdiction:'eu',restricted:true };
test('operator adapter rejects evidence buckets and uses parameterized D1 requests without returning credentials',async()=>{
  assert.throws(()=>remoteEnvironment({ ...config,contentBucket:'bca-wales-public-releases' },{ BCA_BLOG_D1_TOKEN:'test' }),{ status:400 });
  assert.throws(()=>remoteEnvironment({ ...config,recoveryBucket:config.contentBucket },{ BCA_BLOG_D1_TOKEN:'test' }),{ status:400 });
  let sent;
  const env=remoteEnvironment(config,{ BCA_BLOG_D1_TOKEN:'private-synthetic-token' },async(url,options)=>{ sent={ url,body:JSON.parse(options.body) };return Response.json({ success:true,result:[{ results:[{ n:1 }] }] }); });
  assert.deepEqual(await env.DB.prepare('SELECT ? AS n').bind("quote' and ?").first(),{ n:1 });
  assert.equal(sent.body.sql,'SELECT ? AS n');assert.deepEqual(sent.body.params,["quote' and ?"]);assert.doesNotMatch(JSON.stringify(sent),/private-synthetic-token/);
});
