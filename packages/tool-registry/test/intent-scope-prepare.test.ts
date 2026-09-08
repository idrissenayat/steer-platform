import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {invokeTool,ToolError,describeTools,createOpenApiDocument,type Principal,type InvocationContext} from '../src/index.ts';
import {intentScopePrepareInputSchema,intentScopePrepareOutputSchema,type IntentScopePreparer} from '../src/intent-scope-prepare-contracts.ts';

function fixture(){
  const input={organizationId:'org',productId:'product',repository:'github:52',configurationRevision:'r1',draftId:randomUUID(),revision:1,
    revisionDigest:'a'.repeat(64),scopeInputDigest:'b'.repeat(64),sourceSnapshotDigest:'c'.repeat(64)};
  const output={...input,kind:'steer-scope-prepare/v1',outcome:'prepared',reference:{reviewId:randomUUID(),preparationDigest:'d'.repeat(64)},
    coverage:{inventoryComplete:true,accessGapCount:0,inventoryCount:34,plannedCount:34,gapCount:0,batchCount:2,plannedComplete:true},
    originalPreserved:true,readyToRequestStart:true,modelCallsStarted:0,semanticReviewComplete:false,authoritativeClearance:false,executionAuthorized:false,savedToGit:false,gateSigned:false};
  const now=new Date(),principal:Principal={subject:'human',organizationId:'org',type:'human',hats:[],toolGrants:['intent.scope.prepare'],expiresAt:new Date(now.getTime()+60000).toISOString()};
  const state={calls:0,fresh:principal as unknown};
  const service:IntentScopePreparer={scope:{organizationId:'org',productId:'product',repository:'github:52',configurationRevision:'r1',subject:'human'},prepare:async(_input,current)=>{await current();state.calls++;return output;}};
  const context:InvocationContext={principal,now,clock:()=>now,revalidate:async()=>state.fresh,services:{intentScopePreparer:service}};
  return{input,output,now,principal,state,service,context};
}
test('scope preparation is an explicit human command exposed by the shared registry and OpenAPI',async()=>{
  const f=fixture();assert.deepEqual(await invokeTool('intent.scope.prepare',f.input,f.context),f.output);assert.equal(f.state.calls,1);
  const definition=describeTools().find(t=>t.name==='intent.scope.prepare');assert.equal(definition?.kind,'command');assert.equal(definition?.authorization,'explicit-tool-grant');
  assert.ok(createOpenApiDocument().paths['/v1/tools/intent.scope.prepare']);
  for(const field of ['originalText','documents','profile','budget','evidence','batchIds','reviewId','choice'])assert.equal(intentScopePrepareInputSchema.safeParse({...f.input,[field]:'PRIVATE'}).success,false);
});
test('scope preparation distinguishes partial reviewable evidence from empty or entirely unavailable sources',()=>{
  const f=fixture(),c=f.output.coverage,parse=(v:unknown)=>intentScopePrepareOutputSchema.safeParse(v).success;
  assert.ok(parse({...f.output,coverage:{...c,inventoryComplete:false,plannedComplete:false}}));
  const empty={...c,inventoryCount:0,plannedCount:0,batchCount:0};
  assert.ok(parse({...f.output,outcome:'no-sources',coverage:empty,reference:null,originalPreserved:false,readyToRequestStart:false}));
  for(const bad of [{coverage:{...c,batchCount:1}},{coverage:{...c,gapCount:1}},{reference:null},{modelCallsStarted:1},{authoritativeClearance:true},
    {outcome:'no-sources'},{outcome:'scope-incomplete'},{outcome:'unknown',originalPreserved:true},{secret:'PRIVATE'}])assert.equal(parse({...f.output,...bad}),false);
});
test('scope preparation denies absent or changed human grants and foreign scope before admission',async()=>{
  const f=fixture(),{revalidate:_unused,...noRevalidation}=f.context;
  for(const context of [noRevalidation,{...f.context,services:{}},{...f.context,principal:{...f.principal,toolGrants:[]}},
    {...f.context,principal:{...f.principal,type:'agent'}},{...f.context,principal:{...f.principal,expiresAt:f.now.toISOString()}}])await assert.rejects(invokeTool('intent.scope.prepare',f.input,context),ToolError);
  for(const key of ['organizationId','productId','repository','configurationRevision'])await assert.rejects(invokeTool('intent.scope.prepare',{...f.input,[key]:'foreign'},f.context),ToolError);
  f.state.fresh={...f.principal,subject:'foreign'};await assert.rejects(invokeTool('intent.scope.prepare',f.input,f.context),ToolError);assert.equal(f.state.calls,0);
});
test('scope preparation suppresses receipts on late authority loss and redacts malformed or private service output',async()=>{
  for(const patch of [null,{subject:'other'},{toolGrants:[]},{expiresAt:new Date(0).toISOString()}]){
    const f=fixture();f.service.prepare=async()=>{f.state.fresh=patch===null?null:{...f.principal,...patch};return f.output;};await assert.rejects(invokeTool('intent.scope.prepare',f.input,f.context),ToolError);
  }
  const f=fixture();for(const patch of [{draftId:randomUUID()},{revision:2},{scopeInputDigest:'f'.repeat(64)},{sourceSnapshotDigest:'f'.repeat(64)},
    {reference:{...f.output.reference,secret:'PRIVATE'}},{executionAuthorized:true},{documents:'PRIVATE'}]){
    f.service.prepare=async()=>({...f.output,...patch});await assert.rejects(invokeTool('intent.scope.prepare',f.input,f.context),ToolError);
  }
  f.service.prepare=async()=>{throw new Error('PRIVATE');};await assert.rejects(invokeTool('intent.scope.prepare',f.input,f.context),{message:'The required service is not configured or available.'});
});
