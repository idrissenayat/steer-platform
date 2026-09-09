import test from 'node:test';
import assert from 'node:assert/strict';
import { originalFixture } from './development-original.fixture.ts';
import { describeDevelopmentOriginal } from '../src/development-original-contracts.ts';
import { createDevelopmentOriginalStore } from '../src/development-originals.ts';
const config={ organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64) };
const execution={ ...config,action:'develop',expiresAt:'2026-09-08T12:00:00.000Z',budget:{ organizationId:'org',subject:'human',configurationRevision:'r1',
  budgetId:'00000000-0000-4000-8000-000000000219',approvalDigest:'b'.repeat(64),capMicrousd:5,architectMicrousd:3,testAgentMicrousd:2 } };
const source={ draftId:'00000000-0000-4000-8000-000000000219',revision:1,sourceRevision:1,revisionDigest:'c'.repeat(64),
  content:{ originalText:' Original 🌸\r\n ',clarificationTurns:[' Exact reply '],documents:null } };
test('original input digest binds exact source, evidence, direction, both prompts and the original nonsecret execution profile',async()=>{
  const d=await originalFixture(execution,source);
  assert.equal(d.authoritativeClearance,false); assert.equal(d.executionAuthorized,false); assert.equal(d.evidence.coverage.complete,false);
  assert.deepEqual((await describeDevelopmentOriginal(JSON.parse(JSON.stringify(d.original)))).original,d.original);
  for (const role of ['architect','testAgent'] as const) {
    const changed=structuredClone(d.original); changed.profiles[role].instructions+=' ';
    assert.notEqual((await describeDevelopmentOriginal(changed)).inputDigest,d.inputDigest);
  }
  const changed=structuredClone(d.original); changed.configuration.expiresAt='2026-09-08T13:00:00.000Z';
  assert.notEqual((await describeDevelopmentOriginal(changed)).inputDigest,d.inputDigest);
  assert.ok(Object.isFrozen(d.original.profiles.architect)); assert.equal(d.original.source.content.originalText,source.content.originalText);
});
test('tampered evidence, source scope, stale direction, foreign corpus, secret fields and broken Unicode fail before storage',async()=>{
  const d=await originalFixture(execution,source);
  const mutations:Array<(v:any)=>void>=[v=>{v.evidence.documents[0].content+='tampered';},v=>{v.source.content.originalText+='changed';},
    v=>{v.direction.sourceSnapshotDigest='f'.repeat(64);},v=>{v.evidence.productId='foreign';},
    v=>{v.profiles.architect.apiKey='private-marker';},v=>{v.profiles.architect.instructions='\ud800';},
    v=>{v.source.sourceRevision=2;},v=>{v.direction.choice={action:'new-linked',reason:'synthetic',target:{path:'intent/0001/BRIEF.md',revision:'a'.repeat(40),contentDigest:'b'.repeat(64)}};}];
  for (const mutate of mutations) { const changed=structuredClone(d.original); mutate(changed); await assert.rejects(describeDevelopmentOriginal(changed)); }
});
test('original storage is lazy, sanitizes denial and has no dispatch, mutation or supplied-configuration read API',async()=>{
  let calls=0;
  const pool={connect:async()=>{calls++;throw new Error('private-connection');}};
  const store=createDevelopmentOriginalStore({execution:pool,drafts:pool},config,{authorize:async()=>{throw new Error('private-denial');},
    authorizeOriginal:async()=>{},authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('must not read keys');}});
  assert.deepEqual(Object.keys(store),['put','read','readHistorical','close']);
  await assert.rejects(store.read({ operationId:source.draftId,inputDigest:'a'.repeat(64),approved:true }));
  await assert.rejects(store.read({ operationId:source.draftId,inputDigest:'a'.repeat(64) }),{message:'Draft storage is unavailable.'});
  assert.equal(calls,0);store.close();
});

test('historical original reads require their distinct current authorization before SQL and never fall back to ordinary access',async()=>{
  let connections=0,current=0,history=0;
  const pool={connect:async()=>{connections++;throw new Error('Private SQL');}};
  const deps={authorize:async()=>{current++;},authorizeOriginal:async()=>{},authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('Private key');}};
  const target={operationId:source.draftId,inputDigest:'a'.repeat(64)};
  const missing=createDevelopmentOriginalStore({drafts:pool,execution:pool},config,deps);
  await assert.rejects(missing.readHistorical(target),{message:'Draft storage is unavailable.'});assert.equal(current,0);assert.equal(connections,0);missing.close();
  const denied=createDevelopmentOriginalStore({drafts:pool,execution:pool},config,{...deps,authorizeHistoricalRead:async()=>{history++;return true as any;}});
  await assert.rejects(denied.readHistorical({...target,approved:true}));assert.equal(history,0);
  await assert.rejects(denied.readHistorical(target));assert.equal(history,1);assert.equal(current,0);assert.equal(connections,0);denied.close();
});

test('timed-out historical original authorization retains admission and close prevents late source/key access',async()=>{
  let release!:()=>void,calls=0,connections=0;const held=new Promise<void>(r=>{release=r;});
  const pool={connect:async()=>{connections++;throw new Error('Private SQL');}};
  const store=createDevelopmentOriginalStore({drafts:pool,execution:pool},config,{authorize:async()=>{throw new Error('No ordinary access');},
    authorizeHistoricalRead:async()=>{calls++;await held;},authorizeOriginal:async()=>{},authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error('Private key');}});
  const target={operationId:source.draftId,inputDigest:'a'.repeat(64)};
  await assert.rejects(store.readHistorical(target));await assert.rejects(store.readHistorical(target));assert.equal(calls,1);assert.equal(connections,0);
  store.close();release();await new Promise(r=>setImmediate(r));await assert.rejects(store.readHistorical(target));assert.equal(connections,0);
});
test('timed-out original access retains admission and cannot acquire SQL or release late bytes after close',async()=>{
  let release!:()=>void,calls=0,connections=0;const held=new Promise<void>(r=>{release=r;});
  const pool={connect:async()=>{connections++;throw new Error();}};
  const store=createDevelopmentOriginalStore({execution:pool,drafts:pool},config,{authorize:async()=>{calls++;await held;},
    authorizeOriginal:async()=>{},authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error();}});
  const target={operationId:source.draftId,inputDigest:'a'.repeat(64)};
  await assert.rejects(store.read(target));await assert.rejects(store.read(target));assert.equal(calls,1);assert.equal(connections,0);
  store.close();release();await new Promise(r=>setImmediate(r));await assert.rejects(store.read(target));assert.equal(connections,0);
});
