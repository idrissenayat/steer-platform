import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {Pool,PoolClient} from 'pg';
import type {DatabasePool} from '@steer/data/runtime-pool';
import {scopeOriginalIntegrationFixture} from '../../../packages/data/test/scope-originals.integration.ts';
import {scopeReviewFixture} from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import {prepareIntentScopeReview} from '@steer/tool-registry/intent-scope-review';
import {createVerifiedScopeReviewReader} from '../../api/src/runtime.ts';
import {createScopeStepRuntime} from '../src/scope-step-runtime.ts';
import {testScopeWorkflow} from './scope-workflow.integration.ts';
type Dependencies=Parameters<typeof createScopeStepRuntime>[3];
const gate=()=>{let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return{promise,release};};
export async function scopeStepIntegrationFixture({admin,connect}:{admin:Pool;connect(role:string):Pool},sourceCount=4,ttl=3600000){
    const f=await scopeOriginalIntegrationFixture({admin,connect},false,ttl,{sourceCount});assert.equal((await f.make().put(f.input)).outcome,'stored');
    const b=f.execution.budget,t=f.execution.scopeTerms;
    await admin.query('INSERT INTO steer_usage.scope_review_terms VALUES($1,$2,$3,$4,$5,$6,$7,true)',[b.organizationId,b.budgetId,b.subject,b.configurationRevision,t.approvalDigest,t.profileDigest,t.amountMicrousd]);
    const fixture=await scopeReviewFixture(),prepared=await prepareIntentScopeReview(f.input.original.source.scope,f.input.original.evidence,f.input.original.profile);
    const state={calls:0},batchId=(index=0)=>prepared.batches[index]!.metadata.batchId;
    const step=async(id=batchId())=>(await admin.query('SELECT record FROM steer_execution.scope_review_batches WHERE review_id=$1 AND batch_id=$2',[f.target.reviewId,id])).rows[0]?.record;
    const count=async(stage='response')=>Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.scope_review_observations WHERE review_id=$1 AND stage=$2',[f.target.reviewId,stage])).rows[0].n);
    const reservations=async()=>Number((await admin.query('SELECT count(*) AS n FROM steer_usage.model_reservations WHERE budget_id=$1',[b.budgetId])).rows[0].n);
    const transport:NonNullable<Dependencies['gateway']['transport']>=async(_input,init)=>{
      state.calls++;const wire=JSON.parse(String(init?.body));
      const batch=prepared.batches.find(v=>v.packet.request.source===wire.messages[1].content);assert.ok(batch,'actual SDK request must match the prepared batch');
      assert.equal((await step(batch.metadata.batchId)).state,'dispatch-committed');
      assert.equal(Number((await admin.query("SELECT count(*) AS n FROM steer_drafts.scope_review_observations WHERE review_id=$1 AND batch_id=$2 AND stage='request'",[f.target.reviewId,batch.metadata.batchId])).rows[0].n),1);
      return Response.json({id:'synthetic-completion',object:'chat.completion',model:'synthetic-model',created:1,
        choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(fixture.result(batch))}}],usage:{prompt_tokens:50,completion_tokens:10,total_tokens:60}});
    };
    const deps:Dependencies={records:{originals:f.deps,authorize:async()=>{}},profile:f.input.original.profile,
      gateway:{gatewayUrl:'http://127.0.0.1:4000/v1',gatewayKey:'synthetic-unused-key',transport},authorize:async ctx=>{
        if(ctx.action==='dispatch'){assert.deepEqual(ctx.execution,f.execution);assert.ok(ctx.packet);}}};
    const make=(patch:Partial<Dependencies>={},pools:Parameters<typeof createScopeStepRuntime>[0]=f.pools,options={})=>createScopeStepRuntime(pools,f.config,f.target,{...deps,...patch},options);
    const run=async(index=0,patch:Partial<Dependencies>={})=>{const r=make(patch);try{return await r.run(batchId(index),new AbortController().signal);}finally{r.close();}};
    const read=async()=>{const r=createVerifiedScopeReviewReader(f.pools,f.config,{records:deps.records,profile:deps.profile});try{return await r.read({organizationId:f.config.organizationId,productId:f.config.productId,repository:f.config.repository,...f.target},async()=>{});}finally{r.close();}};
    const edit=async()=>{assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,content:{...f.content,originalText:'A newer human correction'}})).outcome,'acknowledged');};
    return{...f,prepared,state,batchId,step,count,reservations,transport,deps,make,run,read,edit};
}
export async function testScopeStepRuntime({admin,connect,check:checkBase}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}){
  const owned:Pool[]=[];
  const connection=(role:string)=>{const p=connect(role);owned.push(p);return p;};
  const check=(name:string,run:()=>Promise<void>)=>checkBase(name,async()=>{try{await run();}finally{await Promise.all(owned.splice(0).map(p=>p.end()));}});
  const setup=(sourceCount=4,ttl=3600000)=>scopeStepIntegrationFixture({admin,connect:connection},sourceCount,ttl);
  await check('scope runner executes actual recorded SDK batches once and reconstructed SQL readback recovers combined review without dispatch credentials',async()=>{
    const f=await setup(34);assert.equal(f.prepared.batches.length,2);assert.equal((await f.read()).status,'pending');
    const first=await f.run();assert.equal(first.outcome,'succeeded');assert.equal(f.state.calls,1);assert.equal((await f.read()).status,'pending');
    const second=await f.run(1);assert.equal(second.outcome,'succeeded');const combined=await f.read();assert.equal(combined.status,'review-available');assert.equal(combined.review?.results.length,2);
    const noDispatch={gateway:{gatewayUrl:'invalid',gatewayKey:'',transport:async()=>{throw new Error('must not send');}},authorize:async({action}:any)=>{if(action==='dispatch')throw new Error('no dispatch grant');}};
    assert.deepEqual(await f.run(0,noDispatch),first);assert.deepEqual(await f.run(1,noDispatch),second);assert.deepEqual(await f.read(),combined);
    assert.equal(f.state.calls,2);assert.equal(await f.reservations(),2);assert.equal(await f.count(),2);
    const text=JSON.stringify([first,second]);for(const secret of [f.content.originalText,'synthetic-unused-key','EXAM-MARKER-NOT-FOR-SCOPE','overlapExplanation'])assert.equal(text.includes(secret),false);
    for(const flag of ['semanticQualityVerified','authoritativeClearance','executionAuthorized','retryAuthorized','gateSigned'] as const)assert.equal(first[flag],false);
  });
  await check('scope execution denies revoked dispatch before charge and after SQL dispatch without reaching transport',async()=>{
    for(const denyAt of [1,3,4]){
      const f=await setup();let n=0;
      const result=await f.run(0,{authorize:async({action})=>{if(action==='dispatch'&&++n===denyAt)throw new Error('private-current-denial');}});
      assert.equal(result.outcome,'attention-required');assert.equal(f.state.calls,0);assert.equal(await f.reservations(),denyAt===1?0:1);
      if(denyAt!==1){assert.equal((await f.step()).state,'outcome-unknown');assert.equal((await f.run()).outcome,'attention-required');assert.equal(f.state.calls,0);}
    }
  });
  await check('competing reconstructed scope workers never send the same owned batch twice',async()=>{
    const f=await setup(),entered=gate(),held=gate(),r=f.make({gateway:{...f.deps.gateway,transport:async(...args)=>{const value=await f.transport(...args);entered.release();await held.promise;return value;}}});
    try{const running=r.run(f.batchId(),new AbortController().signal);await Promise.race([entered.promise,running.then(()=>{throw new Error('Transport not reached');})]);
      assert.notEqual((await f.run()).outcome,'succeeded');held.release();assert.equal((await running).outcome,'succeeded');assert.equal((await f.run()).outcome,'succeeded');
      assert.equal(f.state.calls,1);assert.equal(await f.reservations(),1);
    }finally{held.release();r.close();}
  });
  await check('final scope identity loss withholds success without erasing a completed checkpoint or buying another call',async()=>{
    const f=await setup();let observations=0;
    assert.equal((await f.run(0,{authorize:async({action})=>{if(action==='observe'&&++observations===3)throw new Error('Final identity revoked');}})).outcome,'attention-required');
    assert.equal(observations,3);assert.equal((await f.step()).state,'succeeded');assert.equal((await f.run()).outcome,'succeeded');
    assert.equal(f.state.calls,1);assert.equal(await f.reservations(),1);
  });
  await check('scope provider failures and wrong-model or malformed bytes quarantine one reservation without retry or false findings',async()=>{
    for(const failure of ['throw','wrong-model','malformed']){
      const f=await setup();const result=await f.run(0,{gateway:{...f.deps.gateway,transport:async(...args)=>{
        const response=await f.transport(...args);if(failure==='throw')throw new Error('private-provider-failure');
        if(failure==='malformed')return Response.json({unexpected:'private-output'});const body=await response.json();body.model='unapproved';return Response.json(body);
      }}});
      assert.equal(result.outcome,'attention-required');assert.equal((await f.step()).state,'outcome-unknown');assert.equal((await f.run()).outcome,'attention-required');
      assert.equal((await f.read()).status,'attention-required');assert.equal(f.state.calls,1);assert.equal(await f.reservations(),1);assert.equal(await f.count(),0);
    }
  });
  await check('lost scope dispatch acknowledgement prevents transport while lost completion acknowledgement recovers the existing checkpoint',async()=>{
    for(const state of ['dispatch-committed','succeeded']){
      const f=await setup();let dirty=false,lost=false;
      const uncertain:DatabasePool={async connect(){const c=await f.pools.execution.connect();return{query:async(sql:string,values?:unknown[])=>{
        const value=await c.query(sql,values);if(sql.startsWith('UPDATE steer_execution.scope_review_batches')&&String(values?.[0]).includes(`"state":"${state}"`))dirty=true;
        if(sql==='COMMIT'&&dirty&&!lost){lost=true;throw new Error('private-lost-ack');}return value;},release:(broken:boolean)=>c.release(broken)} as PoolClient;}};
      const r=f.make({}, {...f.pools,execution:uncertain});try{assert.equal((await r.run(f.batchId(),new AbortController().signal)).outcome,'attention-required');}finally{r.close();}
      assert.equal(lost,true);assert.equal(await f.reservations(),1);
      assert.equal((await f.run()).outcome,state==='succeeded'?'succeeded':'attention-required');assert.equal(f.state.calls,state==='succeeded'?1:0);
    }
  });
  await check('lost encrypted request or response acknowledgement never authorizes resend or promotes an unresolved observation',async()=>{
    for(const stage of ['request','response']){
      const f=await setup();let dirty=false,lost=false;
      const uncertain:DatabasePool={async connect(){const c=await f.pools.drafts.connect();return{query:async(sql:string,values?:unknown[])=>{
        const value=await c.query(sql,values);if(sql.includes('INSERT INTO steer_drafts.scope_review_observations')&&values?.includes(stage))dirty=true;
        if(sql==='COMMIT'&&dirty&&!lost){lost=true;throw new Error('private-journal-ack');}return value;},release:(broken:boolean)=>c.release(broken)} as PoolClient;}};
      const r=f.make({}, {...f.pools,drafts:uncertain});try{assert.equal((await r.run(f.batchId(),new AbortController().signal)).outcome,'attention-required');}finally{r.close();}
      assert.equal(lost,true);assert.equal((await f.step()).state,'outcome-unknown');assert.equal((await f.run()).outcome,'attention-required');
      assert.equal(f.state.calls,stage==='response'?1:0);assert.equal(await f.count(stage),1);assert.equal(await f.reservations(),1);
    }
  });
  await check('new human edits before scope execution or final dispatch stop calls, while edits during a sent call retain superseded historical results',async()=>{
    for(const when of ['before','final-dispatch','in-flight']){
      const f=await setup();if(when==='before')await f.edit();let n=0;
      const result=await f.run(0,{authorize:async({action})=>{if(when==='final-dispatch'&&action==='dispatch'&&++n===4)await f.edit();},
        gateway:{...f.deps.gateway,transport:async(...args)=>{if(when==='in-flight')await f.edit();return f.transport(...args);}}});
      assert.equal(result.outcome,when==='final-dispatch'?'attention-required':'superseded');assert.equal(f.state.calls,when==='in-flight'?1:0);
      assert.equal(await f.reservations(),when==='before'?0:1);assert.equal(await f.count(),when==='in-flight'?1:0);
      assert.equal((await f.drafts.read({draftId:f.draftId,revision:'latest'})).content.originalText,'A newer human correction');
      if(when==='in-flight'){assert.deepEqual(await f.run(),result);assert.equal((await f.read()).status,'superseded');assert.equal(f.state.calls,1);}
    }
  });
  await check('timeout, signal and shutdown hold scope admission until ignored-abort transport drains and discard late responses',async()=>{
    for(const cancel of ['timeout','signal','close']){
      const f=await setup(),entered=gate(),held=gate(),r=f.make({gateway:{...f.deps.gateway,transport:async(...args)=>{const value=await f.transport(...args);entered.release();await held.promise;return value;}}},f.pools,{maxDurationMs:3000});
      const signal=new AbortController();try{const running=r.run(f.batchId(),signal.signal);
        await Promise.race([entered.promise,running.then(()=>{throw new Error('Transport not reached');})]);
        if(cancel==='signal')signal.abort();if(cancel==='close')r.close();
        assert.equal((await running).outcome,'attention-required');assert.equal((await r.run(f.batchId(),new AbortController().signal)).outcome,'busy');
        assert.equal((await f.run()).outcome,'attention-required');assert.equal(f.state.calls,1);assert.equal(await f.count(),0);assert.equal(await f.reservations(),1);
        held.release();await delay(50);assert.equal(await f.count(),0);assert.equal((await f.run()).outcome,'attention-required');assert.equal(f.state.calls,1);
      }finally{held.release();r.close();}
    }
  });
  await check('scope key, source, profile and lifecycle losses prevent execution and withhold completed-result release',async()=>{
    const f=await setup();assert.equal((await f.run()).outcome,'succeeded');
    for(const originals of [{...f.deps.records.originals,authorizeOriginal:async()=>{throw new Error('private-source-denial');}},
      {...f.deps.records.originals,authorizeOriginal:async()=>false} as any,{...f.deps.records.originals,keyForDraft:async()=>({...f.key,bytes:randomBytes(32)})}]){
      const result=await f.run(0,{records:{...f.deps.records,originals}});assert.equal(result.outcome,'attention-required');
    }
    assert.equal((await f.run(0,{profile:{...f.input.original.profile,modelRoute:'changed'}})).outcome,'attention-required');
    assert.equal((await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()})).outcome,'ok');assert.equal((await f.run()).outcome,'attention-required');
    assert.equal(f.state.calls,1);assert.equal(await f.reservations(),1);assert.equal(await f.count(),1);
  });
  await check('cancelled scope key lookup keeps admission until the underlying key resolves and cannot cause late dispatch',async()=>{
    const f=await setup(),entered=gate(),held=gate();let keys=0;
    const r=f.make({records:{...f.deps.records,originals:{...f.deps.records.originals,keyForDraft:async(...args)=>{
      if(++keys===1){entered.release();await held.promise;}return f.deps.records.originals.keyForDraft(...args);
    }}}},f.pools,{maxDurationMs:1000});
    try{const signal=new AbortController(),running=r.run(f.batchId(),signal.signal);
      await Promise.race([entered.promise,running.then(()=>{throw new Error('Key lookup not reached');})]);signal.abort();
      assert.equal((await running).outcome,'attention-required');assert.equal((await r.run(f.batchId(),new AbortController().signal)).outcome,'busy');
      assert.equal(keys,1);assert.equal(await f.reservations(),0);assert.equal(f.state.calls,0);
      held.release();await delay(50);r.close();assert.equal(f.state.calls,0);
      assert.equal((await f.run()).outcome,'succeeded');assert.equal(f.state.calls,1);assert.equal(await f.reservations(),1);
    }finally{held.release();r.close();}
  });
  await check('scope response-body cancellation retains admission until underlying transport cleanup drains',async()=>{
    const f=await setup(),reading=gate(),cancelled=gate(),cleanup=gate();
    const r=f.make({gateway:{...f.deps.gateway,transport:async(...args)=>{
      await f.transport(...args);
      return new Response(new ReadableStream<Uint8Array>({pull(){reading.release();return new Promise<void>(()=>{});},cancel(){cancelled.release();return cleanup.promise;}}),
        {headers:{'content-type':'application/json'}});
    }}});
    try{const signal=new AbortController(),running=r.run(f.batchId(),signal.signal);
      await Promise.race([reading.promise,running.then(()=>{throw new Error('Body not reached');})]);signal.abort();
      assert.equal((await running).outcome,'attention-required');await cancelled.promise;
      assert.equal((await r.run(f.batchId(),new AbortController().signal)).outcome,'busy');assert.equal(f.state.calls,1);assert.equal(await f.count(),0);
      cleanup.release();await delay(50);assert.equal((await r.run(f.batchId(),new AbortController().signal)).outcome,'attention-required');assert.equal(f.state.calls,1);
    }finally{cleanup.release();r.close();}
  });
  await check('scope runner takes over an abandoned pre-dispatch lease using the existing reservation and newer fence',async()=>{
    const f=await setup(),batch=f.prepared.batches[0]!,ref={...f.target,batchId:f.batchId(),inputDigest:batch.inputDigest};
    const claimed=await f.reviews.claim({...ref,owner:'synthetic-abandoned-worker',leaseMs:100});assert.equal(claimed.outcome,'ok');if(claimed.outcome!=='ok')throw new Error();
    await delay(150);assert.equal((await f.run()).outcome,'succeeded');const current=await f.step();
    assert.equal(current.reservationId,claimed.value.reservationId);assert.ok(current.fencingToken>claimed.value.fencingToken);
    assert.notEqual(current.owner,claimed.value.owner);assert.equal(f.state.calls,1);assert.equal(await f.reservations(),1);
  });
  await check('expired or unknown scope batches and invalid gateway cannot reserve or send new work',async()=>{
    const f=await setup();for(const id of ['f'.repeat(64)]){const r=f.make();try{assert.equal((await r.run(id,new AbortController().signal)).outcome,'attention-required');}finally{r.close();}}
    assert.equal((await f.run(0,{gateway:{...f.deps.gateway,gatewayUrl:'https://not-permitted.invalid/v1'}})).outcome,'attention-required');
    assert.equal(await f.reservations(),0);assert.equal(f.state.calls,0);
    const expired=await setup(4,1200);await delay(Math.max(0,Date.parse(expired.execution.expiresAt)-Date.now()+25));
    assert.equal((await expired.run()).outcome,'attention-required');assert.equal(await expired.reservations(),0);assert.equal(expired.state.calls,0);
  });
  await check('scope planning reads the exact admitted multi-batch manifest without SQL mutations, gateway validation or reservations',async()=>{
    const f=await setup(34);let writes=0;
    const readonly=(pool:Pool):DatabasePool=>({async connect(){const c=await pool.connect();return{query:(sql:string,values?:unknown[])=>{
      if(/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i.test(sql)){writes++;throw new Error('Plan attempted mutation');}return c.query(sql,values);},release:(broken:boolean)=>c.release(broken)} as PoolClient;}});
    const r=f.make({gateway:{gatewayUrl:'invalid',gatewayKey:''}},{drafts:readonly(f.pools.drafts),execution:readonly(f.pools.execution)});
    try{const plan=await r.plan(new AbortController().signal);assert.equal(plan.outcome,'ready');assert.deepEqual(plan.batchIds,f.prepared.batches.map(b=>b.metadata.batchId));
      assert.deepEqual(await r.plan(new AbortController().signal),plan);assert.equal(Object.isFrozen(plan.batchIds),true);assert.equal(writes,0);assert.equal(f.state.calls,0);assert.equal(await f.reservations(),0);
      assert.equal(JSON.stringify(plan).includes(f.content.originalText),false);assert.equal(plan.executionAuthorized,false);
    }finally{r.close();}
  });
  await check('scope plan denial, changed source and expiry expose no executable batch list or new cost reservation',async()=>{
    for(const mode of ['denied','changed','expired']){
      const f=await setup(4,mode==='expired'?1200:3600000);if(mode==='changed')await f.edit();if(mode==='expired')await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));
      const r=f.make({authorize:async()=>{if(mode==='denied')throw new Error('Current identity denied');}});
      try{const result=await r.plan(new AbortController().signal);assert.equal(result.outcome,mode==='denied'?'attention-required':mode==='changed'?'superseded':'expired');
        assert.deepEqual(result.batchIds,[]);assert.equal(f.state.calls,0);assert.equal(await f.reservations(),0);
      }finally{r.close();}
    }
  });
  await testScopeWorkflow(setup,check);
}
