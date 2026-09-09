import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {developmentHistoryFixture} from './intent-development-history.fixture.ts';
import {verifyIntentDevelopmentHistoryOutput} from '../src/intent-development-history-contracts.ts';
import {intentDevelopmentReadOutputSchema} from '../src/intent-development-read-contracts.ts';
import {invokeTool,describeTools,createOpenApiDocument,type InvocationContext,type Principal} from '../src/index.ts';

test('development history projects a linked pair under a separate human query, never current candidates',async()=>{
  const f=await developmentHistoryFixture();let calls=0;
  const principal:Principal={organizationId:f.scope.organizationId,subject:'human',type:'human',hats:[],toolGrants:['intent.development.history'],expiresAt:new Date(Date.now()+60000).toISOString()};
  const context:InvocationContext={principal,now:new Date(),revalidate:async()=>principal,
    services:{intentDevelopmentHistoryReader:{scope:{...f.scope,subject:'human'},read:async(_input,current)=>{await current();calls++;return f.output;}}}};
  assert.deepEqual(await invokeTool('intent.development.history',f.readInput,context),f.output);assert.equal(calls,1);
  assert.equal(intentDevelopmentReadOutputSchema.safeParse(f.output).success,false);
  assert.equal(describeTools().find(t=>t.name==='intent.development.history')?.kind,'query');assert.ok(createOpenApiDocument().paths['/v1/tools/intent.development.history']);
  for(const patch of [{toolGrants:['intent.development.read']},{subject:'foreign'},{type:'agent'},{expiresAt:new Date(0).toISOString()}])
    await assert.rejects(invokeTool('intent.development.history',f.readInput,{...context,principal:{...principal,...patch}}));
  assert.equal(calls,1);
  for(const patch of [{operationId:randomUUID()},{productId:'foreign'},{inputDigest:'f'.repeat(64)}]){
    context.services!.intentDevelopmentHistoryReader!.read=async()=>({...f.output,...patch});await assert.rejects(invokeTool('intent.development.history',f.readInput,context));
  }
  context.services!.intentDevelopmentHistoryReader!.read=async()=>{principal.toolGrants=[];return f.output;};
  await assert.rejects(invokeTool('intent.development.history',f.readInput,context));
});
test('historical documents require exact result hashes, complete role linkage and explicit missing-state labels',async()=>{
  const f=await developmentHistoryFixture();
  for(const patch of [{historical:false},{savedToGit:true},{executionAuthorized:true},{semanticQualityVerified:true},{checkpoint:{}},{requestBody:'PRIVATE'},
    {status:'candidates-ready'},{results:[f.output.results[1]]},{results:f.output.results.slice().reverse()},
    {results:f.output.results.map(r=>({...r,outputDigest:'a'.repeat(64)}))},
    {results:f.output.results.map(r=>({...r,predecessorResultDigest:'b'.repeat(64)}))},
    {source:{...f.output.source,latestRevision:0}},{steps:f.pending.steps}])await assert.rejects(verifyIntentDevelopmentHistoryOutput({...f.output,...patch}));
  const partial={...f.output,status:'partial',results:f.output.results.slice(0,1),steps:[f.output.steps[0],{role:'test-agent',state:'pending'}]};
  assert.equal((await verifyIntentDevelopmentHistoryOutput(partial)).status,'partial');
  assert.equal((await verifyIntentDevelopmentHistoryOutput({...partial,status:'attention-required',steps:[f.output.steps[0],{role:'test-agent',state:'outcome-unknown'}]})).results.length,1);
  assert.equal((await verifyIntentDevelopmentHistoryOutput({...f.output,status:'pending',steps:f.pending.steps,results:[]})).results.length,0);
});
