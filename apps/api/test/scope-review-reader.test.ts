import assert from 'node:assert/strict';
import test from 'node:test';
import {createVerifiedScopeReviewReader,createVerifiedScopeReviewHistoryReader} from '../src/runtime.ts';
import {scopeReviewFixture} from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import {validateIntentScopeBatchResults} from '@steer/tool-registry/intent-scope-batches';
import {createApi} from '../src/app.ts';
import {createMcpEndpoint,mcpProtocolVersion} from '../src/mcp.ts';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';

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

test('historical scope API composition needs independent present records authority, no key or live model, and retains bounded pending reads',async()=>{
  const f=await scopeReviewFixture();let connections=0;const pool={connect:async()=>{connections++;throw new Error('No SQL');}};
  const config={organizationId:f.scope.organizationId,subject:'human',productId:f.scope.productId,repository:f.scope.repository,branch:f.evidence.branch,configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
  const records={authorize:async()=>{throw new Error('No current workflow access');},authorizeHistoricalRead:async()=>{},authorizeHistoricalReview:async()=>{},
    originals:{authorize:async()=>{},authorizeOriginal:async()=>{},authorizeReview:async()=>{throw new Error('No execution authority');},
      authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('No key access');}}};
  assert.throws(()=>createVerifiedScopeReviewHistoryReader({drafts:pool,execution:pool},config,{records:{...records,authorizeHistoricalRead:undefined as any},profile:f.profile}));
  const reader=createVerifiedScopeReviewHistoryReader({drafts:pool,execution:pool},config,{records,profile:f.profile});assert.deepEqual(Object.keys(reader),['scope','read','close']);
  const input={organizationId:config.organizationId,productId:config.productId,repository:config.repository,reviewId:'00000000-0000-4000-8000-000000000255',preparationDigest:f.prepared.preparationDigest};
  await assert.rejects(reader.read({...input,productId:'foreign'},async()=>{}));assert.equal(connections,0);
  let release!:()=>void,calls=0;const held=new Promise<void>(r=>{release=r;});
  const pending=Array.from({length:4},()=>reader.read(input,async()=>{calls++;await held;}));
  await new Promise(r=>setImmediate(r));await assert.rejects(reader.read(input,async()=>{}));assert.equal(calls,4);
  reader.close();release();await Promise.all(pending.map(p=>assert.rejects(p)));assert.equal(connections,0);
});

test('historical scope uses the same authenticated HTTP and MCP query with inert expired partial evidence',async()=>{
  const f=await scopeReviewFixture(),scope={organizationId:f.scope.organizationId,subject:'human',productId:f.scope.productId,repository:f.scope.repository};
  const input={organizationId:scope.organizationId,productId:scope.productId,repository:scope.repository,
    reviewId:'00000000-0000-4000-8000-000000000255',preparationDigest:f.prepared.preparationDigest};
  const output={...input,subject:scope.subject,kind:'steer-scope-review-history/v1',historical:true,reviewExpired:true,
    source:{draftId:f.scope.draftId,revision:1,revisionDigest:'b'.repeat(64),scopeInputDigest:f.prepared.plan.scopeInputDigest,latestRevision:2},
    head:f.evidence.head,sourceSnapshotDigest:f.prepared.plan.sourceSnapshotDigest,inventory:f.evidence.inventory,
    batches:f.prepared.batches.map(b=>({batchId:b.metadata.batchId,state:'pending',resultDigest:null})),
    review:await validateIntentScopeBatchResults(f.evidence,[],f.profile.profileRevision),
    semanticQualityVerified:false,authoritativeClearance:false,savedToGit:false,gateSigned:false,executionAuthorized:false,retryAuthorized:false};
  const principal={organizationId:scope.organizationId,subject:scope.subject,type:'human',hats:[],toolGrants:['intent.scope.history'],expiresAt:new Date(Date.now()+60000).toISOString()};
  const dependencies={authenticate:async()=>principal,services:{intentScopeHistoryReader:{scope,read:async(_input:unknown,current:()=>Promise<void>)=>{await current();return output;}}}};
  const app=createApi(dependencies),endpoint=createMcpEndpoint('https://steer.test',dependencies);
  const client=new Client({name:'synthetic-history',version:'1'},{versionNegotiation:{mode:{pin:mcpProtocolVersion}}});
  try {
    const response=await app.request('/v1/tools/intent.scope.history',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),output);
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'),{protocolVersion:mcpProtocolVersion,
      requestInit:{headers:{authorization:'Bearer synthetic'}},fetch:(url,init)=>endpoint.fetch(new Request(url,init))}));
    assert.equal((await client.listTools()).tools.find(t=>t.name==='intent.scope.history')?.annotations?.readOnlyHint,true);
    const result=await client.callTool({name:'intent.scope.history',arguments:input});assert.ok(!result.isError);assert.deepEqual(result.structuredContent,{result:output});
    principal.toolGrants=[];assert.equal((await client.callTool({name:'intent.scope.history',arguments:input})).isError,true);
  } finally {await client.close();await endpoint.shutdown();}
});
