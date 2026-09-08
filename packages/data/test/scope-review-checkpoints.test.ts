import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {describeScopeReviewCheckpoint,scopeCheckpointReferenceSchema,scopeReviewConfigurationSchema} from '../src/scope-review-operations.ts';
import {createScopeReviewCheckpointVerifier} from '../src/scope-review-checkpoints.ts';

test('scope checkpoint references bind the exact response, execution, owner and records without accepting private or authority fields',async()=>{
  const records={organizationId:'synthetic-org',subject:'synthetic-human',productId:'synthetic-product',repository:'github:52',branch:'codex/synthetic',
    configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
  const config=scopeReviewConfigurationSchema.parse({...records,expiresAt:new Date(Date.now()+60000).toISOString(),
    budget:{organizationId:records.organizationId,subject:records.subject,configurationRevision:'r1',budgetId:randomUUID(),approvalDigest:'b'.repeat(64),capMicrousd:10,architectMicrousd:2,testAgentMicrousd:2},
    scopeTerms:{approvalDigest:'c'.repeat(64),profileDigest:'d'.repeat(64),amountMicrousd:3}});
  const record={binding:{organizationId:records.organizationId,subject:records.subject,operationId:randomUUID(),stepId:'1'.repeat(64),draftId:randomUUID(),draftRevision:1,inputDigest:'2'.repeat(64),configurationRevision:'r1'},
    owner:'synthetic-worker',fencingToken:1,reservationId:randomUUID(),state:'dispatch-committed' as const,leaseUntil:null,updatedAt:1,resultDigest:null};
  const ref=describeScopeReviewCheckpoint(config,'3'.repeat(64),record,'4'.repeat(64));
  assert.equal(ref.resultDigest,'4'.repeat(64));assert.equal(ref.owner,record.owner);assert.equal(ref.recordsPolicyDigest,records.recordsPolicyDigest);
  assert.ok(Object.isFrozen(ref)&&Object.isFrozen(ref.binding));assert.equal('state' in ref,false);assert.equal('expiresAt' in ref,false);
  for(const changed of [{...ref,approved:true},{...ref,resultDigest:'bad'},{...ref,responseBody:'Private text'},
    {...ref,binding:{...ref.binding,productId:'injected'}},{...ref,fencingToken:0}])assert.equal(scopeCheckpointReferenceSchema.safeParse(changed).success,false);
  const revised=describeScopeReviewCheckpoint({...config,scopeTerms:{...config.scopeTerms,amountMicrousd:4}},ref.preparationDigest,record,ref.resultDigest);
  assert.notEqual(revised.configurationDigest,ref.configurationDigest);
  let connections=0;
  const pool={connect:async()=>{connections++;throw new Error('Private connection detail');}};
  const verify=createScopeReviewCheckpointVerifier({drafts:pool,execution:pool},records,{authorize:async()=>{throw new Error('Private denial');},
    verifyObservation:async()=>{},originals:{authorize:async()=>{},authorizeOriginal:async()=>{},authorizeReview:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('Unexpected key');}}});
  assert.equal(connections,0);await assert.rejects(verify(ref),{message:'Draft storage is unavailable.'});assert.equal(connections,0);
  await assert.rejects(verify({...ref,resultDigest:'bad'}),{message:'Draft storage is unavailable.'});assert.equal(connections,0);
});
