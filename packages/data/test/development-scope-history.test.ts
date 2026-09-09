import assert from 'node:assert/strict';
import test from 'node:test';
import {scopeReviewFixture} from '../../tool-registry/test/intent-scope-review.fixture.ts';
import {validateIntentScopeBatchResults} from '@steer/tool-registry/intent-scope-batches';
import {verifyIntentScopeHistoryOutput,type IntentScopeHistoryReader} from '@steer/tool-registry/intent-scope-history-contracts';
import {describeDevelopmentOriginal} from '../src/development-original-contracts.ts';
import {verifyHistoricalDevelopmentScopeReview,revalidateDevelopmentScopeReview} from '../src/development-scope-review.ts';
import {originalFixture} from './development-original.fixture.ts';

async function fixture(count=4) {
  const f=await scopeReviewFixture(count),c={organizationId:f.scope.organizationId,subject:'human',productId:f.scope.productId,repository:f.scope.repository,
    branch:f.evidence.branch,configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64),action:'develop',expiresAt:'2026-09-08T00:00:00.000Z',
    budget:{organizationId:f.scope.organizationId,subject:'human',configurationRevision:'r1',budgetId:'00000000-0000-4000-8000-000000000256',
      approvalDigest:'b'.repeat(64),capMicrousd:5,architectMicrousd:3,testAgentMicrousd:2}};
  const source={draftId:f.scope.draftId,revision:1,sourceRevision:1,revisionDigest:'c'.repeat(64),content:{originalText:f.scope.originalText,
    clarificationTurns:f.scope.clarificationTurns,documents:{...f.scope.documents,exam:'Prior human draft, not agent authorship'}}};
  const base=await originalFixture(c,source),review=await validateIntentScopeBatchResults(f.evidence,f.prepared.batches.map(b=>({
    planDigest:f.prepared.plan.planDigest,batchId:b.metadata.batchId,assessment:f.result(b)})),f.profile.profileRevision);
  const bound=count?{kind:'recorded',reviewId:'00000000-0000-4000-8000-000000000255',preparationDigest:f.prepared.preparationDigest,results:review}
    :{kind:'empty-corpus',planDigest:f.prepared.plan.planDigest};
  const original=(await describeDevelopmentOriginal({...base.original,evidence:f.evidence,direction:{...base.original.direction,
    sourceSnapshotDigest:f.prepared.plan.sourceSnapshotDigest,scopeReview:bound}})).original;
  const output=count?await verifyIntentScopeHistoryOutput({organizationId:c.organizationId,subject:c.subject,productId:c.productId,repository:c.repository,
    reviewId:bound.reviewId,preparationDigest:bound.preparationDigest,kind:'steer-scope-review-history/v1',historical:true,reviewExpired:true,
    source:{draftId:source.draftId,revision:1,revisionDigest:source.revisionDigest,scopeInputDigest:original.source.scopeInputDigest,latestRevision:2},
    head:f.evidence.head,sourceSnapshotDigest:f.prepared.plan.sourceSnapshotDigest,inventory:f.evidence.inventory,review,
    batches:f.prepared.batches.map(b=>({batchId:b.metadata.batchId,state:'succeeded',resultDigest:'d'.repeat(64)})),
    semanticQualityVerified:false,authoritativeClearance:false,savedToGit:false,gateSigned:false,executionAuthorized:false,retryAuthorized:false}):null;
  const state={calls:0,current:0};const reader:IntentScopeHistoryReader={scope:{organizationId:c.organizationId,subject:c.subject,productId:c.productId,repository:c.repository},
    read:async(_input,current)=>{state.calls++;await current();return output;}};
  const current=async()=>{state.current++;};
  return{f,original,output,reader,state,current};
}
test('historical generation scope verifies exact retained assessment after expiry/new edits but cannot enter current-only admission',async()=>{
  const f=await fixture();assert.equal(await verifyHistoricalDevelopmentScopeReview(f.original,f.reader,f.current),undefined);assert.equal(f.state.calls,1);
  await assert.rejects(revalidateDevelopmentScopeReview(f.original,f.reader,f.current));
  await assert.rejects(verifyHistoricalDevelopmentScopeReview(f.original,undefined,f.current));
  assert.equal(f.original.source.revision,1);assert.equal(f.original.direction.scopeReview?.kind,'recorded');
});
test('historical generation scope refuses changed owner, revision, inventory, source snapshot or captured findings',async()=>{
  const f=await fixture();assert.ok(f.output);
  for(const patch of [{subject:'foreign'},{repository:'github:other'},{reviewId:f.original.source.draftId},
    {preparationDigest:'f'.repeat(64)},{head:'f'.repeat(40)},{sourceSnapshotDigest:'f'.repeat(64)},
    {source:{...f.output.source,revisionDigest:'f'.repeat(64)}},{source:{...f.output.source,scopeInputDigest:'f'.repeat(64)}},
    {inventory:f.output.inventory.map((s,n)=>n? s:{...s,contentDigest:'f'.repeat(64)})},{review:{...f.output.review,resultsDigest:'f'.repeat(64)}}]){
    await assert.rejects(verifyHistoricalDevelopmentScopeReview(f.original,{...f.reader,read:async()=>({...f.output,...patch})},f.current));
  }
  for(const scope of [{...f.reader.scope,subject:'foreign'},{...f.reader.scope,productId:'foreign'}])
    await assert.rejects(verifyHistoricalDevelopmentScopeReview(f.original,{...f.reader,scope},f.current));
});
test('historical generation scope requires complete captured assessments and present authority, never invents legacy or empty-corpus model evidence',async()=>{
  const f=await fixture(),empty=await fixture(0);
  assert.equal(await verifyHistoricalDevelopmentScopeReview(empty.original,undefined,empty.current),undefined);assert.equal(empty.state.calls,0);
  const {scopeReview:_scope,...direction}=f.original.direction;
  assert.equal(await verifyHistoricalDevelopmentScopeReview({...f.original,direction},undefined,f.current),undefined);
  await assert.rejects(verifyHistoricalDevelopmentScopeReview(empty.original,undefined,async()=>true as any));
  let allowed=true;await assert.rejects(verifyHistoricalDevelopmentScopeReview(f.original,{...f.reader,read:async()=>{allowed=false;return f.output;}},async()=>{if(!allowed)throw new Error('Revoked');}));
  await assert.rejects(verifyHistoricalDevelopmentScopeReview({...empty.original,evidence:{...empty.original.evidence,inventoryComplete:false}},undefined,empty.current));
  const partial={...f.original,direction:{...f.original.direction,scopeReview:{...f.original.direction.scopeReview!,results:{...f.output!.review,structuralAssessmentComplete:false}}}};
  await assert.rejects(verifyHistoricalDevelopmentScopeReview(partial as any,f.reader,f.current));
});
