import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { DatabasePool } from '../src/runtime-pool.ts';
import { createDevelopmentObservationStore } from '../src/development-observations.ts';
import { createDevelopmentOriginalStore } from '../src/development-originals.ts';
import { createDevelopmentRequestReader } from '../src/development-requests.ts';
import { createDraftLifecycleStore } from '../src/draft-lifecycle.ts';
import { createDraftRevisionStore } from '../src/draft-revisions.ts';
import { createIntentOperationStore } from '../src/intent-operations.ts';
import { developmentOriginalHash as hash, describeDevelopmentOriginal } from '../src/development-original-contracts.ts';
import { originalFixture } from './development-original.fixture.ts';
import { createDevelopmentStepRuntime } from '../../../apps/worker/src/development-step-runtime.ts';
import { createRecordedDevelopmentModel } from '../../../apps/worker/src/recorded-development-model.ts';
import { RECORDED_MASTRA_REVISION } from '../../agents/src/recorded-mastra.ts';
type Deps = Parameters<typeof createDevelopmentObservationStore>[2];

export async function testDevelopmentObservations({admin,connect,check}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}) {
  const setup=async(dispatch=true,claim=true,recorded=false)=>{
    const config={organizationId:`observations-${randomUUID()}`,subject:'synthetic-human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
    const budget={organizationId:config.organizationId,subject:config.subject,configurationRevision:config.configurationRevision,budgetId:randomUUID(),approvalDigest:'b'.repeat(64),capMicrousd:30,architectMicrousd:3,testAgentMicrousd:2};
    await admin.query(`INSERT INTO steer_usage.model_budgets VALUES($1,$2,$3,$4,$5,30,3,2,now()-interval '1 minute',now()+interval '1 hour',true)`,[budget.organizationId,budget.budgetId,budget.subject,budget.configurationRevision,budget.approvalDigest]);
    const execution={...config,action:'develop',expiresAt:new Date(Date.now()+3600000).toISOString(),budget},pools={drafts:connect('steer_draft_runtime'),execution:connect('steer_app')};
    const key={keyId:`synthetic-${randomUUID()}`,bytes:randomBytes(32)},state={denied:false};
    const base={authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>key};
    const originals={...base,authorize:async()=>{},authorizeOriginal:async()=>{}},results={...base,authorizeResult:async()=>{}};
    const deps:Deps={originals,results,authorize:async()=>{if(state.denied)throw new Error('private-observation-denial');}};
    const lifecycle=createDraftLifecycleStore(pools.drafts,config,{authorize:async()=>{},verifyHold:async()=>{}});
    const created=await lifecycle.create({requestId:randomUUID()});assert.equal(created.outcome,'ok');if(created.outcome!=='ok')throw new Error();const draftId=created.value.draftId;
    const drafts=createDraftRevisionStore(pools.drafts,config,{authorize:base.authorizeDraft,keyForDraft:base.keyForDraft});
    const content={originalText:' Private observed original 🌸\r\n',clarificationTurns:['Exact answer'],documents:null};
    const saved=await drafts.append({draftId,mutationId:randomUUID(),expectedRevision:0,expectedDigest:null,content});assert.equal(saved.outcome,'acknowledged');if(saved.outcome!=='acknowledged')throw new Error();
    const described=await originalFixture(execution,{draftId,revision:1,sourceRevision:1,revisionDigest:saved.reference.revisionDigest,content});
    const original=recorded?await describeDevelopmentOriginal({...described.original,profiles:{
      architect:{...described.original.profiles.architect,runtimeRevision:RECORDED_MASTRA_REVISION},
      testAgent:{...described.original.profiles.testAgent,runtimeRevision:RECORDED_MASTRA_REVISION},
    }}):described;
    const operations=createIntentOperationStore(pools.execution,execution,{authorize:base.authorizeOperation,verifyCheckpoint:async()=>{throw new Error();}});
    const op=await operations.create({draftId,draftRevision:1,inputDigest:original.inputDigest});assert.equal(op.outcome,'ok');if(op.outcome!=='ok')throw new Error();
    const target={operationId:op.value.operationId,inputDigest:original.inputDigest},ref={...target,stepId:'architect' as const};
    const originalStore=createDevelopmentOriginalStore(pools,config,originals);assert.equal((await originalStore.put({...target,original:original.original})).outcome,'stored');originalStore.close();
    const reader={originals,results,authorizeRequest:async()=>{}},requests=createDevelopmentRequestReader(pools,config,reader);
    const prepared=await requests.read({...target,role:'architect'});requests.close();
    const owner=randomUUID(),fencingToken=1;
    if(claim){assert.equal((await operations.claim({...prepared.stepReference,owner,leaseMs:30000})).outcome,'ok');
      if(dispatch)assert.equal((await operations.transition({...prepared.stepReference,event:{type:'commit-dispatch',owner,fencingToken}})).dispatchAllowed,true);}
    const request={stage:'request' as const,adapterRevision:'synthetic-only/v1',protocol:'synthetic-json/v1',rendered:prepared.rendered,requestBody:JSON.stringify(prepared.rendered.request)+'\r\n'};
    const result={role:'architect' as const,output:{message:'Exact message',questions:[],brief:'# Candidate Brief 🌸\r\n',spec:'# Candidate Spec\n'}};
    const response={stage:'response' as const,requestDigest:hash(request),providerRequestId:'synthetic-request-id',responseBody:JSON.stringify({result,usage:{input:2,output:1}})+'\n',usage:{inputTokens:2,outputTokens:1,totalTokens:3},result};
    const make=(overrides:Partial<Deps>={},otherPools:Parameters<typeof createDevelopmentObservationStore>[0]=pools,patch={})=>createDevelopmentObservationStore(otherPools,{...config,...patch},{...deps,...overrides});
    const put=async(observation:unknown,overrides:Partial<Deps>={})=>{const store=make(overrides);try{return await store.put({...ref,owner,fencingToken,observation});}finally{store.close();}};
    const read=async(stage:'request'|'response',overrides:Partial<Deps>={})=>{const store=make(overrides);try{return await store.read({...ref,stage});}finally{store.close();}};
    const count=async()=>Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.development_observations WHERE operation_id=$1',[target.operationId])).rows[0].n);
    const gatewayProfiles=Object.fromEntries(Object.entries(original.original.profiles).map(([role,p])=>[role,{profileRevision:p.configurationRevision,
      instructions:p.instructions,modelRoute:p.modelRoute,maxOutputTokens:p.maxOutputTokens,allowedResponseModels:['synthetic-provider-model']}])) as Parameters<typeof createRecordedDevelopmentModel>[3]['gateway']['profiles'];
    const recordedModel=(transport:typeof fetch,otherPools=pools,authorize:Parameters<typeof createRecordedDevelopmentModel>[3]['authorize']=async()=>{})=>
      createRecordedDevelopmentModel(otherPools,config,target,{records:deps,authorize,gateway:{gatewayUrl:'http://127.0.0.1:4000/v1',gatewayKey:'synthetic-gateway-key',profiles:gatewayProfiles,transport}});
    return{config,execution,pools,key,state,deps,reader,lifecycle,drafts,draftId,saved,content,operations,target,ref,prepared,owner,fencingToken,request,response,make,put,read,count,recordedModel};
  };
  await check('immutable encrypted observation stages restore exact bodies and usage across reconstructed stores without implying execution',async()=>{
    const f=await setup();assert.equal((await f.put(f.request)).outcome,'stored');assert.equal((await f.put(f.response)).outcome,'stored');
    assert.deepEqual((await f.read('request')).observation,f.request);const response=await f.read('response');assert.deepEqual(response.observation,f.response);
    assert.equal(response.outputDigest,hash(f.response.result));assert.equal(response.executionAuthorized,false);assert.equal(response.retryAuthorized,false);
    assert.equal((await f.put(f.request)).outcome,'stored');assert.equal((await f.put(f.response)).outcome,'stored');assert.equal(await f.count(),2);
    const rows=await admin.query('SELECT record,encrypted_value FROM steer_drafts.development_observations WHERE operation_id=$1',[f.target.operationId]);
    for(const marker of ['Private observed original','Candidate Brief','Exact message','synthetic-request-id'])assert.ok(!JSON.stringify(rows.rows).includes(marker));
    assert.equal((await f.put({...f.request,requestBody:f.request.requestBody+' '})).outcome,'conflict');
    assert.equal((await f.put({...f.response,usage:{inputTokens:3,outputTokens:1,totalTokens:4}})).outcome,'conflict');assert.equal(await f.count(),2);
  });
  await check('observation capture rejects unsent steps, altered rendered requests, missing predecessors, wrong owners and inconsistent usage',async()=>{
    const unsent=await setup(false);assert.equal((await unsent.put(unsent.request)).outcome,'unavailable');assert.equal(await unsent.count(),0);
    const f=await setup();assert.equal((await f.put(f.response)).outcome,'conflict');
    const changed=structuredClone(f.request);changed.rendered.request.source+='changed';assert.equal((await f.put(changed)).outcome,'conflict');
    assert.equal((await f.make().put({...f.ref,owner:'wrong',fencingToken:1,observation:f.request})).outcome,'conflict');assert.equal(await f.count(),0);
    assert.equal((await f.put(f.request)).outcome,'stored');
    assert.equal((await f.put({...f.response,requestDigest:'f'.repeat(64)})).outcome,'conflict');
    assert.equal((await f.put({...f.response,result:{role:'test-agent',output:{exam:'NOT RUN'}}})).outcome,'conflict');
    assert.equal((await f.put({...f.response,usage:{inputTokens:2,outputTokens:1,totalTokens:4}})).outcome,'conflict');assert.equal(await f.count(),1);
  });
  await check('observation tables force owner RLS, deny ambient roles and cannot be updated or deleted by the runtime',async()=>{
    const f=await setup();assert.equal((await f.put(f.request)).outcome,'stored');
    const flags=(await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='steer_drafts.development_observations'::regclass")).rows[0];assert.ok(flags.relrowsecurity&&flags.relforcerowsecurity);
    assert.equal((await f.pools.drafts.query('SELECT * FROM steer_drafts.development_observations')).rowCount,0);
    for(const role of ['steer_app','steer_projector','steer_auth_runtime'])await assert.rejects(connect(role).query('SELECT * FROM steer_drafts.development_observations'),/permission denied/);
    await assert.rejects(f.pools.drafts.query('UPDATE steer_drafts.development_observations SET stage=stage'),/permission denied/);
    await assert.rejects(f.pools.drafts.query('DELETE FROM steer_drafts.development_observations'),/permission denied/);
    await assert.rejects(f.make({}, {drafts:admin,execution:f.pools.execution}).read({...f.ref,stage:'request'}));
    for(const patch of [{subject:'other-human'},{organizationId:'other-org'},{productId:'other-product'}])await assert.rejects(f.make({},f.pools,patch).read({...f.ref,stage:'request'}));
    assert.equal(await f.count(),1);
  });
  await check('holds, late observation revocation and damaged ciphertext deny restoration without deleting recorded bytes',async()=>{
    const held=await setup();assert.equal((await held.put(held.request)).outcome,'stored');
    assert.equal((await held.lifecycle.hold({draftId:held.draftId,holdReference:randomUUID()})).outcome,'ok');await assert.rejects(held.read('request'));assert.equal(await held.count(),1);
    const revoked=await setup();assert.equal((await revoked.put(revoked.request)).outcome,'stored');
    await assert.rejects(revoked.read('request',{originals:{...revoked.deps.originals,keyForDraft:async()=>{revoked.state.denied=true;return revoked.key;}}}));assert.equal(await revoked.count(),1);
    const broken=await setup();assert.equal((await broken.put(broken.request)).outcome,'stored');
    await admin.query("UPDATE steer_drafts.development_observations SET encrypted_value=jsonb_set(encrypted_value,'{tag}',to_jsonb(repeat('A',22))) WHERE operation_id=$1",[broken.target.operationId]);
    await assert.rejects(broken.read('request'));assert.equal(await broken.count(),1);
  });
  await check('lost request or response commit acknowledgement recovers the same observation and cannot produce duplicate stages',async()=>{
    for(const stage of ['request','response'] as const){
      const f=await setup();if(stage==='response')assert.equal((await f.put(f.request)).outcome,'stored');let lost=false;
      const uncertain:DatabasePool={async connect(){const c=await f.pools.drafts.connect();let inserted=false;return{query:async(sql:string,values?:unknown[])=>{
        const value=await c.query(sql,values);if(sql.startsWith('INSERT INTO steer_drafts.development_observations'))inserted=true;
        if(sql==='COMMIT'&&inserted&&!lost){lost=true;throw new Error('private-lost-ack');}return value;},release:(broken:boolean)=>c.release(broken)} as PoolClient;}};
      const store=f.make({}, {...f.pools,drafts:uncertain}),observation=stage==='request'?f.request:f.response;
      assert.equal((await store.put({...f.ref,owner:f.owner,fencingToken:f.fencingToken,observation})).outcome,'unknown');store.close();assert.ok(lost);
      assert.equal((await f.put(observation)).outcome,'stored');assert.deepEqual((await f.read(stage)).observation,observation);assert.equal(await f.count(),stage==='request'?1:2);
    }
  });
  await check('quarantined steps retain their request but cannot release observations or capture a late success',async()=>{
    const f=await setup();assert.equal((await f.put(f.request)).outcome,'stored');
    assert.equal((await f.operations.transition({...f.prepared.stepReference,event:{type:'outcome-unknown',fencingToken:1}})).outcome,'ok');
    await assert.rejects(f.read('request'));assert.equal((await f.put(f.response)).outcome,'unavailable');assert.equal(await f.count(),1);
  });
  await check('development runner verifies both roles from actual encrypted SQL observations with no in-memory provider map',async()=>{
    const f=await setup(false,false);let calls=0;
    const model={execute:async(input:Parameters<Parameters<typeof createDevelopmentStepRuntime>[3]['model']['execute']>[0])=>{
      const store=f.make(),ref={...f.target,stepId:input.rendered.role};
      try{
        const request={stage:'request',adapterRevision:'synthetic-only/v1',protocol:'synthetic-json/v1',rendered:input.rendered,requestBody:JSON.stringify(input.rendered.request)};
        const recorded=await store.put({...ref,owner:input.owner,fencingToken:input.fencingToken,observation:request});assert.equal(recorded.outcome,'stored');
        if(recorded.outcome!=='stored')throw new Error();calls++;
        const result=input.rendered.role==='architect'?f.response.result:{role:'test-agent',output:{exam:'# Synthetic Exam\nNOT RUN'}};
        assert.equal((await store.put({...ref,owner:input.owner,fencingToken:input.fencingToken,observation:{stage:'response',requestDigest:recorded.payloadDigest,
          providerRequestId:`synthetic-${calls}`,responseBody:JSON.stringify(result),usage:{inputTokens:null,outputTokens:null,totalTokens:null},result}})).outcome,'stored');return result;
      }finally{store.close();}
    },verify:async(binding:Parameters<Parameters<typeof createDevelopmentStepRuntime>[3]['model']['verify']>[0])=>{
      assert.equal(binding.organizationId,f.config.organizationId);const store=f.make();
      try{const actual=await store.read({operationId:binding.operationId,inputDigest:binding.inputDigest,stepId:binding.stepId,stage:'response'});
        assert.equal(actual.stepInputDigest,binding.stepInputDigest);assert.equal(actual.outputDigest,binding.outputDigest);assert.equal(actual.recordsPolicyDigest,binding.recordsPolicyDigest);
      }finally{store.close();}
    }};
    for(const role of ['architect','test-agent'] as const){
      const run=async()=>{const runtime=createDevelopmentStepRuntime(f.pools,f.config,f.target,{reader:f.reader,model,authorize:async()=>{}});
        try{return await runtime.run(role,new AbortController().signal);}finally{runtime.close();}};
      const first=await run();assert.equal(first.outcome,'succeeded');assert.deepEqual(await run(),first);
    }
    assert.equal(calls,2);assert.equal(await f.count(),4);
    assert.equal(Number((await admin.query('SELECT sum(amount_microusd) AS n FROM steer_usage.model_reservations WHERE budget_id=$1',[f.execution.budget.budgetId])).rows[0].n),5);
  });
  await check('recorded originals stay bound to their source revision after a later human correction',async()=>{
    const f=await setup();assert.equal((await f.put(f.request)).outcome,'stored');
    assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
      content:{...f.content,originalText:'The newer human correction'}})).outcome,'acknowledged');
    assert.equal((await f.put(f.response)).outcome,'stored');assert.deepEqual((await f.read('request')).observation,f.request);
    assert.equal((await f.drafts.read({draftId:f.draftId,revision:'latest'})).content.originalText,'The newer human correction');
  });
  await check('concurrent observation writers converge on one immutable stage and SQL refuses a response with an unrelated request digest',async()=>{
    const f=await setup();const outcomes=await Promise.all(Array.from({length:4},()=>f.put(f.request)));
    assert.ok(outcomes.every(v=>v.outcome==='stored'));assert.equal(await f.count(),1);
    assert.equal(outcomes.filter(v=>v.outcome==='stored'&&v.created).length,1);
    const row=(await admin.query('SELECT * FROM steer_drafts.development_observations WHERE operation_id=$1',[f.target.operationId])).rows[0];
    const c=await f.pools.drafts.connect();
    try{
      await c.query('BEGIN');await c.query("SELECT set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)",[f.config.organizationId,f.config.subject,f.config.productId]);
      const record={...row.record,stage:'response',requestDigest:'f'.repeat(64),outputDigest:hash(f.response.result)};
      await assert.rejects(c.query(`INSERT INTO steer_drafts.development_observations (organization_id,subject,product_id,operation_id,step_id,stage,draft_id,draft_revision,payload_digest,record,encrypted_value)
        VALUES($1,$2,$3,$4,$5,'response',$6,$7,$8,$9::jsonb,$10::jsonb)`,[row.organization_id,row.subject,row.product_id,row.operation_id,row.step_id,row.draft_id,row.draft_revision,row.payload_digest,JSON.stringify(record),JSON.stringify(row.encrypted_value)]),/Invalid development response/);
    }finally{await c.query('ROLLBACK');c.release();}
    assert.equal(await f.count(),1);
  });
  await check('actual Mastra transport recording completes and restores both SQL-backed roles without another provider send',async()=>{
    const f=await setup(false,false,true);let calls=0;
    const transport:typeof fetch=async(url,init)=>{
      assert.equal(String(url),'http://127.0.0.1:4000/v1/chat/completions');assert.equal(init?.redirect,'error');calls++;
      const body=JSON.parse(String(init?.body)),role=body.response_format.json_schema.schema.properties.exam?'test-agent':'architect';
      const reader=f.make();try{const saved=await reader.read({...f.target,stepId:role,stage:'request'});
        assert.equal(saved.observation.stage,'request');if(saved.observation.stage==='request')assert.equal(saved.observation.requestBody,init?.body);
      }finally{reader.close();}
      if(role==='test-agent'){const source=JSON.parse(body.messages[1].content);assert.equal(source.brief,f.response.result.output.brief);assert.ok(!body.messages[1].content.includes('Exact message'));}
      const output=role==='architect'?f.response.result.output:{exam:' # Recorded Exam\r\nNOT RUN '};
      return new Response(JSON.stringify({id:`synthetic-completion-${calls}`,object:'chat.completion',created:1,model:'synthetic-provider-model',
        choices:[{index:0,message:{role:'assistant',content:JSON.stringify(output)},finish_reason:'stop'}],usage:{prompt_tokens:2,completion_tokens:1,total_tokens:3}})+'\r\n',
        {headers:{'content-type':'application/json','x-request-id':`synthetic-http-${calls}`}});
    };
    const run=async(role:string)=>{const model=f.recordedModel(transport),runtime=createDevelopmentStepRuntime(f.pools,f.config,f.target,{reader:f.reader,model,authorize:async()=>{}});
      try{return await runtime.run(role,new AbortController().signal);}finally{runtime.close();model.close();}};
    for(const role of ['architect','test-agent']){const result=await run(role);assert.equal(result.outcome,'succeeded');assert.deepEqual(await run(role),result);}
    assert.equal(calls,2);assert.equal(await f.count(),4);
    assert.equal(Number((await admin.query('SELECT sum(amount_microusd) AS n FROM steer_usage.model_reservations WHERE budget_id=$1',[f.execution.budget.budgetId])).rows[0].n),5);
  });
  await check('recorded transport cannot send after lost request acknowledgement, and lost response acknowledgement cannot cause a resend',async()=>{
    for(const stage of ['request','response'] as const){
      const f=await setup(false,false,true);let lost=false,calls=0;
      const transport:typeof fetch=async()=>{calls++;return Response.json({id:'synthetic',object:'chat.completion',created:1,model:'synthetic-provider-model',
        choices:[{index:0,message:{role:'assistant',content:JSON.stringify(f.response.result.output)},finish_reason:'stop'}],usage:{prompt_tokens:2,completion_tokens:1,total_tokens:3}});};
      const uncertain:DatabasePool={async connect(){const c=await f.pools.drafts.connect();let inserted=false;return{query:async(sql:string,values?:unknown[])=>{
        const result=await c.query(sql,values);if(sql.startsWith('INSERT INTO steer_drafts.development_observations')&&values?.[5]===stage)inserted=true;
        if(sql==='COMMIT'&&inserted&&!lost){lost=true;throw new Error('private-lost-ack');}return result;},release:(broken:boolean)=>c.release(broken)} as PoolClient;}};
      const model=createRecordedDevelopmentModel({...f.pools,drafts:uncertain},f.config,f.target,{records:f.deps,authorize:async()=>{},
        gateway:{gatewayUrl:'http://127.0.0.1:4000/v1',gatewayKey:'synthetic-gateway-key',profiles:{architect:{profileRevision:'synthetic-prompts-r1',instructions:f.prepared.rendered.request.instructions,
          modelRoute:'synthetic-only',maxOutputTokens:1000,allowedResponseModels:['synthetic-provider-model']},testAgent:{profileRevision:'synthetic-prompts-r1',instructions:' Separate synthetic Test Agent instructions ',modelRoute:'synthetic-only',maxOutputTokens:1000,allowedResponseModels:['synthetic-provider-model']}},transport}});
      const runtime=createDevelopmentStepRuntime(f.pools,f.config,f.target,{reader:f.reader,model,authorize:async()=>{}});
      try{assert.equal((await runtime.run('architect',new AbortController().signal)).outcome,'attention-required');}finally{runtime.close();model.close();}
      assert.ok(lost);assert.equal(calls,stage==='request'?0:1);assert.equal(await f.count(),stage==='request'?1:2);
      const recovered=f.recordedModel(transport),next=createDevelopmentStepRuntime(f.pools,f.config,f.target,{reader:f.reader,model:recovered,authorize:async()=>{}});
      try{assert.equal((await next.run('architect',new AbortController().signal)).outcome,'attention-required');}finally{next.close();recovered.close();}
      assert.equal(calls,stage==='request'?0:1);
    }
  });
  await check('an already recorded request cannot buy another transport send even through a newly constructed model binding',async()=>{
    const f=await setup(true,true,true);let calls=0;
    const transport:typeof fetch=async()=>{calls++;return Response.json({id:'synthetic',object:'chat.completion',created:1,model:'synthetic-provider-model',
      choices:[{index:0,message:{role:'assistant',content:JSON.stringify(f.response.result.output)},finish_reason:'stop'}]});};
    const step=(await f.operations.inspect(f.target));assert.equal(step.outcome,'ok');if(step.outcome!=='ok')throw new Error();
    const input={rendered:f.prepared.rendered,owner:f.owner,fencingToken:1,reservationId:step.value.steps[0]!.record.reservationId!};
    const first=f.recordedModel(transport);try{assert.deepEqual(await first.execute(input,new AbortController().signal),f.response.result);}finally{first.close();}
    const second=f.recordedModel(transport);try{await assert.rejects(second.execute(input,new AbortController().signal));}finally{second.close();}
    assert.equal(calls,1);assert.equal(await f.count(),2);
  });
  await check('model authority revoked after durable request capture prevents transport and preserves the consumed request record',async()=>{
    const f=await setup(false,false,true);let calls=0;
    const model=f.recordedModel(async()=>{calls++;throw new Error('must not send');},f.pools,async ctx=>{
      if(ctx.action==='dispatch'&&await f.count()>0)throw new Error('private-revoked');
    });
    const runtime=createDevelopmentStepRuntime(f.pools,f.config,f.target,{reader:f.reader,model,authorize:async()=>{}});
    try{assert.equal((await runtime.run('architect',new AbortController().signal)).outcome,'attention-required');}finally{runtime.close();model.close();}
    assert.equal(calls,0);assert.equal(await f.count(),1);
  });
  await check('a source correction during the final model-authorization wait prevents a stale transport send',async()=>{
    const f=await setup(false,false,true);let calls=0,afterCaptureChecks=0;
    const model=f.recordedModel(async()=>{calls++;throw new Error('must not send stale source');},f.pools,async ctx=>{
      if(ctx.action==='dispatch'&&await f.count()>0&&++afterCaptureChecks===2){
        assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
          content:{...f.content,originalText:'A correction during the last authorization wait'}})).outcome,'acknowledged');
      }
    });
    const runtime=createDevelopmentStepRuntime(f.pools,f.config,f.target,{reader:f.reader,model,authorize:async()=>{}});
    try{assert.equal((await runtime.run('architect',new AbortController().signal)).outcome,'attention-required');}finally{runtime.close();model.close();}
    assert.equal(afterCaptureChecks,2);assert.equal(calls,0);assert.equal(await f.count(),1);
    assert.equal((await f.drafts.read({draftId:f.draftId,revision:'latest'})).content.originalText,'A correction during the last authorization wait');
  });
}
