import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { scopeReviewFixture } from './intent-scope-review.fixture.ts';
import { validateIntentScopeBatchResults } from '../src/intent-scope-batches.ts';
import { verifyIntentScopeHistoryOutput } from '../src/intent-scope-history-contracts.ts';
import { intentScopeReadOutputSchema } from '../src/intent-scope-read-contracts.ts';
import { invokeTool, describeTools, createOpenApiDocument, type InvocationContext, type Principal } from '../src/index.ts';

async function fixture() {
  const f = await scopeReviewFixture(), input = { organizationId:f.scope.organizationId,productId:f.scope.productId,repository:f.scope.repository,
    reviewId:randomUUID(),preparationDigest:f.prepared.preparationDigest };
  const review = await validateIntentScopeBatchResults(f.evidence,f.prepared.batches.map(b=>({planDigest:f.prepared.plan.planDigest,batchId:b.metadata.batchId,assessment:f.result(b)})),f.profile.profileRevision);
  const output = await verifyIntentScopeHistoryOutput({ ...input, kind:'steer-scope-review-history/v1',subject:'human',historical:true,reviewExpired:true,
    source:{draftId:f.scope.draftId,revision:1,revisionDigest:'b'.repeat(64),scopeInputDigest:f.prepared.plan.scopeInputDigest,latestRevision:2},
    head:f.evidence.head,sourceSnapshotDigest:f.prepared.plan.sourceSnapshotDigest,inventory:f.evidence.inventory,review,
    batches:f.prepared.batches.map(b=>({batchId:b.metadata.batchId,state:'succeeded',resultDigest:'c'.repeat(64)})),
    semanticQualityVerified:false,authoritativeClearance:false,savedToGit:false,gateSigned:false,executionAuthorized:false,retryAuthorized:false });
  const principal:Principal={subject:'human',organizationId:input.organizationId,type:'human',hats:[],toolGrants:['intent.scope.history'],expiresAt:new Date(Date.now()+60000).toISOString()};
  const state={principal:principal as unknown,calls:0};
  const service={scope:{organizationId:input.organizationId,productId:input.productId,repository:input.repository,subject:principal.subject},
    read:async(_input:unknown,current:()=>Promise<void>):Promise<unknown>=>{await current();state.calls++;return output;}};
  const context:InvocationContext={principal,now:new Date(),revalidate:async()=>state.principal,services:{intentScopeHistoryReader:service}};
  return {f,input,output,principal,state,service,context};
}
test('historical scope is a distinct human query and cannot satisfy the current assessment contract',async()=>{
  const f=await fixture();assert.deepEqual(await invokeTool('intent.scope.history',f.input,f.context),f.output);
  assert.equal(intentScopeReadOutputSchema.safeParse(f.output).success,false);assert.equal(f.state.calls,1);
  assert.equal(describeTools().find(t=>t.name==='intent.scope.history')?.kind,'query');assert.ok(createOpenApiDocument().paths['/v1/tools/intent.scope.history']);
});
test('history rejects changed evidence, unbound sources, forged flags and current workflow outputs',async()=>{
  const f=await fixture();
  for(const patch of [{historical:false},{kind:'steer-scope-review-read/v1'},{checkpoint:{}},{authoritativeClearance:true},{executionAuthorized:true},
    {inventory:[]},{inventory:[...f.output.inventory,f.output.inventory[0]]},{review:{...f.output.review,resultsDigest:'f'.repeat(64)}},
    {source:{...f.output.source,latestRevision:0}},{batches:f.output.batches.map(b=>({...b,state:'pending'}))}])
    await assert.rejects(verifyIntentScopeHistoryOutput({...f.output,...patch}));
  for(const patch of [{subject:'foreign'},{reviewId:randomUUID()},{productId:'foreign'}]){
    f.service.read=async()=>({...f.output,...patch});await assert.rejects(invokeTool('intent.scope.history',f.input,f.context));
  }
});
test('history requires its own present human grant and suppresses replies on late authority loss',async()=>{
  const f=await fixture();
  for(const patch of [{toolGrants:['intent.scope.read']},{type:'agent'},{subject:'foreign'},{expiresAt:new Date(0).toISOString()}])
    await assert.rejects(invokeTool('intent.scope.history',f.input,{...f.context,principal:{...f.principal,...patch}}));
  assert.equal(f.state.calls,0);
  f.service.read=async()=>{f.state.principal={...f.principal,toolGrants:[]};return f.output;};
  await assert.rejects(invokeTool('intent.scope.history',f.input,f.context));
});
