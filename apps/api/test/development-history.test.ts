import assert from 'node:assert/strict';
import test from 'node:test';
import {developmentHistoryFixture} from '../../../packages/tool-registry/test/intent-development-history.fixture.ts';
import {createIntentDevelopmentHistoryReader} from '@steer/data/intent-development-history-reader';
import {createApi} from '../src/app.ts';
import {createMcpEndpoint,mcpProtocolVersion} from '../src/mcp.ts';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import { createVerifiedDevelopmentHistoryReader } from '../src/runtime.ts';
import { intentJourneyFactoryFixture } from './intent-journey-factory.fixture.ts';
import { ownedDevelopmentReadFixture, ownedScopeReadFixture } from './owned-scope-read.fixture.ts';

test('owned history is explicit and lazy; invalid binding never falls back and cancelled callers retain admission until drain', async () => {
  const f=intentJourneyFactoryFixture(),records=f.deps.development.history,config={...f.expected};
  delete (config as Partial<typeof config>).itemIds;
  let sql=0; const pool={connect:async()=>{sql++;throw new Error('PRIVATE unexpected SQL');}};
  const pools={drafts:pool,execution:{...pool}},dependencies={records,profiles:f.config.developmentProfiles};
  for(const ownedRead of [null,{}, {authority:{},keys:{},scope:{}}])
    assert.throws(()=>createVerifiedDevelopmentHistoryReader(pools,config,{...dependencies,ownedRead:ownedRead as any}));
  const reader=createVerifiedDevelopmentHistoryReader(pools,config,{...dependencies,ownedRead:{
    ...ownedDevelopmentReadFixture(f.config.development.budget!.budgetId,records.originals.keyForDraft),
    scope:{records:f.deps.scope.history,profile:f.config.scopeProfile,
      ownedRead:ownedScopeReadFixture(f.config.scope.budget.budgetId,records.originals.keyForDraft)}}});
  const input={organizationId:f.expected.organizationId,productId:f.expected.productId,repository:f.expected.repository,
    operationId:'00000000-0000-4000-8000-000000000001',inputDigest:'a'.repeat(64)};
  await assert.rejects(reader.read({...input,productId:'foreign'},async()=>{}));assert.equal(sql,0);
  let release=()=>{},entered=0,drained=false;const held=new Promise<void>(resolve=>{release=resolve;});
  const calls=Array.from({length:4},()=>reader.read(input,async()=>{entered++;await held;}));
  const rejected=calls.map(call=>assert.rejects(call));
  try {
    await new Promise(resolve=>setImmediate(resolve));assert.equal(entered,4);
    await assert.rejects(reader.read(input,async()=>{}));reader.close();await Promise.all(rejected);
    const stopped=reader.shutdown!().then(()=>{drained=true;});await new Promise(resolve=>setImmediate(resolve));
    assert.equal(drained,false);assert.equal(sql,0);release();await stopped;assert.equal(drained,true);assert.equal(sql,0);
  } finally {release();await reader.shutdown!();await Promise.all(rejected);}
});

test('combined generation history is lazy, requires separate records authorities and drains closed reads without late SQL',async()=>{
  const f=await developmentHistoryFixture();let sql=0,calls=0;const pool={connect:async()=>{sql++;throw new Error('No SQL');}};
  const config={...f.scope,subject:'human',branch:'codex/synthetic',configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
  const authorize=async()=>{},keyForDraft=async()=>{throw new Error('No key');};
  const records={authorize,authorizeHistoricalRead:authorize,verifyHistoricalExchange:authorize,
    originals:{authorize,authorizeOriginal:authorize,authorizeOperation:authorize,authorizeHistoricalRead:authorize,authorizeDraft:authorize,keyForDraft},
    results:{authorizeOperation:authorize,authorizeResult:authorize,authorizeHistoricalResult:authorize,authorizeDraft:authorize,keyForDraft}};
  const {verifyHistoricalExchange:_verifier,...missingVerifier}=records;
  assert.throws(()=>createIntentDevelopmentHistoryReader({drafts:pool,execution:pool},config,missingVerifier));
  const reader=createIntentDevelopmentHistoryReader({drafts:pool,execution:pool},config,records);assert.deepEqual(Object.keys(reader),['scope','read','close']);
  await assert.rejects(reader.read({...f.readInput,productId:'foreign'},authorize));await assert.rejects(reader.read(f.readInput,async()=>true as any));assert.equal(sql,0);
  let release!:()=>void;const held=new Promise<void>(r=>{release=r;});
  const pending=Array.from({length:4},()=>reader.read(f.readInput,async()=>{calls++;await held;}));await new Promise(r=>setImmediate(r));
  await assert.rejects(reader.read(f.readInput,authorize));assert.equal(calls,4);reader.close();release();await Promise.all(pending.map(p=>assert.rejects(p)));assert.equal(sql,0);
});
test('original generation history shares one no-store human HTTP and MCP contract without model or execution access',async()=>{
  const f=await developmentHistoryFixture(),principal={organizationId:f.scope.organizationId,subject:'human',type:'human',hats:[],toolGrants:['intent.development.history'],expiresAt:new Date(Date.now()+60000).toISOString()};
  const dependencies={authenticate:async()=>principal,services:{intentDevelopmentHistoryReader:{scope:{...f.scope,subject:'human'},read:async(_input:unknown,current:()=>Promise<void>)=>{await current();return f.output;}}}};
  const app=createApi(dependencies),endpoint=createMcpEndpoint('https://steer.test',dependencies);
  const client=new Client({name:'synthetic-development-history',version:'1'},{versionNegotiation:{mode:{pin:mcpProtocolVersion}}});
  try{
    const response=await app.request('/v1/tools/intent.development.history',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f.readInput)});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),f.output);
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'),{protocolVersion:mcpProtocolVersion,
      requestInit:{headers:{authorization:'Bearer synthetic'}},fetch:(url,init)=>endpoint.fetch(new Request(url,init))}));
    assert.equal((await client.listTools()).tools.find(t=>t.name==='intent.development.history')?.annotations?.readOnlyHint,true);
    const result=await client.callTool({name:'intent.development.history',arguments:f.readInput});assert.ok(!result.isError);assert.deepEqual(result.structuredContent,{result:f.output});
    principal.toolGrants=[];assert.equal((await client.callTool({name:'intent.development.history',arguments:f.readInput})).isError,true);
  }finally{await client.close();await endpoint.shutdown();}
});
