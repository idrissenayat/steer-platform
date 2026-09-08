import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {Pool,PoolClient} from 'pg';
import {scopeOriginalIntegrationFixture} from './scope-originals.integration.ts';
import {scopeReviewFixture} from '../../tool-registry/test/intent-scope-review.fixture.ts';
import {prepareIntentScopeReview} from '../../tool-registry/src/intent-scope-review.ts';
import {createRecordedScopeMastraRuntime,createRecordedScopeMastraVerifier} from '../../agents/src/recorded-mastra.ts';
import {createScopeReviewReader} from '../src/scope-review-reader.ts';
import {createScopeReviewObservationStore} from '../src/scope-review-observations.ts';
import {createScopeReviewOperationStore} from '../src/scope-review-operations.ts';
import {createScopeReviewCheckpointVerifier} from '../src/scope-review-checkpoints.ts';
import type {DatabasePool} from '../src/runtime-pool.ts';

type Records=Parameters<typeof createScopeReviewReader>[2];
const verify:Records['verifyObservation']=async({original,batchId,request,response})=>{
  const codec=await createRecordedScopeMastraVerifier({scope:original.source.scope,evidence:original.evidence,profile:original.profile});
  const wire={adapterRevision:request.adapterRevision,protocol:request.protocol,requestBody:request.requestBody};codec.verifyRequest(batchId,wire);
  if(response)codec.verify(batchId,wire,{responseBody:response.responseBody,providerRequestId:response.providerRequestId,usage:response.usage,result:response.result});
};
export async function testScopeReviewReader({admin,connect,check:checkBase}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}){
  const owned:Pool[]=[];
  const connection=(role:string)=>{const pool=connect(role);owned.push(pool);return pool;};
  const check=(name:string,run:()=>Promise<void>)=>checkBase(name,async()=>{try{await run();}finally{await Promise.all(owned.splice(0).map(p=>p.end()));}});
  const setup=async(options:{sourceCount?:number;inventoryComplete?:boolean;accessGapCount?:number;ttl?:number}={})=>{
    const f=await scopeOriginalIntegrationFixture({admin,connect:connection},false,options.ttl,options);
    assert.equal((await f.make().put(f.input)).outcome,'stored');
    const b=f.execution.budget,t=f.execution.scopeTerms;
    await admin.query('INSERT INTO steer_usage.scope_review_terms VALUES($1,$2,$3,$4,$5,$6,$7,true)',[b.organizationId,b.budgetId,b.subject,b.configurationRevision,t.approvalDigest,t.profileDigest,t.amountMicrousd]);
    const records:Records={originals:f.deps,authorize:async()=>{},verifyObservation:verify};
    const prepared=await prepareIntentScopeReview(f.input.original.source.scope,f.input.original.evidence,f.input.original.profile),fixture=await scopeReviewFixture();
    const checkpoints=createScopeReviewOperationStore(f.pools.execution,f.execution,{authorize:f.deps.authorizeReview,
      verifyCheckpoint:createScopeReviewCheckpointVerifier(f.pools,f.config,records)});
    let calls=0;
    const produce=async(index:number,{checkpoint=true,relation='related-distinct'}:{checkpoint?:boolean;relation?:'related-distinct'|'no-match-in-assessed-scope'|'insufficient-evidence'}={})=>{
      const batch=prepared.batches[index]!,target={...f.target,batchId:batch.metadata.batchId},reference={...target,inputDigest:batch.inputDigest};
      const claim=await f.reviews.claim({...reference,owner:'synthetic-scope-reader',leaseMs:300000});assert.equal(claim.outcome,'ok');
      if(claim.outcome!=='ok')throw new Error('Missing claim');const owner={owner:claim.value.owner,fencingToken:claim.value.fencingToken};
      assert.equal((await f.reviews.transition({...reference,event:{type:'commit-dispatch',...owner}})).dispatchAllowed,true);
      const journal=createScopeReviewObservationStore(f.pools,f.config,records);let requestDigest!:string,resultDigest!:string;
      const output=fixture.result(batch);for(const finding of output.findings)(finding as any).relation=relation;
      const runtime=await createRecordedScopeMastraRuntime({scope:f.input.original.source.scope,evidence:f.input.original.evidence,profile:f.input.original.profile,
        gatewayUrl:'http://127.0.0.1:4000/v1',gatewayKey:'synthetic-unused-key',transport:async()=>{calls++;return new Response(JSON.stringify({id:'synthetic-completion',object:'chat.completion',model:'synthetic-model',created:1,
          choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(output)}}],usage:{prompt_tokens:50,completion_tokens:10,total_tokens:60}}),{headers:{'content-type':'application/json'}});}});
      try{await runtime.generate(target.batchId,{
        recordRequest:async request=>{const saved=await journal.put({...target,...owner,observation:{stage:'request',rendered:batch.packet,...request}});assert.equal(saved.outcome,'stored');if(saved.outcome==='stored')requestDigest=saved.payloadDigest;},
        authorizeDispatch:async()=>{},recordResponse:async response=>{const saved=await journal.put({...target,...owner,observation:{stage:'response',requestDigest,...response}});assert.equal(saved.outcome,'stored');if(saved.outcome==='stored')resultDigest=saved.payloadDigest;},
      },new AbortController().signal);}finally{journal.close();}
      const input={...reference,event:{type:'checkpoint' as const,...owner,resultDigest}};
      if(checkpoint)assert.equal((await checkpoints.transition(input)).outcome,'ok');return input;
    };
    const make=(patch:Partial<Records>={},pools:Parameters<typeof createScopeReviewReader>[0]=f.pools,configuration={})=>createScopeReviewReader(pools,{...f.config,...configuration},{...records,...patch});
    const read=async(patch:Partial<Records>={})=>{const reader=make(patch);try{return await reader.read(f.target,async()=>{});}finally{reader.close();}};
    const rows=async()=>(await admin.query('SELECT record FROM steer_execution.scope_review_batches WHERE review_id=$1 ORDER BY batch_id',[f.target.reviewId])).rows;
    const reservations=async()=>Number((await admin.query('SELECT count(*) AS n FROM steer_usage.model_reservations WHERE budget_id=$1',[b.budgetId])).rows[0].n);
    return{...f,records,prepared,checkpoints,produce,make,read,rows,reservations,calls:()=>calls};
  };
  await check('scope combined reader follows pending to partial to full multi-batch SQL results across reconstruction without a model resend',async()=>{
    const f=await setup({sourceCount:34});assert.equal(f.prepared.batches.length,2);
    const pending=await f.read();assert.equal(pending.status,'pending');assert.equal(pending.review?.results.length,0);assert.equal(pending.review?.pendingBatchIds.length,2);assert.equal(await f.reservations(),0);
    await f.produce(0);const partial=await f.read();assert.equal(partial.status,'pending');assert.equal(partial.review?.results.length,1);assert.equal(partial.review?.structuralAssessmentComplete,false);
    await f.produce(1);const before=await f.rows(),full=await f.read();assert.equal(full.status,'review-available');assert.equal(full.review?.structuralAssessmentComplete,true);
    assert.equal(full.review?.coverage.inventoryCount,34);assert.equal(full.review?.results.length,2);assert.equal(full.review?.pendingBatchIds.length,0);
    assert.deepEqual(await f.read(),full);assert.deepEqual(await f.rows(),before);assert.equal(f.calls(),2);assert.equal(await f.reservations(),2);
    for(const flag of ['semanticQualityVerified','authoritativeClearance','savedToGit','gateSigned','executionAuthorized','retryAuthorized'] as const)assert.equal(full[flag],false);
    assert.equal(JSON.stringify(full).includes('EXAM-MARKER-NOT-FOR-SCOPE'),false);assert.equal(Object.isFrozen(full.review?.results),true);
  });
  await check('saved but uncheckpointed responses are not combined and unknown or failed batches remain attention-required',async()=>{
    for(const type of ['outcome-unknown','known-failure'] as const){
      const f=await setup(),input=await f.produce(0,{checkpoint:false}),sent=await f.read();
      assert.equal(sent.status,'pending');assert.equal(sent.review?.results.length,0);
      assert.equal((await f.reviews.transition({...f.target,batchId:input.batchId,inputDigest:input.inputDigest,
        event:{type,owner:input.event.owner,fencingToken:input.event.fencingToken}})).outcome,'ok');
      const unresolved=await f.read();assert.equal(unresolved.status,'attention-required');assert.equal(unresolved.review?.results.length,0);assert.equal(unresolved.retryAuthorized,false);assert.equal(f.calls(),1);
    }
  });
  await check('no-match findings cannot erase incomplete inventory, access gaps or an insufficient-evidence assessment',async()=>{
    for(const options of [{inventoryComplete:false},{accessGapCount:1},{}]){
      const f=await setup(options);await f.produce(0,{relation:Object.keys(options).length?'no-match-in-assessed-scope':'insufficient-evidence'});
      const result=await f.read();assert.equal(result.status,'incomplete');assert.equal(result.review?.structuralAssessmentComplete,false);assert.equal(result.authoritativeClearance,false);
      assert.equal(result.review?.results.length,1);assert.equal(f.calls(),1);
    }
  });
  await check('new human corrections supersede the retained combined scope result without replacing original evidence',async()=>{
    const f=await setup();await f.produce(0);const before=await f.read();
    assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,content:{...f.content,originalText:'A new human correction'}})).outcome,'acknowledged');
    const after=await f.read();assert.equal(after.status,'superseded');assert.equal(after.source.revision,1);assert.equal(after.source.latestRevision,2);assert.deepEqual(after.review,before.review);assert.equal(f.calls(),1);
  });
  await check('expired scope queries return only records-authorized metadata without renewing execution or releasing observations',async()=>{
    const f=await setup({ttl:1500});await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));let execution=0,codec=0;
    const result=await f.read({originals:{...f.deps,authorizeReview:async()=>{execution++;throw new Error('Expired execution');}},verifyObservation:async()=>{codec++;throw new Error('No expired observations');}});
    assert.equal(result.status,'expired');assert.equal(result.review,null);assert.equal(result.batches,null);assert.equal(execution,0);assert.equal(codec,0);assert.equal(f.calls(),0);assert.equal(await f.reservations(),0);
  });
  await check('scope result reads deny foreign scope, current identity and source/key/codec authority instead of returning no matches',async()=>{
    const f=await setup();await f.produce(0);
    for(const configuration of [{organizationId:'foreign'},{subject:'foreign'},{productId:'foreign'},{recordsPolicyDigest:'f'.repeat(64)}]){
      const reader=f.make({},f.pools,configuration);try{await assert.rejects(reader.read(f.target,async()=>{}));}finally{reader.close();}
    }
    for(const patch of [{authorize:async()=>{throw new Error('Records denied');}},{verifyObservation:async()=>{throw new Error('Invalid provider bytes');}},
      {originals:{...f.deps,authorizeOriginal:async()=>{throw new Error('Source denied');}}},{originals:{...f.deps,keyForDraft:async()=>({...f.key,bytes:randomBytes(32)})}}])await assert.rejects(f.read(patch));
    let allowed=true;const reader=f.make({verifyObservation:async ctx=>{await verify(ctx);if(ctx.response)allowed=false;}});
    try{await assert.rejects(reader.read(f.target,async()=>{if(!allowed)throw new Error('Identity revoked mid-read');}));}finally{reader.close();}assert.equal(f.calls(),1);
  });
  await check('a batch completing during result read invalidates the snapshot rather than mixing old partial and new complete metadata',async()=>{
    const f=await setup({sourceCount:34});await f.produce(0);const second=await f.produce(1,{checkpoint:false});let raced=false;
    await assert.rejects(f.read({verifyObservation:async ctx=>{await verify(ctx);if(ctx.response&&!raced){raced=true;assert.equal((await f.checkpoints.transition(second)).outcome,'ok');}}}));
    assert.equal(raced,true);assert.equal((await f.read()).status,'review-available');assert.equal(f.calls(),2);assert.equal(await f.reservations(),2);
  });
  await check('holds and shutdown during combined scope read withhold late private findings and retain completed records',async()=>{
    const f=await setup();await f.produce(0);const before=await f.rows();let entered!:()=>void,release!:()=>void;
    const reached=new Promise<void>(r=>{entered=r;}),held=new Promise<void>(r=>{release=r;});
    const reader=f.make({verifyObservation:async ctx=>{if(ctx.response){entered();await held;}await verify(ctx);}}),reading=reader.read(f.target,async()=>{});
    await reached;reader.close();release();await assert.rejects(reading);assert.deepEqual(await f.rows(),before);
    let heldDraft=false;await assert.rejects(f.read({verifyObservation:async ctx=>{await verify(ctx);if(ctx.response&&!heldDraft){heldDraft=true;assert.equal((await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()})).outcome,'ok');}}}));
    assert.equal(heldDraft,true);assert.deepEqual(await f.rows(),before);assert.equal(f.calls(),1);
  });
  await check('scope result reader issues no persistent SQL writes and rejects corrupted checkpointed ciphertext',async()=>{
    const f=await setup();await f.produce(0);let writes=0;
    const readOnly=(pool:Pool):DatabasePool=>({async connect(){const client=await pool.connect();return{query:(sql:string,values?:unknown[])=>{
      if(/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i.test(sql)){writes++;throw new Error('Reader attempted write');}return client.query(sql,values);},release:(broken:boolean)=>client.release(broken)} as PoolClient;}});
    const reader=f.make({},{drafts:readOnly(f.pools.drafts),execution:readOnly(f.pools.execution)});
    try{assert.equal((await reader.read(f.target,async()=>{})).status,'review-available');}finally{reader.close();}assert.equal(writes,0);
    const original=(await admin.query("SELECT encrypted_value FROM steer_drafts.scope_review_observations WHERE review_id=$1 AND stage='response'",[f.target.reviewId])).rows[0].encrypted_value;
    const request=(await admin.query("SELECT encrypted_value FROM steer_drafts.scope_review_observations WHERE review_id=$1 AND stage='request'",[f.target.reviewId])).rows[0].encrypted_value;
    try{await admin.query("UPDATE steer_drafts.scope_review_observations SET encrypted_value=$1::jsonb WHERE review_id=$2 AND stage='response'",[JSON.stringify(request),f.target.reviewId]);
      await assert.rejects(f.read());
    }finally{await admin.query("UPDATE steer_drafts.scope_review_observations SET encrypted_value=$1::jsonb WHERE review_id=$2 AND stage='response'",[JSON.stringify(original),f.target.reviewId]);}
    assert.equal((await f.read()).status,'review-available');
    assert.equal(f.calls(),1);
  });
}
