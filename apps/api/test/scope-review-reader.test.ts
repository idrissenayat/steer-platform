import assert from 'node:assert/strict';
import test from 'node:test';
import {createVerifiedScopeReviewReader} from '../src/runtime.ts';
import {scopeReviewFixture} from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';

test('verified scope API composition is lazy, requires a strict current profile and has no gateway or dispatch inputs',async()=>{
  const f=await scopeReviewFixture();let sql=0;
  const pool={connect:async()=>{sql++;throw new Error('No SQL');}},pools={drafts:pool,execution:pool};
  const config={organizationId:f.scope.organizationId,subject:'human',productId:f.scope.productId,repository:f.scope.repository,branch:f.evidence.branch,configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
  const records={authorize:async()=>{},originals:{authorize:async()=>{},authorizeOriginal:async()=>{},authorizeReview:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('No key access');}}};
  const reader=createVerifiedScopeReviewReader(pools,config,{records,profile:f.profile});assert.deepEqual(Object.keys(reader),['scope','read','close']);assert.equal(sql,0);
  const input={organizationId:config.organizationId,productId:config.productId,repository:config.repository,reviewId:'00000000-0000-4000-8000-000000000241',preparationDigest:f.prepared.preparationDigest};
  for(const key of ['organizationId','productId','repository'])await assert.rejects(reader.read({...input,[key]:'foreign'},async()=>{}));
  await assert.rejects(reader.read(input,async()=>{throw new Error('Denied current identity');}));reader.close();await assert.rejects(reader.read(input,async()=>{}));assert.equal(sql,0);
  for(const profile of [{...f.profile,gatewayKey:'PRIVATE'},{...f.profile,allowedResponseModels:[]},{...f.profile,instructions:'changed'}])
    assert.throws(()=>createVerifiedScopeReviewReader(pools,config,{records,profile}));
});
