import assert from 'node:assert/strict';
import test from 'node:test';
import {summarizeNativeRequests as summarize,createNativeRequestMeter,subtractNativeRequests} from './native-request-metrics.ts';

test('native fixture metrics count only the selected interval and expose no paths or provider data',()=>{
  const privateText='PRIVATE-NOT-FOR-DIAGNOSTICS';
  const get=(suffix:string)=>({path:`/repos/${privateText}/repo/git/${suffix}/${privateText}`,method:'GET'});
  const calls=[get('ref/heads'),get('ref/heads'),get('commits'),get('trees'),get('blobs'),
    {path:`/app/installations/${privateText}/access_tokens`,method:'POST'},
    {path:'/graphql',method:'POST'},{path:`/${privateText}`,method:'GET'},
    {...get('blobs'),method:'POST'}];
  const result=summarize(calls,1);
  assert.deepEqual(result,{head:1,commit:1,tree:1,blob:1,token:1,mutation:1,other:2});
  assert.equal(Object.values(result).reduce((a,b)=>a+b,0),calls.length-1);
  assert.equal(JSON.stringify(result).includes(privateText),false);assert.ok(Object.isFrozen(result));
  assert.ok(Object.values(summarize(calls,calls.length)).every(v=>v===0));
  for(const value of [-1,0.5,NaN,calls.length+1])assert.throws(()=>summarize(calls,value),{message:'Invalid diagnostic range.'});
});

test('transport ownership metrics preserve exact calls and replies without retaining request material',async()=>{
  const privateText='PRIVATE-TRANSPORT-DATA',request=new Request(`https://synthetic.invalid/repos/${privateText}/repo/git/ref/heads/main`),
    init={headers:{authorization:privateText},method:'GET'},response=new Response(privateText);
  const promise=Promise.resolve(response);let calls=0;
  const meter=createNativeRequestMeter((url,options)=>{calls++;assert.equal(url,request);assert.equal(options,init);return promise;});
  const before=meter.snapshot();assert.equal(meter.transport(request,init),promise);
  assert.equal(await promise,response);assert.equal(calls,1);assert.equal(before.head,0);
  const interval=subtractNativeRequests(meter.snapshot(),before);assert.equal(interval.head,1);
  assert.equal(JSON.stringify(meter.snapshot()).includes(privateText),false);assert.ok(Object.isFrozen(interval));
  const total=summarize([{path:'/repos/shared/repo/git/ref/heads/main',method:'GET'},
    {path:'/repos/shared/repo/git/trees/abc',method:'GET'}]);
  assert.deepEqual(subtractNativeRequests(total,interval),{head:0,commit:0,tree:1,blob:0,token:0,mutation:0,other:0});
});

test('failed or malformed transport requests preserve original failures and partitions reject invalid intervals',async()=>{
  const failure=new Error('PRIVATE-FAILURE'),rejected=Promise.reject(failure);void rejected.catch(()=>{});
  const meter=createNativeRequestMeter(()=>rejected);
  assert.equal(meter.transport('not a URL'),rejected);await assert.rejects(rejected,error=>error===failure);
  assert.equal(meter.snapshot().other,1);
  const synchronous=createNativeRequestMeter(()=>{throw failure;});
  assert.throws(()=>synchronous.transport('https://synthetic.invalid'),error=>error===failure);
  assert.equal(synchronous.snapshot().other,1);
  const zero=summarize([]);
  for(const partial of [{...zero,head:1},{...zero,tree:-1},{...zero,other:NaN},{...zero,blob:0.5}])
    assert.throws(()=>subtractNativeRequests(zero,partial),{message:'Invalid diagnostic partition.'});
});

test('native immutable GraphQL batches count once as blob reads, never as mutations or leaked query content',async()=>{
  const body=JSON.stringify({query:'query SteerCorpusArtifactBatch($owner: String!) { repository { databaseId } }',variables:{owner:'PRIVATE'}});
  const meter=createNativeRequestMeter(async()=>Response.json({}));
  await meter.transport('https://api.github.com/graphql',{method:'POST',body});
  const captured=summarize([{path:'/graphql',method:'POST',corpusQuery:true}]);
  assert.deepEqual(meter.snapshot(),captured);assert.equal(captured.blob,1);assert.equal(captured.mutation,0);
  assert.equal(Object.values(captured).reduce((a,b)=>a+b,0),1);assert.doesNotMatch(JSON.stringify(captured),/PRIVATE|query/);
});
