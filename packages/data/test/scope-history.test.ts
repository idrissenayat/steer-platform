import assert from 'node:assert/strict';
import test from 'node:test';
import { createScopeReviewHistoryOperationReader } from '../src/scope-review-operations.ts';
const config={organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',
  configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64),expiresAt:'2026-09-08T00:00:00.000Z',
  budget:{organizationId:'org',subject:'human',configurationRevision:'r1',budgetId:'00000000-0000-4000-8000-000000000218',
    approvalDigest:'b'.repeat(64),capMicrousd:5,architectMicrousd:3,testAgentMicrousd:2},
  scopeTerms:{approvalDigest:'c'.repeat(64),profileDigest:'d'.repeat(64),amountMicrousd:1}};
const target={reviewId:'00000000-0000-4000-8000-000000000219',preparationDigest:'c'.repeat(64)};
test('historical scope metadata exposes no execution method and rejects injected input or missing current authority before SQL',async()=>{
  let connections=0,authorizations=0;
  const reader=createScopeReviewHistoryOperationReader({connect:async()=>{connections++;throw new Error('Private SQL');}},config,
    {authorize:async()=>{authorizations++;throw new Error('Private authority');}});
  assert.deepEqual(Object.keys(reader),['inspectHistory','close']);
  for(const patch of [{approved:true},{budget:5},{preparationDigest:'c'.repeat(64)+'\n'},{reviewId:'foreign'}])await assert.rejects(reader.inspectHistory({...target,...patch}));
  assert.equal(authorizations,0);await assert.rejects(reader.inspectHistory(target));assert.equal(authorizations,1);assert.equal(connections,0);
  reader.close();await assert.rejects(reader.inspectHistory(target));assert.equal(authorizations,1);
});
test('stalled historical scope authority retains admission after timeout and close prevents late SQL',async()=>{
  let release!:()=>void,calls=0,connections=0;const held=new Promise<void>(r=>{release=r;});
  const reader=createScopeReviewHistoryOperationReader({connect:async()=>{connections++;throw new Error('Private SQL');}},config,
    {authorize:async()=>{calls++;await held;}});
  await assert.rejects(reader.inspectHistory(target));await assert.rejects(reader.inspectHistory(target));assert.equal(calls,1);assert.equal(connections,0);
  reader.close();release();await new Promise(r=>setImmediate(r));await assert.rejects(reader.inspectHistory(target));assert.equal(connections,0);
});
