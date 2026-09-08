import assert from 'node:assert/strict';
import test from 'node:test';
import { createDevelopmentStepRuntime } from '../src/development-step-runtime.ts';
const configuration={organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
const target={operationId:'00000000-0000-4000-8000-000000000221',inputDigest:'b'.repeat(64)};
const base={authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('must not read keys');}};
const reader={originals:{...base,authorize:async()=>{},authorizeOriginal:async()=>{}},results:{...base,authorizeResult:async()=>{}},authorizeRequest:async()=>{}};
test('fixed-operation development runtime is lazy and denied or cancelled requests cannot reach SQL or the model',async()=>{
  let connections=0,calls=0;const pool={connect:async()=>{connections++;throw new Error('private-database');}};
  const runtime=createDevelopmentStepRuntime({drafts:pool,execution:pool},configuration,target,{reader,model:{execute:async()=>{calls++;throw new Error();},verify:async()=>{}},authorize:async()=>{throw new Error('private-denial');}});
  assert.deepEqual(Object.keys(runtime),['run','close']);const signal=new AbortController();signal.abort();
  assert.equal((await runtime.run('architect',signal.signal)).outcome,'busy');
  const denied=await runtime.run('architect',new AbortController().signal);assert.equal(denied.outcome,'attention-required');
  assert.equal(denied.resultRef,null);assert.ok(!JSON.stringify(denied).includes('private'));assert.equal(denied.retryAuthorized,false);
  assert.equal(connections,0);assert.equal(calls,0);runtime.close();
});
test('runtime rejects missing recorded-provider verification, caller scope changes, unsupported roles and timeout drift',async()=>{
  const pool={connect:async()=>{throw new Error();}},deps={reader,model:{execute:async()=>{},verify:async()=>{}},authorize:async()=>{}};
  for(const maxDurationMs of [0,999,90001])assert.throws(()=>createDevelopmentStepRuntime({drafts:pool,execution:pool},configuration,target,deps,{maxDurationMs}));
  assert.throws(()=>createDevelopmentStepRuntime({drafts:pool,execution:pool},configuration,{...target,approved:true},deps));
  assert.throws(()=>createDevelopmentStepRuntime({drafts:pool,execution:pool},configuration,target,{...deps,model:{execute:async()=>{}} as any}));
  const runtime=createDevelopmentStepRuntime({drafts:pool,execution:pool},configuration,target,deps);
  await assert.rejects(runtime.run('candidate-save',new AbortController().signal));await assert.rejects(runtime.run('architect',{} as AbortSignal));runtime.close();
});
test('timed-out execution authority keeps admission while draining and close never starts late model work',async()=>{
  let release!:()=>void,checks=0,calls=0;const held=new Promise<void>(r=>{release=r;}),pool={connect:async()=>{calls++;throw new Error();}};
  const runtime=createDevelopmentStepRuntime({drafts:pool,execution:pool},configuration,target,{reader,model:{execute:async()=>{calls++;},verify:async()=>{}},
    authorize:async()=>{checks++;await held;}},{maxDurationMs:1000});
  const first=await runtime.run('architect',new AbortController().signal);assert.equal(first.outcome,'attention-required');
  assert.equal((await runtime.run('architect',new AbortController().signal)).outcome,'busy');assert.equal(checks,1);assert.equal(calls,0);
  runtime.close();release();await new Promise(r=>setImmediate(r));assert.equal(calls,0);
});
