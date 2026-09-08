import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes,randomUUID } from 'node:crypto';
import { scopeReviewFixture } from '../../tool-registry/test/intent-scope-review.fixture.ts';
import { describeScopeOriginal } from '../src/scope-original-contracts.ts';
import { openScopeOriginal,sealScopeOriginal,scopeOriginalMaxBytes } from '../src/scope-original-envelope.ts';

test('scope original reconstructs the exact manifest and excludes inherited Exam and unbound credentials',async()=>{
  const f=await scopeReviewFixture(),budget={organizationId:f.scope.organizationId,subject:'human',configurationRevision:'r1',budgetId:randomUUID(),
    approvalDigest:'a'.repeat(64),capMicrousd:20,architectMicrousd:3,testAgentMicrousd:2};
  const input={kind:'steer-scope-original/v1',configuration:{organizationId:f.scope.organizationId,subject:'human',productId:f.scope.productId,repository:f.scope.repository,
    branch:f.evidence.branch,configurationRevision:'r1',recordsPolicyDigest:'b'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),budget,
    scopeTerms:{approvalDigest:'c'.repeat(64),profileDigest:f.prepared.batches[0]!.packet.profileDigest,amountMicrousd:4}},
    source:{revision:1,revisionDigest:'d'.repeat(64),scope:f.scope},evidence:f.evidence,profile:f.profile};
  const described=await describeScopeOriginal(input);assert.equal(described.manifest.preparationDigest,f.prepared.preparationDigest);
  assert.equal(described.executionAuthorized,false);assert.ok(Object.isFrozen(described.original));
  for(const changed of [{...input,exam:'Not inherited'},{...input,profile:{...input.profile,gatewayKey:'must not persist'}},
    {...input,source:{...input.source,scope:{...f.scope,documents:{...f.scope.documents,exam:'No'}}}},
    {...input,configuration:{...input.configuration,branch:'different'}}])await assert.rejects(describeScopeOriginal(changed));
});
test('chunked scope envelope preserves large Unicode source bytes and binds order, count, owner and key',()=>{
  const key={keyId:'synthetic',bytes:randomBytes(32)},value={text:'فارسی 🌸\r\n'.repeat(50000)},binding='exact synthetic binding';
  assert.ok(Buffer.byteLength(JSON.stringify(value))>786432);
  const sealed=sealScopeOriginal(value,binding,key);assert.ok(sealed.chunks.length>1&&sealed.chunks.length<=8);
  assert.deepEqual(openScopeOriginal(sealed,binding,key),value);
  assert.equal(sealed.chunks.every(c=>JSON.stringify(c).length<500000),true);
  for(const changed of [{...sealed,chunks:[...sealed.chunks].reverse()},{...sealed,chunks:sealed.chunks.slice(0,-1)},
    {...sealed,chunks:[sealed.chunks[0],...sealed.chunks.slice(0,-1)]}])assert.throws(()=>openScopeOriginal(changed,binding,key));
  assert.throws(()=>openScopeOriginal(sealed,'different',key));assert.throws(()=>openScopeOriginal(sealed,binding,{...key,bytes:randomBytes(32)}));
  assert.throws(()=>sealScopeOriginal({text:'x'.repeat(scopeOriginalMaxBytes)},binding,key));
  assert.ok(key.bytes.some(b=>b!==0),'caller-owned key is not zeroed');
});
