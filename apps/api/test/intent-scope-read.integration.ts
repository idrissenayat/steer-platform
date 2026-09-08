import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {createScopeReviewOperationStore} from '@steer/data/scope-review-operations';
import type {createDraftRevisionStore} from '@steer/data/draft-revisions';
import type {createDraftLifecycleStore} from '@steer/data/draft-lifecycle';
import {scopeReviewProfileSchema} from '@steer/tool-registry/intent-scope-review';
import {createVerifiedScopeReviewReader} from '../src/runtime.ts';
import {createApi} from '../src/app.ts';

type Dependencies=Parameters<typeof createVerifiedScopeReviewReader>[2];
interface Fixture {
  config:{organizationId:string;subject:string;productId:string;repository:string};
  pools:Parameters<typeof createVerifiedScopeReviewReader>[0]; records:Dependencies['records'];
  input:{original:{profile:unknown}};target:{reviewId:string;preparationDigest:string};
  execution:{expiresAt:string};draftId:string;saved:{reference:{revisionDigest:string}};
  drafts:ReturnType<typeof createDraftRevisionStore>;lifecycle:ReturnType<typeof createDraftLifecycleStore>;reviews:ReturnType<typeof createScopeReviewOperationStore>;
  content:{originalText:string;clarificationTurns:string[];documents:unknown};
  produce(index:number,options?:{checkpoint?:boolean;relation?:'related-distinct'|'no-match-in-assessed-scope'|'insufficient-evidence'}):Promise<{batchId:string;inputDigest:string;event:{owner:string;fencingToken:number}}>;
  rows():Promise<unknown>;reservations():Promise<number>;calls():number;
}
/** Actual HTTP, SQL, encrypted records and pinned SDK codec; all authority and
 * model responses are synthetic. No real key, query grant or activation. */
