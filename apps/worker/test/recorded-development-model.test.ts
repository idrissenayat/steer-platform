import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordedDevelopmentModel } from '../src/recorded-development-model.ts';
const config={organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
const target={operationId:'00000000-0000-4000-8000-000000000223',inputDigest:'b'.repeat(64)};
const base={authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('must not read keys');}};
const records={originals:{...base,authorize:async()=>{},authorizeOriginal:async()=>{}},results:{...base,authorizeResult:async()=>{}},authorize:async()=>{}};
const profile={profileRevision:'synthetic',instructions:'Synthetic instructions',modelRoute:'synthetic',maxOutputTokens:1000,allowedResponseModels:['synthetic']};
const gateway={gatewayUrl:'http://127.0.0.1:4000/v1',gatewayKey:'synthetic',profiles:{architect:profile,testAgent:profile}};
const input:any={rendered:{organizationId:'org',subject:'human',...target,role:'architect'},owner:target.operationId,fencingToken:1,reservationId:target.operationId};
test('recorded model binding is lazy, fixed scope and denies before SQL, keys or transport',async()=>{
  let calls=0;const pool={connect:async()=>{calls++;throw new Error('private-pool');}},model=createRecordedDevelopmentModel({drafts:pool,execution:pool},config,target,
    {records,gateway:{...gateway,transport:async()=>{calls++;throw new Error();}},authorize:async()=>{throw new Error('private-denial');}});
  assert.deepEqual(Object.keys(model),['execute','verify','close']);
  await assert.rejects(model.execute(input,new AbortController().signal),{message:'Recorded development model is unavailable.'});
  await assert.rejects(model.verify({...target,organizationId:'org',stepId:'architect',stepInputDigest:'c'.repeat(64),outputDigest:'d'.repeat(64),recordsPolicyDigest:config.recordsPolicyDigest}));
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(model.execute(input,cancelled.signal));assert.equal(calls,0);model.close();
});
test('recorded model retains admission while timed-out authority drains and close starts no late SQL work',async()=>{
  let release!:()=>void,calls=0,checks=0;const held=new Promise<void>(r=>{release=r;}),pool={connect:async()=>{calls++;throw new Error();}};
  const model=createRecordedDevelopmentModel({drafts:pool,execution:pool},config,target,{records,gateway,authorize:async()=>{checks++;await held;}});
  await assert.rejects(model.execute(input,new AbortController().signal));await assert.rejects(model.execute(input,new AbortController().signal));
  assert.equal(checks,1);assert.equal(calls,0);model.close();release();await new Promise(r=>setImmediate(r));assert.equal(calls,0);
});
