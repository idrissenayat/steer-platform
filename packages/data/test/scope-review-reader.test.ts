import assert from 'node:assert/strict';
import test from 'node:test';
import {createScopeReviewReader} from '../src/scope-review-reader.ts';
const config={organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
const target={reviewId:'00000000-0000-4000-8000-000000000240',preparationDigest:'b'.repeat(64)};
const records={authorize:async()=>{},verifyObservation:async()=>{},originals:{authorize:async()=>{},authorizeOriginal:async()=>{},authorizeReview:async()=>{},
  authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('Must not request keys');}}};
test('scope result reader exposes only scoped read/close and rejects extra input, denied identity and missing verifier without SQL',async()=>{
  let sql=0;const pool={connect:async()=>{sql++;throw new Error('Must not connect');}};
  const reader=createScopeReviewReader({drafts:pool,execution:pool},config,records);
  assert.deepEqual(Object.keys(reader),['scope','read','close']);assert.ok(Object.isFrozen(reader.scope));
  for(const input of [{...target,scope:'other'},{...target,modelBudget:5},{...target,result:{}},{...target,reviewId:'bad'}])
    await assert.rejects(reader.read(input,async()=>{}),{message:'Scope review read is unavailable.'});
  await assert.rejects(reader.read(target,async()=>{throw new Error('Private denied identity');}),{message:'Scope review read is unavailable.'});
  await assert.rejects(reader.read(target,async()=>true as any));reader.close();await assert.rejects(reader.read(target,async()=>{}));assert.equal(sql,0);
  assert.throws(()=>createScopeReviewReader({drafts:pool,execution:pool},config,{...records,verifyObservation:undefined as any}));
});
test('scope result reader retains timed-out identity admission until drainage and never connects after close',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let release!:()=>void,checks=0,sql=0;
  const held=new Promise<void>(r=>{release=r;}),pool={connect:async()=>{sql++;throw new Error('No SQL');}};
  const reader=createScopeReviewReader({drafts:pool,execution:pool},config,records);
  const tasks=Array.from({length:4},()=>reader.read(target,async()=>{checks++;await held;}));
  const denied=tasks.map(p=>assert.rejects(p));await Promise.resolve();await Promise.resolve();t.mock.timers.tick(30001);await Promise.all(denied);
  await assert.rejects(reader.read(target,async()=>{checks++;}));assert.equal(checks,4);assert.equal(sql,0);
  reader.close();release();await new Promise(r=>setImmediate(r));assert.equal(sql,0);
});
