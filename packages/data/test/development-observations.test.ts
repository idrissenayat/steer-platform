import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentObservationStore, developmentObservationSchema } from '../src/development-observations.ts';
const config={organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
const target={operationId:'00000000-0000-4000-8000-000000000222',inputDigest:'b'.repeat(64),stepId:'architect',stage:'request'};
const base={authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('must not read keys');}};
const deps={originals:{...base,authorize:async()=>{},authorizeOriginal:async()=>{}},results:{...base,authorizeResult:async()=>{}},authorize:async()=>{}};
test('observation schemas preserve exact body text and unknown usage without accepting headers or authority flags',()=>{
  const value={stage:'request',adapterRevision:'fixture-v1',protocol:'synthetic',rendered:{},requestBody:' Exact body 🌸\r\n'};
  assert.equal(developmentObservationSchema.parse(value).stage,'request');
  assert.throws(()=>developmentObservationSchema.parse({...value,headers:{Authorization:'private-marker'}}));
  assert.throws(()=>developmentObservationSchema.parse({...value,requestBody:'\ud800'}));
  assert.throws(()=>developmentObservationSchema.parse({...value,requestBody:'a'.repeat(350001)}));
  const response={stage:'response',requestDigest:'a'.repeat(64),providerRequestId:null,responseBody:' exact response ',
    usage:{inputTokens:null,outputTokens:null,totalTokens:null},result:{role:'test-agent',output:{exam:'NOT RUN'}}};
  assert.deepEqual(developmentObservationSchema.parse(response),response);
  assert.throws(()=>developmentObservationSchema.parse({...response,usage:{...response.usage,totalTokens:-1}}));
});
test('observation journal is lazy, strictly scoped and sanitizes denial before private reads',async()=>{
  let connects=0;const pool={connect:async()=>{connects++;throw new Error('private-pool');}};
  const store=createDevelopmentObservationStore({execution:pool,drafts:pool},config,{...deps,authorize:async()=>{throw new Error('private-denial');}});
  assert.deepEqual(Object.keys(store),['put','read','readExchange','close']);
  await assert.rejects(store.read(target),{message:'Draft storage is unavailable.'});
  await assert.rejects(store.read({...target,approved:true}));assert.equal(connects,0);store.close();
});
test('timed-out observation authorization retains admission and close suppresses late reads',async()=>{
  let release!:()=>void,calls=0,connects=0;const held=new Promise<void>(r=>{release=r;}),pool={connect:async()=>{connects++;throw new Error();}};
  const store=createDevelopmentObservationStore({execution:pool,drafts:pool},config,{...deps,authorize:async()=>{calls++;await held;}});
  await assert.rejects(store.read(target));await assert.rejects(store.read(target));assert.equal(calls,1);assert.equal(connects,0);
  store.close();release();await new Promise(r=>setImmediate(r));assert.equal(connects,0);
});
