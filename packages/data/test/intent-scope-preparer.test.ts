import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {scopeReviewFixture} from '../../tool-registry/test/intent-scope-review.fixture.ts';
import {createIntentScopePreparer} from '../src/intent-scope-preparer.ts';
async function fixture(){
  const f=await scopeReviewFixture(),scope={organizationId:f.scope.organizationId,productId:f.scope.productId,repository:f.scope.repository,configurationRevision:'r1'};
  const config={...scope,subject:'human',branch:f.evidence.branch,recordsPolicyDigest:'a'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),
    budget:{organizationId:scope.organizationId,subject:'human',configurationRevision:'r1',budgetId:randomUUID(),approvalDigest:'b'.repeat(64),capMicrousd:5,architectMicrousd:3,testAgentMicrousd:2},
    scopeTerms:{approvalDigest:'c'.repeat(64),profileDigest:f.prepared.batches[0]!.packet.profileDigest,amountMicrousd:1}};
  const input={...scope,draftId:f.scope.draftId,revision:1,revisionDigest:'d'.repeat(64),scopeInputDigest:f.prepared.plan.scopeInputDigest,sourceSnapshotDigest:f.prepared.plan.sourceSnapshotDigest};
  const records={authorize:async()=>{},authorizeOriginal:async()=>{},authorizeReview:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('No key');}};
  return{...f,config,input,records};
}
test('scope preparer is lazy and denies missing authority, foreign scope and close before SQL',async()=>{
  const f=await fixture();let calls=0;const pool={connect:async()=>{calls++;throw new Error();}},pools={drafts:pool,execution:pool};
  const deps={records:f.records,evidenceFor:async()=>{calls++;throw new Error();},authorizePreparation:async()=>{}};
  const service=createIntentScopePreparer(pools,f.config,f.profile,deps);
  for(const key of ['organizationId','productId','repository','configurationRevision'])await assert.rejects(service.prepare({...f.input,[key]:'foreign'},async()=>{}));
  assert.equal((await service.prepare(f.input,async()=>{throw new Error();})).outcome,'unavailable');
  assert.equal((await service.prepare(f.input,async()=>true as any)).outcome,'unavailable');
  service.close();await assert.rejects(service.prepare(f.input,async()=>{}));assert.equal(calls,0);
  for(const key of ['evidenceFor','authorizePreparation'])assert.throws(()=>createIntentScopePreparer(pools,f.config,f.profile,{...deps,[key]:undefined} as any));
  for(const key of Object.keys(f.records))assert.throws(()=>createIntentScopePreparer(pools,f.config,f.profile,{...deps,records:{...f.records,[key]:undefined}} as any));
});
test('scope preparation timeout retains all admission slots until actual dependencies drain and blocks late SQL',async t=>{
  const f=await fixture();t.mock.timers.enable({apis:['setTimeout']});let release!:()=>void,calls=0;
  const held=new Promise<void>(r=>{release=r;}),pool={connect:async()=>{calls++;throw new Error();}};
  const service=createIntentScopePreparer({drafts:pool,execution:pool},f.config,f.profile,{records:f.records,evidenceFor:async()=>{},authorizePreparation:async()=>{}});
  const pending=Array.from({length:4},()=>service.prepare(f.input,()=>held));await Promise.resolve();await Promise.resolve();t.mock.timers.tick(30001);
  assert.ok((await Promise.all(pending)).every(r=>r.outcome==='unavailable'));await assert.rejects(service.prepare(f.input,async()=>{}));
  service.close();release();await new Promise(r=>setImmediate(r));assert.equal(calls,0);
});
