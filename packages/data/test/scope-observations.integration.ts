import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {Pool,PoolClient} from 'pg';
import {scopeOriginalIntegrationFixture} from './scope-originals.integration.ts';
import {scopeReviewFixture} from '../../tool-registry/test/intent-scope-review.fixture.ts';
import {prepareIntentScopeReview} from '../../tool-registry/src/intent-scope-review.ts';
import {createRecordedScopeMastraRuntime,createRecordedScopeMastraVerifier,type RecordedRequest,type RecordedScopeResult,type RecordedResponse} from '../../agents/src/recorded-mastra.ts';
import {createScopeReviewObservationStore} from '../src/scope-review-observations.ts';
import {scopeOriginalHash as hash} from '../src/scope-original-contracts.ts';
import type {DatabasePool} from '../src/runtime-pool.ts';

type Dependencies=Parameters<typeof createScopeReviewObservationStore>[2];
type Observation=Parameters<Dependencies['verifyObservation']>[0];
const verify:Dependencies['verifyObservation']=async({original,batchId,request,response})=>{
  const codec=await createRecordedScopeMastraVerifier({scope:original.source.scope,evidence:original.evidence,profile:original.profile});
  const wire={adapterRevision:request.adapterRevision,protocol:request.protocol,requestBody:request.requestBody};
  codec.verifyRequest(batchId,wire);
  if(response)codec.verify(batchId,wire,{responseBody:response.responseBody,providerRequestId:response.providerRequestId,usage:response.usage,result:response.result});
};
const providerResponse=(output:unknown)=>({id:'synthetic-completion',object:'chat.completion',model:'synthetic-model',created:1,
  choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(output)}}],usage:{prompt_tokens:50,completion_tokens:10,total_tokens:60}});

