import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import { createDraftLifecycleStore } from '../src/draft-lifecycle.ts';
import { createDraftRevisionStore } from '../src/draft-revisions.ts';
import { createDevelopmentOriginalStore } from '../src/development-originals.ts';
import { createIntentOperationStore } from '../src/intent-operations.ts';
import { createDevelopmentResultStore } from '../src/development-results.ts';
import { createDevelopmentRequestReader } from '../src/development-requests.ts';
import { originalFixture } from './development-original.fixture.ts';
type Dependencies=Parameters<typeof createDevelopmentRequestReader>[2];
export async function testDevelopmentRequests({admin,connect,check}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}){
  const setup=async(ttl=3600000)=>{
    const config={organizationId:`requests-${randomUUID()}`,subject:'synthetic-human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'requests-r1',recordsPolicyDigest:'a'.repeat(64)};
    const budget={organizationId:config.organizationId,subject:config.subject,configurationRevision:config.configurationRevision,budgetId:randomUUID(),approvalDigest:'b'.repeat(64),capMicrousd:30,architectMicrousd:3,testAgentMicrousd:2};
    await admin.query(`INSERT INTO steer_usage.model_budgets VALUES($1,$2,$3,$4,$5,30,3,2,now()-interval '1 minute',now()+interval '1 hour',true)`,[budget.organizationId,budget.budgetId,budget.subject,budget.configurationRevision,budget.approvalDigest]);
    const execution={...config,action:'develop',expiresAt:new Date(Date.now()+ttl).toISOString(),budget},pools={drafts:connect('steer_draft_runtime'),execution:connect('steer_app')};
    const key={keyId:`synthetic-${randomUUID()}`,bytes:randomBytes(32)},source={originalText:' Exact original source 🌸\r\n',clarificationTurns:['An exact human clarification'],
      documents:{brief:'Old Brief-marker',spec:'Old Spec-marker',exam:'Forbidden old Exam-marker'}};
    const base={authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>key};
    const originals={...base,authorize:async()=>{},authorizeOriginal:async()=>{}},resultDeps={...base,authorizeResult:async()=>{}};
    const lifecycle=createDraftLifecycleStore(pools.drafts,config,{authorize:async()=>{},verifyHold:async()=>{}}),created=await lifecycle.create({requestId:randomUUID()});
    assert.equal(created.outcome,'ok');if(created.outcome!=='ok')throw new Error();const draftId=created.value.draftId;
    const drafts=createDraftRevisionStore(pools.drafts,config,{authorize:base.authorizeDraft,keyForDraft:base.keyForDraft}),saved=await drafts.append({draftId,mutationId:randomUUID(),expectedRevision:0,expectedDigest:null,content:source});
    assert.equal(saved.outcome,'acknowledged');if(saved.outcome!=='acknowledged')throw new Error();
    const input=await originalFixture(execution,{draftId,revision:1,sourceRevision:1,revisionDigest:saved.reference.revisionDigest,content:source}),results=createDevelopmentResultStore(pools,execution,resultDeps);
    const operations=createIntentOperationStore(pools.execution,execution,{authorize:base.authorizeOperation,verifyCheckpoint:ref=>results.verifyCheckpoint(ref)});
    const op=await operations.create({draftId,draftRevision:1,inputDigest:input.inputDigest});assert.equal(op.outcome,'ok');if(op.outcome!=='ok')throw new Error();
    const ref={operationId:op.value.operationId,inputDigest:input.inputDigest};
    assert.equal((await createDevelopmentOriginalStore(pools,config,originals).put({...ref,original:input.original})).outcome,'stored');
    const dependencies:Dependencies={originals,results:resultDeps,authorizeRequest:async()=>{}},make=(patch:Partial<Dependencies>={})=>createDevelopmentRequestReader(pools,config,{...dependencies,...patch});
    const used=async()=>Number((await admin.query('SELECT coalesce(sum(amount_microusd),0) AS used FROM steer_usage.model_reservations WHERE budget_id=$1',[budget.budgetId])).rows[0].used);
    const architect=await make().read({...ref,role:'architect'});
    const finishArchitect=async(options:{questions?:boolean;wrongInput?:boolean;checkpoint?:boolean}={})=>{
      const step={...architect.stepReference,...(options.wrongInput?{stepInputDigest:'f'.repeat(64)}:{})};
      assert.equal((await operations.claim({...step,owner:'synthetic-worker',leaseMs:300000})).outcome,'ok');
      assert.equal((await operations.transition({...step,event:{type:'commit-dispatch',owner:'synthetic-worker',fencingToken:1}})).dispatchAllowed,true);
      const result={role:'architect',output:{message:'Forbidden Architect commentary-marker',questions:options.questions?['Necessary question?']:[],
        brief:options.questions?null:' Exact generated Brief 🌸\r\n',spec:options.questions?null:' Exact generated Spec\n '}};
      const captured=await results.put({...ref,stepId:'architect',owner:'synthetic-worker',fencingToken:1,result});assert.equal(captured.outcome,'stored');if(captured.outcome!=='stored')throw new Error();
      if(options.checkpoint!==false)assert.equal((await operations.transition({...step,event:{type:'checkpoint',owner:'synthetic-worker',fencingToken:1,resultRef:captured.checkpoint.resultRef,resultDigest:captured.checkpoint.resultDigest}})).outcome,'ok');
      return{step,result,checkpoint:captured.checkpoint};
    };
    return{config,execution,pools,draftId,source,saved,drafts,lifecycle,ref,operations,results,dependencies,make,used,architect,finishArchitect};
  };
  await check('actual original and checkpoint stores reconstruct exact role requests whose digests own the Architect and Test Agent reservations',async()=>{
    const f=await setup();assert.equal(await f.used(),0);assert.deepEqual(await f.make().read({...f.ref,role:'architect'}),f.architect);
    const complete=await f.finishArchitect();await assert.rejects(f.make().read({...f.ref,role:'architect'}));
    const exam=await f.make().read({...f.ref,role:'test-agent'}),payload=JSON.parse(exam.rendered.request.source);
    assert.equal(payload.intent,f.source.originalText);assert.equal(payload.brief,complete.result.output.brief);assert.equal(payload.spec,complete.result.output.spec);
    assert.deepEqual(payload.originalDocuments,{brief:f.source.documents.brief,spec:f.source.documents.spec});
    for(const marker of ['Forbidden old Exam-marker','Forbidden Architect commentary-marker'])assert.ok(!JSON.stringify(exam).includes(marker));
    assert.equal(exam.stepReference.predecessorResultDigest,complete.checkpoint.resultDigest);assert.equal(await f.used(),3);
    assert.equal((await f.operations.claim({...exam.stepReference,owner:'synthetic-test-worker',leaseMs:300000})).outcome,'ok');
    assert.deepEqual(await f.make().read({...f.ref,role:'test-agent'}),exam);assert.equal(await f.used(),5);
    assert.equal((await f.operations.transition({...exam.stepReference,event:{type:'commit-dispatch',owner:'synthetic-test-worker',fencingToken:1}})).dispatchAllowed,true);
    await assert.rejects(f.make().read({...f.ref,role:'test-agent'}));assert.equal(await f.used(),5);
  });
  await check('Test Agent rendering requires a succeeded exact-request checkpoint, not a captured arbitrary hash or unanswered clarification',async()=>{
    const noCheckpoint=await setup();await noCheckpoint.finishArchitect({checkpoint:false});await assert.rejects(noCheckpoint.make().read({...noCheckpoint.ref,role:'test-agent'}));
    const wrong=await setup();await wrong.finishArchitect({wrongInput:true});await assert.rejects(wrong.make().read({...wrong.ref,role:'test-agent'}));
    const questions=await setup();await questions.finishArchitect({questions:true});await assert.rejects(questions.make().read({...questions.ref,role:'test-agent'}));
    for(const f of [noCheckpoint,wrong,questions])assert.equal(await f.used(),3);
  });
  await check('new edits and draft holds invalidate role preparation even though originals and an Architect result remain retained',async()=>{
    const f=await setup();await f.finishArchitect();
    assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
      content:{...f.source,originalText:'Newer human intent'}})).outcome,'acknowledged');
    await assert.rejects(f.make().read({...f.ref,role:'test-agent'}));assert.equal(await f.used(),3);
    const held=await setup();await held.finishArchitect();await held.lifecycle.hold({draftId:held.draftId,holdReference:randomUUID()});await assert.rejects(held.make().read({...held.ref,role:'test-agent'}));
  });
  await check('late request permission or source changes during checkpoint reads withhold role context and never reserve Test Agent work',async()=>{
    const f=await setup();await f.finishArchitect();let checks=0;
    await assert.rejects(f.make({authorizeRequest:async()=>{if(++checks===2)throw new Error('private-revoked');}}).read({...f.ref,role:'test-agent'}));assert.equal(checks,2);
    let updated=false;
    await assert.rejects(f.make({results:{...f.dependencies.results,authorizeResult:async()=>{if(updated)return;updated=true;
      assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
        content:{...f.source,originalText:'Human edit during checkpoint read'}})).outcome,'acknowledged');}}}).read({...f.ref,role:'test-agent'}));
    assert.equal(await f.used(),3);
  });
  await check('role preparation denies actual expired operations, injected targets, mismatched claimed inputs and close during private restoration',async()=>{
    const f=await setup(3000);await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));await assert.rejects(f.make().read({...f.ref,role:'architect'}));assert.equal(await f.used(),0);
    const g=await setup();await assert.rejects(g.make().read({...g.ref,role:'architect',approved:true}));
    assert.equal((await g.operations.claim({...g.architect.stepReference,stepInputDigest:'f'.repeat(64),owner:'synthetic-worker',leaseMs:300000})).outcome,'ok');
    await assert.rejects(g.make().read({...g.ref,role:'architect'}));
    let entered!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{entered=r;}),held=new Promise<void>(r=>{release=r;});
    const reader=g.make({originals:{...g.dependencies.originals,authorizeOriginal:async()=>{entered();await held;}}}),pending=reader.read({...g.ref,role:'architect'});
    await reached;reader.close();release();await assert.rejects(pending);assert.equal(await g.used(),3);
  });
  await check('a step sent and quarantined during final original-source readback cannot return as prepared work',async()=>{
    const f=await setup();await f.finishArchitect();const exam=await f.make().read({...f.ref,role:'test-agent'});
    assert.equal((await f.operations.claim({...exam.stepReference,owner:'synthetic-test-worker',leaseMs:300000})).outcome,'ok');let reads=0;
    await assert.rejects(f.make({originals:{...f.dependencies.originals,authorizeOriginal:async()=>{if(++reads!==3)return;
      assert.equal((await f.operations.transition({...exam.stepReference,event:{type:'commit-dispatch',owner:'synthetic-test-worker',fencingToken:1}})).dispatchAllowed,true);
      assert.equal((await f.operations.transition({...exam.stepReference,event:{type:'outcome-unknown',fencingToken:1}})).outcome,'ok');
    }}}).read({...f.ref,role:'test-agent'}));assert.equal(reads,4);assert.equal(await f.used(),5);
  });
}
