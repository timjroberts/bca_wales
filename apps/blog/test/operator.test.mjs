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
test('operator batch uses one provider batch envelope and preserves per-statement parameters',async()=>{
  const requests=[];
  const results=[{ success:true,results:[{ value:"quote' and ?" }] },{ success:true,results:[{ value:2 }] }];
  const env=remoteEnvironment(config,{ BCA_BLOG_D1_TOKEN:'private-synthetic-token' },async(url,options)=>{
    requests.push({ url,body:JSON.parse(options.body) });
    return Response.json({ success:true,result:results });
  });
  assert.deepEqual(await env.DB.batch([
    env.DB.prepare('SELECT ? AS value').bind("quote' and ?"),
    env.DB.prepare('SELECT ? AS value').bind(2)
  ]),results);
  assert.equal(requests.length,1);
  assert.deepEqual(requests[0].body,{ batch:[
    { sql:'SELECT ? AS value',params:["quote' and ?"] },
    { sql:'SELECT ? AS value',params:[2] }
  ] });
  assert.doesNotMatch(JSON.stringify(requests),/private-synthetic-token/);
});
test('operator rejects a failed batch without returning private provider errors or retrying individual writes',async()=>{
  for(const [status,body] of [
    [400,{ success:false,errors:[{ message:'private SQL content' }] }],
    [200,{ success:false,result:[] }],
    [200,{ success:true,result:[{ success:false,error:'private SQL content' }] }]
  ]) {
    let calls=0;
    const env=remoteEnvironment(config,{ BCA_BLOG_D1_TOKEN:'private-synthetic-token' },async()=>{
      calls++;return Response.json(body,{ status });
    });
    await assert.rejects(env.DB.batch([env.DB.prepare('SELECT 1')]),error=>{
      assert.equal(error.status,503);assert.doesNotMatch(error.message,/private/);return true;
    });
    assert.equal(calls,1);
  }
});