export async function testScopeObservations({admin,connect,check:checkBase}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}) {
  const owned:Pool[]=[];
  const connection=(role:string)=>{const p=connect(role);owned.push(p);return p;};
  const check=(name:string,run:()=>Promise<void>)=>checkBase(name,async()=>{try{await run();}finally{await Promise.all(owned.splice(0).map(p=>p.end()));}});
  const setup=async(options:{dispatch?:boolean;capture?:boolean;ttl?:number}={})=>{
    const f=await scopeOriginalIntegrationFixture({admin,connect:connection},false,options.ttl);
    if(options.capture!==false)assert.equal((await f.make().put(f.input)).outcome,'stored');
    const terms=f.execution.scopeTerms,budget=f.execution.budget;
    await admin.query('INSERT INTO steer_usage.scope_review_terms VALUES($1,$2,$3,$4,$5,$6,$7,true)',
      [budget.organizationId,budget.budgetId,budget.subject,budget.configurationRevision,terms.approvalDigest,terms.profileDigest,terms.amountMicrousd]);
    const prepared=await prepareIntentScopeReview(f.input.original.source.scope,f.input.original.evidence,f.input.original.profile),batch=prepared.batches[0]!;
    const target={...f.target,batchId:batch.metadata.batchId},reference={...target,inputDigest:batch.inputDigest};
    const claim=await f.reviews.claim({...reference,owner:'synthetic-worker',leaseMs:300000});
    assert.equal(claim.outcome,'ok');if(claim.outcome!=='ok')throw new Error('Missing synthetic claim');
    const owner={owner:claim.value.owner,fencingToken:claim.value.fencingToken};
    if(options.dispatch!==false){const committed=await f.reviews.transition({...reference,event:{type:'commit-dispatch',...owner}});assert.equal(committed.outcome,'ok');assert.equal(committed.dispatchAllowed,true);}
    const make=(overrides:Partial<Dependencies>={},pools:{drafts:DatabasePool;execution:DatabasePool}=f.pools,patch={})=>
      createScopeReviewObservationStore(pools,{...f.config,...patch},{originals:f.deps,authorize:async()=>{},verifyObservation:verify,...overrides});
    const row=async(stage='request')=>(await admin.query('SELECT * FROM steer_drafts.scope_review_observations WHERE review_id=$1 AND batch_id=$2 AND stage=$3',[target.reviewId,target.batchId,stage])).rows[0];
    const fixture=await scopeReviewFixture();let calls=0;
    const runtime=await createRecordedScopeMastraRuntime({scope:f.input.original.source.scope,evidence:f.input.original.evidence,profile:f.input.original.profile,
      gatewayUrl:'http://127.0.0.1:4000/v1',gatewayKey:'synthetic-key-not-in-records',transport:async()=>{
        calls++;assert.ok(await row(),'SQL request acknowledgement must precede transport');
        return new Response(JSON.stringify(providerResponse(fixture.result(batch)))+'\r\n',{headers:{'content-type':'application/json','x-request-id':'synthetic-request-id'}});
      }});
    let request!:Observation['request'],response!:NonNullable<Observation['response']>,requestDigest!:string;
    const exchange=async(store=make())=>runtime.generate(target.batchId,{
      recordRequest:async(r:RecordedRequest)=>{request={stage:'request',rendered:batch.packet,...r};const saved=await store.put({...target,...owner,observation:request});assert.equal(saved.outcome,'stored');if(saved.outcome==='stored')requestDigest=saved.payloadDigest;},
      authorizeDispatch:async()=>{},
      recordResponse:async(r:RecordedResponse<RecordedScopeResult>)=>{response={stage:'response',requestDigest,...r};const saved=await store.put({...target,...owner,observation:response});assert.equal(saved.outcome,'stored');},
    },new AbortController().signal);
    return{...f,makeOriginal:f.make,make,row,prepared,batch,target,reference,owner,exchange,calls:()=>calls,request:()=>request,response:()=>response};
  };
  const wrap=(pool:Pool,intercept:(sql:string,values:unknown[]|undefined,run:()=>Promise<any>)=>Promise<any>):DatabasePool=>({async connect(){const c=await pool.connect();return{
    query:(sql:string,values?:unknown[])=>intercept(sql,values,()=>c.query(sql,values)),release:(broken:boolean)=>c.release(broken)} as PoolClient;}});
  const rawInsert=async(f:Awaited<ReturnType<typeof setup>>,row:any,record=row.record,envelope=row.encrypted_value,scope=f.config)=>{
    const c=await f.pools.drafts.connect();
    try{await c.query('BEGIN');await c.query("SELECT set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)",[scope.organizationId,scope.subject,scope.productId]);
      return await c.query('INSERT INTO steer_drafts.scope_review_observations VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)',
        [row.organization_id,row.subject,row.product_id,row.review_id,row.batch_id,row.stage,row.draft_id,row.draft_revision,row.payload_digest,JSON.stringify(record),JSON.stringify(envelope)]);
    }finally{await c.query('ROLLBACK');c.release();}
  };
  await check('scope SDK request/response acknowledgements survive restart with exact raw bytes, one reservation and no retry grant',async()=>{
    const f=await setup(),store=f.make(),result=await f.exchange(store);store.close();
    const request=await f.make().read({...f.target,stage:'request'}),response=await f.make().read({...f.target,stage:'response'});
    assert.deepEqual(request.observation,f.request());assert.deepEqual(response.observation,f.response());
    assert.equal(response.observation.stage,'response');if(response.observation.stage!=='response')throw new Error('Missing response');
    assert.deepEqual(response.observation.result,result);assert.ok(response.observation.responseBody.endsWith('\r\n'));
    assert.equal(response.outputDigest,hash(result));assert.equal(response.batchState,'dispatch-committed');assert.equal(response.requiresOutcomeResolution,false);
    for(const flag of ['executionAuthorized','retryAuthorized','gateSigned','semanticQualityVerified','authoritativeClearance'] as const)assert.equal(response[flag],false);
    assert.equal(f.calls(),1);assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_usage.model_reservations WHERE budget_id=$1',[f.execution.budget.budgetId])).rows[0].n,1);
    for(const stage of ['request','response']){const row=JSON.stringify(await f.row(stage));for(const secret of [f.content.originalText,'Synthetic finding.','synthetic-key-not-in-records','Patient booking'])assert.equal(row.includes(secret),false);}
  });
  await check('lost scope request COMMIT acknowledgement blocks transport and recovers the same immutable request',async()=>{
    const f=await setup();let inserted=false;
    const uncertain=wrap(f.pools.drafts,async(sql,_v,run)=>{const r=await run();if(sql.includes('INSERT INTO steer_drafts.scope_review_observations'))inserted=true;if(sql==='COMMIT'&&inserted)throw new Error('Synthetic lost request ACK');return r;});
    await assert.rejects(f.exchange(f.make({}, {...f.pools,drafts:uncertain})));assert.equal(f.calls(),0);
    assert.deepEqual((await f.make().read({...f.target,stage:'request'})).observation,f.request());assert.equal(await f.row('response'),undefined);
  });
  await check('lost scope response COMMIT acknowledgement recovers verified evidence after quarantine without another dispatch',async()=>{
    const f=await setup();let inserted=false;
    const uncertain=wrap(f.pools.drafts,async(sql,v,run)=>{const r=await run();if(sql.includes('INSERT INTO steer_drafts.scope_review_observations')&&v?.[5]==='response')inserted=true;if(sql==='COMMIT'&&inserted)throw new Error('Synthetic lost response ACK');return r;});
    await assert.rejects(f.exchange(f.make({}, {...f.pools,drafts:uncertain})));assert.equal(f.calls(),1);
    assert.equal((await f.reviews.transition({...f.reference,event:{type:'outcome-unknown',...f.owner}})).outcome,'ok');
    const recovered=await f.make().read({...f.target,stage:'response'});assert.deepEqual(recovered.observation,f.response());
    assert.equal(recovered.requiresOutcomeResolution,true);assert.equal(recovered.batchState,'outcome-unknown');assert.equal(recovered.retryAuthorized,false);
    assert.notEqual((await f.make().put({...f.target,...f.owner,observation:f.response()})).outcome,'stored');assert.equal(f.calls(),1);
  });
  await check('concurrent scope observation replays preserve ciphertext and reject changed wire, result, usage and ownership',async()=>{
    const f=await setup();await f.exchange();const original=await f.row(),input={...f.target,...f.owner,observation:f.request()};
    const results=await Promise.all(Array.from({length:3},()=>f.make({}, {drafts:connection('steer_draft_runtime'),execution:connection('steer_app')}).put(input)));
    assert.ok(results.every(r=>r.outcome==='stored'));assert.deepEqual(await f.row(),original);
    const changedRequests=[{...f.request(),requestBody:'{}'},{...f.request(),rendered:{}},{...f.request(),headers:{authorization:'not-permitted'}}];
    for(const observation of changedRequests)assert.notEqual((await f.make().put({...input,observation})).outcome,'stored');
    for(const patch of [{owner:'another-worker'},{fencingToken:2},{batchId:'f'.repeat(64)},{preparationDigest:'f'.repeat(64)}])assert.notEqual((await f.make().put({...input,...patch})).outcome,'stored');
    const changed=structuredClone(f.response());changed.result.output.findings[0]!.citations[0]!.quote+='invented';
    for(const observation of [{...f.response(),requestDigest:'f'.repeat(64)},{...f.response(),responseBody:'{}'},changed,{...f.response(),usage:{inputTokens:50,outputTokens:10,totalTokens:61}}])
      assert.notEqual((await f.make().put({...input,observation})).outcome,'stored');
    assert.deepEqual(await f.row(),original);assert.equal(f.calls(),1);
  });
  await check('scope requests with absent originals or uncommitted dispatch cannot reach the synthetic provider',async()=>{
    for(const options of [{capture:false},{dispatch:false}]){const f=await setup(options);await assert.rejects(f.exchange());assert.equal(f.calls(),0);assert.equal(await f.row(),undefined);}
  });
  await check('scope observation SQL forces RLS, hides cross-role execution data and rejects unscoped or malformed inserts',async()=>{
    const f=await setup();await f.exchange();const row=await f.row();
    assert.deepEqual((await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='steer_drafts.scope_review_observations'::regclass")).rows[0],{relrowsecurity:true,relforcerowsecurity:true});
    assert.equal((await f.pools.drafts.query('SELECT * FROM steer_drafts.scope_review_observations')).rowCount,0);
    for(const role of ['steer_app','steer_projector','steer_auth_runtime'])await assert.rejects(connection(role).query('SELECT * FROM steer_drafts.scope_review_observations'),{code:'42501'});
    for(const sql of ['SELECT * FROM steer_execution.scope_review_batches','SELECT steer_drafts.guard_scope_observation()','DELETE FROM steer_drafts.scope_review_observations','TRUNCATE steer_drafts.scope_review_observations',"UPDATE steer_drafts.scope_review_observations SET record='{}'"])
      await assert.rejects(f.pools.drafts.query(sql),{code:'42501'});
    await assert.rejects(f.make({}, {...f.pools,drafts:admin}).read({...f.target,stage:'request'}));
    for(const record of [{...row.record,privatePrompt:'not allowed'},{...row.record,owner:'foreign'},{...row.record,fencingToken:'1'},{...row.record,requestDigest:'f'.repeat(64)}])await assert.rejects(rawInsert(f,row,record),{code:'23514'});
    await assert.rejects(rawInsert(f,row,row.record,{...row.encrypted_value,plaintext:'not allowed'}),{code:'23514'});
    await assert.rejects(rawInsert(f,row,row.record,row.encrypted_value,{...f.config,subject:'foreign'}),{code:'23514'});
    const proc=(await admin.query("SELECT prosecdef,proconfig FROM pg_proc WHERE oid='steer_drafts.guard_scope_observation()'::regprocedure")).rows[0];
    assert.equal(proc.prosecdef,true);assert.deepEqual(proc.proconfig,['search_path=pg_catalog, pg_temp']);
    const response=await f.row('response');await assert.rejects(rawInsert(f,response,{...response.record,requestDigest:'f'.repeat(64)}),{code:'23514'});
    const original=(await admin.query('SELECT record FROM steer_drafts.scope_review_originals WHERE review_id=$1',[f.target.reviewId])).rows[0].record;
    await admin.query('UPDATE steer_drafts.scope_review_originals SET record=$1::jsonb WHERE review_id=$2',[JSON.stringify({...original,executionConfigurationDigest:'f'.repeat(64)}),f.target.reviewId]);
    await assert.rejects(rawInsert(f,row),{code:'23514'});
    await admin.query('UPDATE steer_drafts.scope_review_originals SET record=$1::jsonb WHERE review_id=$2',[JSON.stringify(original),f.target.reviewId]);
  });
  await check('database insert serialization rejects quarantine that wins after the final scope adapter check',async()=>{
    const f=await setup();let transitioned=false;
    const racing=wrap(f.pools.drafts,async(sql,_v,run)=>{
      if(sql.includes('INSERT INTO steer_drafts.scope_review_observations')&&!transitioned){transitioned=true;assert.equal((await f.reviews.transition({...f.reference,event:{type:'outcome-unknown',...f.owner}})).outcome,'ok');}
      return run();
    });
    await assert.rejects(f.exchange(f.make({}, {...f.pools,drafts:racing})));assert.equal(transitioned,true);assert.equal(await f.row(),undefined);assert.equal(f.calls(),0);
  });
  await check('scope observation read revalidates current records, source, draft keys and hold before releasing plaintext',async()=>{
    const f=await setup();await f.exchange();const target={...f.target,stage:'response'};
    for(const patch of [{organizationId:'foreign'},{subject:'foreign'},{productId:'foreign'},{recordsPolicyDigest:'f'.repeat(64)}])await assert.rejects(f.make({},f.pools,patch).read(target));
    let keys=0;
    await assert.rejects(f.make({authorize:async()=>{throw new Error('Denied');},originals:{...f.deps,keyForDraft:async()=>{keys++;return f.key;}}}).read(target));assert.equal(keys,0);
    await assert.rejects(f.make({originals:{...f.deps,authorizeOriginal:async()=>{throw new Error('Source revoked');}}}).read(target));
    await assert.rejects(f.make({originals:{...f.deps,keyForDraft:async()=>({...f.key,bytes:randomBytes(32)})}}).read(target));
    let allowed=true;
    await assert.rejects(f.make({authorize:async()=>{if(!allowed)throw new Error('Late revocation');},verifyObservation:async(ctx)=>{await verify(ctx);allowed=false;}}).read(target));
    assert.equal((await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()})).outcome,'ok');
    await assert.rejects(f.make({originals:{...f.deps,keyForDraft:async()=>{keys++;return f.key;}}}).read(target));assert.equal(keys,0);
    assert.ok(await f.row('response'));
  });
  await check('scope ciphertext transplant and closing a pending verifier cannot release late content',async()=>{
    const f=await setup();await f.exchange();const response=await f.row('response'),request=await f.row();
    await admin.query('UPDATE steer_drafts.scope_review_observations SET encrypted_value=$1::jsonb WHERE review_id=$2 AND stage=\'response\'',[JSON.stringify(request.encrypted_value),f.target.reviewId]);
    await assert.rejects(f.make().read({...f.target,stage:'response'}));
    await admin.query('UPDATE steer_drafts.scope_review_observations SET encrypted_value=$1::jsonb WHERE review_id=$2 AND stage=\'response\'',[JSON.stringify(response.encrypted_value),f.target.reviewId]);
    let entered!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{entered=r;}),held=new Promise<void>(r=>{release=r;});
    const store=f.make({verifyObservation:async(ctx)=>{entered();await held;await verify(ctx);}}),read=store.read({...f.target,stage:'response'});
    await reached;store.close();release();await assert.rejects(read);assert.deepEqual(await f.row('response'),response);
    assert.equal((await f.make().read({...f.target,stage:'response'})).payloadDigest,response.payload_digest);
  });
  await check('scope observations require a void verified acknowledgement and remain unavailable after execution expiry',async()=>{
    const denied=await setup();
    assert.throws(()=>denied.make({verifyObservation:undefined as any}));
    await assert.rejects(denied.exchange(denied.make({verifyObservation:async()=>true as any})));assert.equal(denied.calls(),0);assert.equal(await denied.row(),undefined);
    const f=await setup({ttl:5000});await f.exchange();
    await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));
    await assert.rejects(f.make().read({...f.target,stage:'response'}));assert.ok(await f.row('response'));
    assert.equal(f.calls(),1);assert.equal((await f.makeOriginal().read({reviewId:f.target.reviewId,preparationDigest:f.target.preparationDigest})).reviewExpired,true);
  });
  await check('scope trigger ignores shadow relations and recorded evidence survives later edits and known failure without authority',async()=>{
    const f=await setup();
    const contaminated:DatabasePool={async connect(){const c=await f.pools.drafts.connect();return{
      query:async(sql:string,values?:unknown[])=>{const r=await c.query(sql,values);if(sql==='BEGIN ISOLATION LEVEL READ COMMITTED'){
        await c.query('SET LOCAL search_path=pg_temp,public');
        await c.query('CREATE TEMP TABLE scope_review_batches (record jsonb) ON COMMIT DROP');
        await c.query('CREATE TEMP TABLE draft_lifecycles (held boolean) ON COMMIT DROP');
      }return r;},release:(broken:boolean)=>c.release(broken)} as PoolClient;}};
    await f.exchange(f.make({}, {...f.pools,drafts:contaminated}));
    const stored=await f.row('response');
    assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
      content:{...f.content,originalText:'Later human edit must remain separate'}})).outcome,'acknowledged');
    assert.equal((await f.reviews.transition({...f.reference,event:{type:'known-failure',...f.owner}})).outcome,'ok');
    const read=await f.make().read({...f.target,stage:'response'});assert.deepEqual(read.observation,f.response());assert.equal(read.batchState,'failed-known');
    assert.equal(read.requiresOutcomeResolution,true);assert.equal(read.retryAuthorized,false);assert.equal(read.executionAuthorized,false);
    assert.deepEqual(await f.row('response'),stored);assert.equal(f.calls(),1);
  });
}
