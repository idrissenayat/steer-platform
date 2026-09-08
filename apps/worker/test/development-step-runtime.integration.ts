import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import type { DatabasePool } from '@steer/data/runtime-pool';
import { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import { createDraftRevisionStore } from '@steer/data/draft-revisions';
import { createDevelopmentOriginalStore } from '@steer/data/development-originals';
import { createIntentOperationStore } from '@steer/data/intent-operations';
import { developmentOriginalHash as hash } from '@steer/data/development-original-contracts';
import { originalFixture } from '../../../packages/data/test/development-original.fixture.ts';
import { createDevelopmentStepRuntime,type DevelopmentObservationBinding,type RecordedDevelopmentModel } from '../src/development-step-runtime.ts';
type Dependencies=Parameters<typeof createDevelopmentStepRuntime>[3];
export async function testDevelopmentStepRuntime({admin,connect,check}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}){
  const setup=async(ttl=3600000)=>{
    const config={organizationId:`runtime-${randomUUID()}`,subject:'synthetic-human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'runtime-r1',recordsPolicyDigest:'a'.repeat(64)};
    const budget={organizationId:config.organizationId,subject:config.subject,configurationRevision:config.configurationRevision,budgetId:randomUUID(),approvalDigest:'b'.repeat(64),capMicrousd:30,architectMicrousd:3,testAgentMicrousd:2};
    await admin.query(`INSERT INTO steer_usage.model_budgets VALUES($1,$2,$3,$4,$5,30,3,2,now()-interval '1 minute',now()+interval '1 hour',true)`,[budget.organizationId,budget.budgetId,budget.subject,budget.configurationRevision,budget.approvalDigest]);
    const execution={...config,action:'develop',expiresAt:new Date(Date.now()+ttl).toISOString(),budget},pools={drafts:connect('steer_draft_runtime'),execution:connect('steer_app')},key={keyId:`synthetic-${randomUUID()}`,bytes:randomBytes(32)};
    const source={originalText:' Exact private runtime intent 🌸\r\n',clarificationTurns:['Exact human reply'],documents:{brief:'Original Brief',spec:'Original Spec',exam:'Old Exam must not leak'}};
    const base={authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>key};
    const originals={...base,authorize:async()=>{},authorizeOriginal:async()=>{}},reader={originals,results:{...base,authorizeResult:async()=>{}},authorizeRequest:async()=>{}};
    const lifecycle=createDraftLifecycleStore(pools.drafts,config,{authorize:async()=>{}}),created=await lifecycle.create({requestId:randomUUID()});assert.equal(created.outcome,'ok');if(created.outcome!=='ok')throw new Error();const draftId=created.value.draftId;
    const drafts=createDraftRevisionStore(pools.drafts,config,{authorize:base.authorizeDraft,keyForDraft:base.keyForDraft}),saved=await drafts.append({draftId,mutationId:randomUUID(),expectedRevision:0,expectedDigest:null,content:source});
    assert.equal(saved.outcome,'acknowledged');if(saved.outcome!=='acknowledged')throw new Error();
    const original=await originalFixture(execution,{draftId,revision:1,sourceRevision:1,revisionDigest:saved.reference.revisionDigest,content:source});
    const operations=createIntentOperationStore(pools.execution,execution,{authorize:base.authorizeOperation,verifyCheckpoint:async()=>{throw new Error();}}),op=await operations.create({draftId,draftRevision:1,inputDigest:original.inputDigest});
    assert.equal(op.outcome,'ok');if(op.outcome!=='ok')throw new Error();const target={operationId:op.value.operationId,inputDigest:original.inputDigest};
    assert.equal((await createDevelopmentOriginalStore(pools,config,originals).put({...target,original:original.original})).outcome,'stored');
    const state={calls:0,questions:false,verifyDenied:false,wrongRole:false},observations=new Map<string,DevelopmentObservationBinding>();
    const step=async(role:string)=>(await admin.query('SELECT record FROM steer_execution.intent_steps WHERE operation_id=$1 AND step_id=$2',[target.operationId,role])).rows[0]?.record;
    const model:RecordedDevelopmentModel={execute:async request=>{
      state.calls++;const recorded=await step(request.rendered.role);assert.equal(recorded.state,'dispatch-committed');assert.equal(recorded.owner,request.owner);assert.equal(recorded.fencingToken,request.fencingToken);assert.equal(recorded.reservationId,request.reservationId);
      const stepInputDigest=hash(['steer-development-role-input/v1',request.rendered]);assert.equal(recorded.binding.inputDigest,stepInputDigest);
      const payload=JSON.parse(request.rendered.request.source);assert.equal(payload.intent,source.originalText);assert.ok(!request.rendered.request.source.includes('Old Exam must not leak'));
      const role=state.wrongRole?'test-agent':request.rendered.role;
      const result=role==='architect'?{role,output:{message:'Private Architect commentary',questions:state.questions?['Necessary question?']:[],brief:state.questions?null:'# Exact candidate Brief\r\n',spec:state.questions?null:'# Exact candidate Spec\n'}}:
        {role,output:{exam:'# Exact candidate Exam — NOT RUN\n'}};
      if(request.rendered.role==='test-agent'){assert.equal(payload.brief,'# Exact candidate Brief\r\n');assert.ok(!request.rendered.request.source.includes('Private Architect commentary'));}
      observations.set(request.rendered.role,{organizationId:config.organizationId,...target,stepId:request.rendered.role,stepInputDigest,outputDigest:hash(result),recordsPolicyDigest:config.recordsPolicyDigest});return result;
    },verify:async binding=>{if(state.verifyDenied)throw new Error('private-provider-record-denial');assert.deepEqual(binding,observations.get(binding.stepId));}};
    const deps:Dependencies={reader,model,authorize:async ctx=>{if(ctx.action==='dispatch'){assert.deepEqual(ctx.execution,execution);assert.ok(ctx.request);}}};
    const make=(overrides:Partial<Dependencies>={},otherPools:Parameters<typeof createDevelopmentStepRuntime>[0]=pools,options={})=>createDevelopmentStepRuntime(otherPools,config,target,{...deps,...overrides},options);
    const run=async(role:string,overrides:Partial<Dependencies>={})=>{const runtime=make(overrides);try{return await runtime.run(role,new AbortController().signal);}finally{runtime.close();}};
    const used=async()=>Number((await admin.query('SELECT coalesce(sum(amount_microusd),0) AS used FROM steer_usage.model_reservations WHERE budget_id=$1',[budget.budgetId])).rows[0].used);
    const results=async()=>Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.development_results WHERE operation_id=$1',[target.operationId])).rows[0].n);
    return{config,pools,execution,target,drafts,draftId,saved,source,state,deps,model,make,run,used,results,step};
  };
  await check('durable development runner dispatches each exact role once and reconstructs completed checkpoints without buying another call',async()=>{
    const f=await setup(),architect=await f.run('architect');assert.equal(architect.outcome,'succeeded');assert.equal(f.state.calls,1);assert.equal(await f.used(),3);
    assert.deepEqual(await f.run('architect'),architect);assert.equal(f.state.calls,1);
    const exam=await f.run('test-agent');assert.equal(exam.outcome,'succeeded');assert.equal(f.state.calls,2);assert.equal(await f.used(),5);assert.equal(await f.results(),2);
    assert.deepEqual(await f.run('test-agent'),exam);assert.equal(f.state.calls,2);assert.equal(exam.executionAuthorized,false);assert.equal(exam.retryAuthorized,false);
    assert.ok(!JSON.stringify([architect,exam]).includes('Exact candidate'));assert.ok(!JSON.stringify([architect,exam]).includes('private runtime intent'));
  });
  await check('a clarified Architect checkpoint stops Test Agent dispatch and current authority denial prevents any reservation',async()=>{
    const f=await setup();f.state.questions=true;assert.equal((await f.run('architect')).outcome,'needs-clarification');
    assert.equal((await f.run('test-agent')).outcome,'attention-required');assert.equal(f.state.calls,1);assert.equal(await f.used(),3);
    const denied=await setup();assert.equal((await denied.run('architect',{authorize:async ctx=>{if(ctx.action==='dispatch')throw new Error('private-current-denial');}})).outcome,'attention-required');
    assert.equal(denied.state.calls,0);assert.equal(await denied.used(),0);
    const late=await setup();let authorizations=0;assert.equal((await late.run('architect',{authorize:async ctx=>{if(ctx.action==='dispatch'&&++authorizations===3)throw new Error('private-after-commit');}})).outcome,'attention-required');
    assert.equal(late.state.calls,0);assert.equal(await late.used(),3);assert.equal((await late.step('architect')).state,'outcome-unknown');
  });
  await check('competing reconstructed runners cannot dispatch the same role while the acknowledged owner is executing',async()=>{
    const f=await setup();let entered!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{entered=r;}),held=new Promise<void>(r=>{release=r;});
    const first=f.make({model:{...f.model,execute:async(input,signal)=>{const result=await f.model.execute(input,signal);entered();await held;return result;}}});
    const running=first.run('architect',new AbortController().signal);await Promise.race([reached,running.then(()=>{throw new Error('Synthetic provider was not reached.');})]);
    const competing=await f.run('architect');assert.notEqual(competing.outcome,'succeeded');release();assert.equal((await running).outcome,'succeeded');first.close();
    assert.equal(f.state.calls,1);assert.equal(await f.used(),3);assert.equal((await f.run('architect')).outcome,'succeeded');assert.equal(f.state.calls,1);
  });
  await check('uncertain, malformed and unverifiable model outcomes quarantine the sent step and never automatically resend it',async()=>{
    for(const failure of ['throw','wrong-role','unverified']){
      const f=await setup();if(failure==='wrong-role')f.state.wrongRole=true;if(failure==='unverified')f.state.verifyDenied=true;
      const first=await f.run('architect',failure==='throw'?{model:{...f.model,execute:async()=>{f.state.calls++;throw new Error('private-provider-uncertain');}}}:{});
      assert.equal(first.outcome,'attention-required');assert.equal((await f.step('architect')).state,'outcome-unknown');
      assert.equal((await f.run('architect')).outcome,'attention-required');assert.equal(f.state.calls,1);assert.equal(await f.results(),0);assert.equal(await f.used(),3);
    }
  });
  await check('provider timeout and cancellation retain consumed reservations and suppress late results without another dispatch',async()=>{
    for(const cancel of ['timeout','signal','close']){
      const f=await setup();let entered!:()=>void,release!:()=>void,providerCalls=0;const reached=new Promise<void>(r=>{entered=r;}),held=new Promise<void>(r=>{release=r;});
      const runtime=f.make({model:{...f.model,execute:async(input,signal)=>{providerCalls++;const result=await f.model.execute(input,signal);entered();await held;return result;}}},f.pools,{maxDurationMs:3000});
      const cancellation=new AbortController(),running=runtime.run('architect',cancellation.signal);
      await Promise.race([reached,running.then(()=>{throw new Error('Synthetic provider was not reached.');})]);
      if(cancel==='signal')cancellation.abort();if(cancel==='close')runtime.close();
      assert.equal((await running).outcome,'attention-required');assert.equal((await runtime.run('architect',new AbortController().signal)).outcome,'busy');
      assert.equal((await f.run('architect')).outcome,'attention-required');assert.equal(providerCalls,1);assert.equal(await f.used(),3);
      runtime.close();release();await new Promise(r=>setTimeout(r,50));assert.equal(await f.results(),0);assert.equal((await f.step('architect')).state,'outcome-unknown');
    }
  });
  await check('lost SQL dispatch acknowledgement never reaches the model and lost checkpoint acknowledgement recovers the existing result',async()=>{
    for(const state of ['dispatch-committed','succeeded']){
      const f=await setup();let dirty=false,lost=false;
      const uncertain:DatabasePool={async connect(){const c=await f.pools.execution.connect();return{query:async(sql:string,values?:unknown[])=>{
        const result=await c.query(sql,values);if(sql.startsWith('UPDATE steer_execution.intent_steps')&&values?.some(v=>typeof v==='string'&&v.includes(`"state":"${state}"`)))dirty=true;
        if(sql==='COMMIT'&&dirty&&!lost){lost=true;throw new Error('private-lost-ack');}return result;},release:(broken:boolean)=>c.release(broken)} as PoolClient;}};
      const runtime=f.make({}, {...f.pools,execution:uncertain}),first=await runtime.run('architect',new AbortController().signal);runtime.close();
      assert.equal(lost,true);assert.equal(first.outcome,'attention-required');assert.equal(await f.used(),3);
      if(state==='dispatch-committed'){assert.equal(f.state.calls,0);assert.equal((await f.run('architect')).outcome,'attention-required');assert.equal(f.state.calls,0);}
      else{assert.equal(f.state.calls,1);assert.equal((await f.run('architect')).outcome,'succeeded');assert.equal(f.state.calls,1);assert.equal(await f.results(),1);}
    }
  });
  await check('a human edit during model execution preserves the original result as superseded and cannot trigger Test Agent work',async()=>{
    const f=await setup(),first=await f.run('architect',{model:{...f.model,execute:async(input,signal)=>{
      assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
        content:{...f.source,originalText:'A newer human correction'}})).outcome,'acknowledged');return f.model.execute(input,signal);
    }}});assert.equal(first.outcome,'superseded');assert.equal(await f.results(),1);assert.equal(f.state.calls,1);
    assert.equal((await f.run('test-agent')).outcome,'attention-required');assert.equal(f.state.calls,1);assert.equal(await f.used(),3);
    assert.equal((await f.drafts.read({draftId:f.draftId,revision:'latest'})).content.originalText,'A newer human correction');
  });
  await check('an operation expiring after acknowledged dispatch but before the final source/state check never reaches the model',async()=>{
    const f=await setup(2000);let authorizations=0;
    const first=await f.run('architect',{authorize:async ctx=>{if(ctx.action==='dispatch'&&++authorizations===3)
      await new Promise(r=>setTimeout(r,Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50)));}});
    assert.equal(authorizations,3);assert.equal(first.outcome,'attention-required');assert.equal(f.state.calls,0);assert.equal(await f.used(),3);
    assert.equal((await f.run('architect')).outcome,'attention-required');assert.equal(f.state.calls,0);
  });
}
