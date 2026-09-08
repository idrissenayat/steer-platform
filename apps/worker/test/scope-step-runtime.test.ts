import assert from 'node:assert/strict';
import test from 'node:test';
import {createScopeStepRuntime} from '../src/scope-step-runtime.ts';
import {scopeReviewFixture} from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
const configuration={organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
const target={reviewId:'00000000-0000-4000-8000-000000000242',preparationDigest:'b'.repeat(64)},batchId='c'.repeat(64);
const records={authorize:async()=>{},originals:{authorize:async()=>{},authorizeOriginal:async()=>{},authorizeReview:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('must not read keys');}}};
const gateway={gatewayUrl:'http://127.0.0.1:4000/v1',gatewayKey:'synthetic-unused-key',transport:async()=>{throw new Error('must not send');}};
test('scope execution is lazy and denies cancelled or unauthorized work without SQL, keys or transport',async()=>{
  let connections=0;const pool={connect:async()=>{connections++;throw new Error('private-database');}},f=await scopeReviewFixture();
  const runtime=createScopeStepRuntime({drafts:pool,execution:pool},configuration,target,{records,profile:f.profile,gateway,authorize:async()=>{throw new Error('private-authority');}});
  assert.deepEqual(Object.keys(runtime),['run','close']);assert.equal(connections,0);const cancel=new AbortController();cancel.abort();
  assert.equal((await runtime.run(batchId,cancel.signal)).outcome,'busy');const denied=await runtime.run(batchId,new AbortController().signal);
  assert.equal(denied.outcome,'attention-required');assert.equal(denied.resultDigest,null);assert.equal(connections,0);
  assert.equal(JSON.stringify(denied).includes('private'),false);assert.equal(JSON.stringify(denied).includes('synthetic-unused-key'),false);
  for(const flag of ['semanticQualityVerified','authoritativeClearance','executionAuthorized','retryAuthorized','gateSigned'] as const)assert.equal(denied[flag],false);
  runtime.close();assert.equal((await runtime.run(batchId,new AbortController().signal)).outcome,'busy');
});
test('scope runtime rejects extended targets, invalid batch/profile/time bounds and missing current authority functions',async()=>{
  const pool={connect:async()=>{throw new Error();}},f=await scopeReviewFixture(),deps={records,profile:f.profile,gateway,authorize:async()=>{}};
  for(const maxDurationMs of [0,999,90001,Infinity])assert.throws(()=>createScopeStepRuntime({drafts:pool,execution:pool},configuration,target,deps,{maxDurationMs}));
  assert.throws(()=>createScopeStepRuntime({drafts:pool,execution:pool},configuration,{...target,approved:true},deps));
  assert.throws(()=>createScopeStepRuntime({drafts:pool,execution:pool},configuration,target,{...deps,profile:{...f.profile,modelRoute:''}}));
  for(const name of Object.keys(records.originals))assert.throws(()=>createScopeStepRuntime({drafts:pool,execution:pool},configuration,target,
    {...deps,records:{...records,originals:{...records.originals,[name]:undefined}}} as any));
  const runtime=createScopeStepRuntime({drafts:pool,execution:pool},configuration,target,deps);
  await assert.rejects(runtime.run('candidate-save',new AbortController().signal));await assert.rejects(runtime.run(batchId+'\n',new AbortController().signal));
  await assert.rejects(runtime.run(batchId,{} as AbortSignal));runtime.close();
});
test('scope runtime retains admission until timed-out authority actually drains, then rechecks authority',async()=>{
  let release!:()=>void,calls=0,connections=0;const held=new Promise<void>(r=>{release=r;}),f=await scopeReviewFixture();
  const pool={connect:async()=>{connections++;throw new Error('no SQL');}};
  const runtime=createScopeStepRuntime({drafts:pool,execution:pool},configuration,target,{records,profile:f.profile,gateway,
    authorize:async()=>{if(++calls===1)await held;else throw new Error('still denied');}},{maxDurationMs:1000});
  try{
    assert.equal((await runtime.run(batchId,new AbortController().signal)).outcome,'attention-required');
    assert.equal((await runtime.run(batchId,new AbortController().signal)).outcome,'busy');assert.equal(calls,1);assert.equal(connections,0);
    release();await new Promise(r=>setImmediate(r));
    assert.equal((await runtime.run(batchId,new AbortController().signal)).outcome,'attention-required');assert.equal(calls,2);assert.equal(connections,0);
  }finally{runtime.close();release();}
});
test('non-void authority acknowledgement cannot become scope permission',async()=>{
  let connections=0;const pool={connect:async()=>{connections++;throw new Error();}},f=await scopeReviewFixture();
  const runtime=createScopeStepRuntime({drafts:pool,execution:pool},configuration,target,{records,profile:f.profile,gateway,authorize:async()=>false} as any);
  assert.equal((await runtime.run(batchId,new AbortController().signal)).outcome,'attention-required');assert.equal(connections,0);runtime.close();
});