export async function testIntentScopeRead(setup:(options?:{sourceCount?:number;inventoryComplete?:boolean;accessGapCount?:number;ttl?:number})=>Promise<Fixture>,checkBase:(name:string,run:()=>Promise<void>)=>Promise<void>){
  const readers:ReturnType<typeof createVerifiedScopeReviewReader>[]=[];
  const check=(name:string,run:()=>Promise<void>)=>checkBase(name,async()=>{try{await run();}finally{readers.splice(0).forEach(r=>r.close());}});
  const api=(f:Fixture,patch:Partial<Dependencies>={})=>{
    const reader=createVerifiedScopeReviewReader(f.pools,f.config,{records:f.records,profile:f.input.original.profile,...patch});readers.push(reader);
    const state={principal:{subject:f.config.subject,organizationId:f.config.organizationId,type:'human',hats:[],toolGrants:['intent.scope.read'],expiresAt:new Date(Date.now()+300000).toISOString()}};
    const input={organizationId:f.config.organizationId,productId:f.config.productId,repository:f.config.repository,...f.target};
    const app=createApi({authenticate:async()=>state.principal,services:{intentScopeReader:reader}});
    const post=(override={})=>app.request('/v1/tools/intent.scope.read',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input,...override})});
    return{reader,state,input,post};
  };
  await check('actual scope HTTP query reconstructs partial and complete multi-batch findings with no new model or SQL effect',async()=>{
    const f=await setup({sourceCount:34}),first=await api(f).post();assert.equal(first.status,200);assert.equal(first.headers.get('cache-control'),'no-store');assert.equal((await first.json()).status,'pending');
    assert.equal(await f.reservations(),0);await f.produce(0);const partial=await api(f).post();assert.equal(partial.status,200);assert.equal((await partial.json()).review.structuralAssessmentComplete,false);
    await f.produce(1);const before=await f.rows(),complete=await api(f).post();assert.equal(complete.status,200);const result=await complete.json();
    assert.equal(result.status,'review-available');assert.equal(result.review.results.length,2);assert.equal(result.review.coverage.inventoryCount,34);assert.equal(result.review.structuralAssessmentComplete,true);
    assert.deepEqual(await (await api(f).post()).json(),result);assert.deepEqual(await f.rows(),before);assert.equal(f.calls(),2);assert.equal(await f.reservations(),2);
    for(const flag of ['semanticQualityVerified','authoritativeClearance','savedToGit','gateSigned','executionAuthorized','retryAuthorized'])assert.equal(result[flag],false);
    for(const marker of ['EXAM-MARKER-NOT-FOR-SCOPE','synthetic-unused-key','requestBody','responseBody','modelRoute','fencingToken','reservationId','ciphertext'])assert.equal(JSON.stringify(result).includes(marker),false);
  });
  await check('scope HTTP preserves incomplete coverage and unresolved dispatch instead of returning a uniqueness verdict',async()=>{
    const gap=await setup({inventoryComplete:false,accessGapCount:1});await gap.produce(0,{relation:'no-match-in-assessed-scope'});
    const incomplete=await api(gap).post();assert.equal(incomplete.status,200);const result=await incomplete.json();assert.equal(result.status,'incomplete');assert.equal(result.review.coverage.accessGapCount,1);assert.equal(result.authoritativeClearance,false);
    const f=await setup(),input=await f.produce(0,{checkpoint:false});assert.equal((await (await api(f).post()).json()).review.results.length,0);
    assert.equal((await f.reviews.transition({...f.target,batchId:input.batchId,inputDigest:input.inputDigest,event:{type:'outcome-unknown',owner:input.event.owner,fencingToken:input.event.fencingToken}})).outcome,'ok');
    const unresolved=await (await api(f).post()).json();assert.equal(unresolved.status,'attention-required');assert.equal(unresolved.review.results.length,0);assert.equal(f.calls(),1);
  });
  await check('scope HTTP defaults closed and rejects agents, absent grants, foreign scope and injected fields before reading',async()=>{
    const f=await setup(),a=api(f);const request={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(a.input)};
    assert.equal((await createApi().request('/v1/tools/intent.scope.read',request)).status,401);
    assert.equal((await createApi({authenticate:async()=>a.state.principal}).request('/v1/tools/intent.scope.read',request)).status,503);
    assert.equal((await a.post({productId:'foreign'})).status,403);assert.equal((await a.post({modelBudget:5})).status,422);
    a.state.principal.type='agent';assert.equal((await a.post()).status,403);a.state.principal.type='human';a.state.principal.toolGrants=[];assert.equal((await a.post()).status,403);
    assert.equal(f.calls(),0);assert.equal(await f.reservations(),0);
  });
  await check('current scope profile and source authority cannot be replaced by a saved configuration or nonvoid approval',async()=>{
    const f=await setup();await f.produce(0);const profile=scopeReviewProfileSchema.parse(f.input.original.profile);
    const changed=api(f,{profile:{...profile,allowedResponseModels:['different-model']}});assert.equal((await changed.post()).status,503);
    for(const authorizeOriginal of [async()=>{throw new Error('PRIVATE source denial');},async()=>true as any]){
      const denied=api(f,{records:{...f.records,originals:{...f.records.originals,authorizeOriginal}}}),response=await denied.post();assert.equal(response.status,503);assert.equal((await response.text()).includes('PRIVATE'),false);
    }
    assert.equal((await api(f).post()).status,200);assert.equal(f.calls(),1);
  });
  await check('scope HTTP marks corrected source superseded and withholds findings on mid-read grant loss or a durable hold',async()=>{
    const f=await setup();await f.produce(0);
    assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,content:{...f.content,originalText:'New human scope correction'}})).outcome,'acknowledged');
    const corrected=await (await api(f).post()).json();assert.equal(corrected.status,'superseded');assert.equal(corrected.source.revision,1);assert.equal(corrected.source.latestRevision,2);
    let revoke=()=>{};const a=api(f,{records:{...f.records,originals:{...f.records.originals,keyForDraft:async(...args)=>{const key=await f.records.originals.keyForDraft(...args);revoke();return key;}}}});
    revoke=()=>{a.state.principal.toolGrants=[];};assert.equal((await a.post()).status,403);
    const before=await f.rows();assert.equal((await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()})).outcome,'ok');
    const held=await api(f).post();assert.equal(held.status,503);assert.equal((await held.text()).includes('Synthetic finding'),false);assert.deepEqual(await f.rows(),before);assert.equal(f.calls(),1);
  });
  await check('expired scope HTTP query returns only authorized metadata with no execution renewal or provider request',async()=>{
    const f=await setup({ttl:1500});await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));let execution=0;
    const a=api(f,{records:{...f.records,originals:{...f.records.originals,authorizeReview:async()=>{execution++;throw new Error('Expired execution');}}}});
    const response=await a.post();assert.equal(response.status,200);const result=await response.json();assert.equal(result.status,'expired');assert.equal(result.review,null);assert.equal(result.batches,null);
    assert.equal(execution,0);assert.equal(f.calls(),0);assert.equal(await f.reservations(),0);
  });
}
