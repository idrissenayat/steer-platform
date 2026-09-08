import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {invokeTool,ToolError,describeTools,createOpenApiDocument,type Principal,type InvocationContext} from '../src/index.ts';
import {intentScopeReadOutputSchema,verifyIntentScopeReadOutput,type IntentScopeReader} from '../src/intent-scope-read-contracts.ts';
import {validateIntentScopeBatchResults,verifyIntentScopeBatchResults} from '../src/intent-scope-batches.ts';
import {scopeReviewFixture} from './intent-scope-review.fixture.ts';

async function fixture(complete=false){
  const f=await scopeReviewFixture(),scope={organizationId:f.scope.organizationId,productId:f.scope.productId,repository:f.scope.repository};
  const input={...scope,reviewId:randomUUID(),preparationDigest:f.prepared.preparationDigest};
  const review=await validateIntentScopeBatchResults(f.evidence,complete?f.prepared.batches.map(b=>({planDigest:f.prepared.plan.planDigest,batchId:b.metadata.batchId,assessment:f.result(b)})):[],f.profile.profileRevision);
  const output={...input,kind:'steer-scope-review-read/v1',subject:'human',source:{draftId:f.scope.draftId,revision:1,revisionDigest:'b'.repeat(64),scopeInputDigest:f.prepared.plan.scopeInputDigest,latestRevision:1},
    status:complete?'review-available':'pending',batches:f.prepared.batches.map(b=>({batchId:b.metadata.batchId,state:complete?'succeeded':'pending',resultDigest:complete?'c'.repeat(64):null})),review,
    semanticQualityVerified:false,authoritativeClearance:false,savedToGit:false,gateSigned:false,executionAuthorized:false,retryAuthorized:false};
  const now=new Date(),principal:Principal={subject:'human',organizationId:scope.organizationId,type:'human',hats:[],toolGrants:['intent.scope.read'],expiresAt:new Date(now.getTime()+60000).toISOString()};
  const state={calls:0,fresh:principal as unknown};
  const service:IntentScopeReader={scope:{...scope,subject:principal.subject},read:async(_input,current)=>{await current();state.calls++;return output;}};
  const context:InvocationContext={principal,now,clock:()=>now,revalidate:async()=>state.fresh,services:{intentScopeReader:service}};
  return{...f,scope,input,output,now,principal,state,service,context};
}
test('scope read is a shared explicit human query with portable pending and complete result contracts',async()=>{
  for(const complete of [false,true]){const f=await fixture(complete);assert.deepEqual(await invokeTool('intent.scope.read',f.input,f.context),f.output);
    assert.deepEqual(await verifyIntentScopeReadOutput(f.output),f.output);assert.equal(f.state.calls,1);}
  const definition=describeTools().find(t=>t.name==='intent.scope.read');assert.equal(definition?.kind,'query');assert.equal(definition?.authorization,'explicit-tool-grant');
  assert.ok(createOpenApiDocument().paths['/v1/tools/intent.scope.read']);
});
test('scope query refuses missing grants, agent identity, expired sessions and wrong owner or scope before reading',async()=>{
  const f=await fixture(),{revalidate:_unused,...noRevalidation}=f.context;
  for(const context of [noRevalidation,{...f.context,services:{}},{...f.context,principal:{...f.principal,toolGrants:[]}},
    {...f.context,principal:{...f.principal,type:'agent'}},{...f.context,principal:{...f.principal,expiresAt:f.now.toISOString()}}])await assert.rejects(invokeTool('intent.scope.read',f.input,context),ToolError);
  for(const key of ['organizationId','productId','repository'])await assert.rejects(invokeTool('intent.scope.read',{...f.input,[key]:'foreign'},f.context),ToolError);
  f.state.fresh={...f.principal,subject:'foreign'};await assert.rejects(invokeTool('intent.scope.read',f.input,f.context),ToolError);assert.equal(f.state.calls,0);
});
test('current grant and identity loss after awaited scope reads suppress all findings',async()=>{
  for(const patch of [null,{subject:'other'},{toolGrants:[]},{expiresAt:new Date(0).toISOString()}]){
    const f=await fixture(true);f.service.read=async()=>{f.state.fresh=patch===null?null:{...f.principal,...patch};return f.output;};
    await assert.rejects(invokeTool('intent.scope.read',f.input,f.context),ToolError);
  }
});
test('foreign response bindings, secret fields, false readiness and changed combined digests never leave scope query',async()=>{
  const f=await fixture();
  for(const patch of [{subject:'foreign'},{organizationId:'foreign'},{productId:'foreign'},{repository:'other'},
    {reviewId:randomUUID()},{preparationDigest:'d'.repeat(64)},{status:'review-available'},{authoritativeClearance:true},{providerKey:'PRIVATE'},
    {review:{...f.output.review,resultsDigest:'f'.repeat(64)}}]){f.service.read=async()=>({...f.output,...patch});await assert.rejects(invokeTool('intent.scope.read',f.input,f.context),ToolError);}
  f.service.read=async()=>{throw new Error('PRIVATE provider failure');};await assert.rejects(invokeTool('intent.scope.read',f.input,f.context),{message:'The required service is not configured or available.'});
});
test('scope output cross-checks checkpoint states, pending/result IDs, expiry, supersession and authority flags',async()=>{
  const f=await fixture(true),full=f.output;
  assert.ok(intentScopeReadOutputSchema.safeParse({...full,status:'superseded',source:{...full.source,latestRevision:2}}).success);
  assert.ok(intentScopeReadOutputSchema.safeParse({...full,status:'expired',batches:null,review:null}).success);
  for(const bad of [{...full,status:'expired'},{...full,status:'pending'},{...full,retryAuthorized:true},
    {...full,batches:[{...full.batches[0],resultDigest:null}]},{...full,batches:[...full.batches,...full.batches]},
    {...full,batches:[{...full.batches[0],batchId:'f'.repeat(64)}]},{...full,source:{...full.source,latestRevision:0}},
    {...full,review:{...full.review,pendingBatchIds:[full.batches[0]!.batchId]}}])assert.equal(intentScopeReadOutputSchema.safeParse(bad).success,false);
});
test('portable combined-result verification detects altered citations, duplicate sources, coverage claims and digest changes',async()=>{
  const f=await fixture(true);assert.deepEqual(await verifyIntentScopeBatchResults(f.output.review),f.output.review);
  for(const mutate of [(v:any)=>{v.resultsDigest='f'.repeat(64);},(v:any)=>{v.coverage.plannedCount=0;},(v:any)=>{v.coverage.inventoryComplete=false;},
    (v:any)=>{v.results[0].findings[0].citations[0].quote+='invented';},(v:any)=>{v.results[0].findings[0].assessedSourceIds.push(v.results[0].findings[0].assessedSourceIds[0]);},
    (v:any)=>{v.results[0].findings=[];},(v:any)=>{v.semanticQualityVerified=true;}]){
    const changed=structuredClone(f.output.review);mutate(changed);await assert.rejects(verifyIntentScopeBatchResults(changed));
  }
});
