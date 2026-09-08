import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {DefaultLogger,Runtime,Worker} from '@temporalio/worker';
import {createScopeActivities} from '../src/scope-activity.ts';
import {createScopeWorker} from '../src/worker.ts';
import {startIntentScopeReview} from '../src/client.ts';
import {scopeWorkflowId} from '../src/scope-workflow-contracts.ts';
import {createIsolatedTemporalHarness} from './isolated-temporal-harness.ts';
import type {scopeStepIntegrationFixture} from './scope-step-runtime.integration.ts';
type Fixture=Awaited<ReturnType<typeof scopeStepIntegrationFixture>>;
const gate=()=>{let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return{promise,release};};
const historyText=(value:unknown):string=>value instanceof Uint8Array?Buffer.from(value).toString('utf8'):
  value&&typeof value==='object'?Object.values(value).map(historyText).join('\n'):typeof value==='string'?value:'';
const privateHistory=(history:unknown,f:Fixture)=>{
  const text=historyText(history);
  for(const marker of [f.content.originalText,f.input.original.profile.instructions,'EXAM-MARKER-NOT-FOR-SCOPE','synthetic-unused-key',
    'overlapExplanation','synthetic-scope-route','private-error-marker','ciphertext'])assert.equal(text.includes(marker),false,marker);
};

/** Real isolated Temporal, encrypted SQL and recorded SDK; synthetic grants/model. */
export async function testScopeWorkflow(setup:(sourceCount?:number,ttl?:number)=>Promise<Fixture>,checkBase:(name:string,run:()=>Promise<void>)=>Promise<void>){
  Runtime.install({logger:new DefaultLogger('ERROR')});
  const harness=await createIsolatedTemporalHarness(),env=harness.environment;
  let worker:Worker|undefined,running:Promise<void>|undefined,activity:ReturnType<typeof createScopeActivities>|undefined;
  const stop=async()=>{activity?.close();if(worker){worker.shutdown();await running;}worker=undefined;running=undefined;activity=undefined;};
  const check=(name:string,run:()=>Promise<void>)=>checkBase(name,async()=>{try{await run();}finally{await stop();}});
  const fresh=async(ttl=3600000)=>{const f=await setup(34,ttl);return{f,target:{organizationId:f.config.organizationId,...f.target},queue:`steer-scope-${randomUUID()}`};};
  const startWorker=async(t:Awaited<ReturnType<typeof fresh>>,patch:Parameters<Fixture['make']>[0]={})=>{
    activity=createScopeActivities(t.target,t.f.make(patch));
    worker=await createScopeWorker({connection:env.nativeConnection,namespace:'default',taskQueue:t.queue,workflowBundle:harness.bundle},activity);running=worker.run();
  };
  try{
    await check('Temporal obtains exact scope manifest, executes two recorded SQL batches, replays content-free history and rejects duplicate starts',async()=>{
      const t=await fresh(),handle=await startIntentScopeReview(env.client,t.queue,t.target);
      await assert.rejects(startIntentScopeReview(env.client,t.queue,t.target));await startWorker(t);
      const result=await handle.result();assert.equal(result.outcome,'attempt-complete');assert.equal(result.planned,2);assert.equal(result.completed,2);
      assert.equal(t.f.state.calls,2);assert.equal(await t.f.reservations(),2);assert.equal((await t.f.read()).status,'review-available');
      for(const flag of ['semanticQualityVerified','authoritativeClearance','executionAuthorized','retryAuthorized','gateSigned'])assert.equal(result[flag],false);
      assert.deepEqual(await handle.query('scopeProgress'),{phase:'complete',planned:2,completed:2,checkpoint:result.checkpoint});
      const history=await handle.fetchHistory();privateHistory(history,t.f);const scheduled=history.events!.filter(e=>e.activityTaskScheduledEventAttributes);
      assert.equal(scheduled.length,3);assert.equal(scheduled[0]!.activityTaskScheduledEventAttributes!.activityType!.name,'readScopePlan');
      for(const e of scheduled){assert.equal(e.activityTaskScheduledEventAttributes!.retryPolicy?.maximumAttempts,1);assert.equal(String(e.activityTaskScheduledEventAttributes!.heartbeatTimeout?.seconds),'10');}
      await stop();await startWorker(t);await Worker.runReplayHistory({workflowBundle:harness.bundle},history,scopeWorkflowId(t.target));
      assert.deepEqual(await handle.result(),result);assert.equal(t.f.state.calls,2);
      await assert.rejects(startIntentScopeReview(env.client,t.queue,{...t.target,preparationDigest:'f'.repeat(64)}));
    });
    await check('Temporal scope reconstruction reuses an encrypted first checkpoint and sends only the remaining batch',async()=>{
      const t=await fresh();assert.equal((await t.f.run()).outcome,'succeeded');assert.equal(t.f.state.calls,1);
      await startWorker(t);const handle=await startIntentScopeReview(env.client,t.queue,t.target),result=await handle.result();
      assert.equal(result.outcome,'attempt-complete');assert.equal(result.completed,2);assert.equal(t.f.state.calls,2);assert.equal(await t.f.reservations(),2);
      assert.equal((await t.f.read()).status,'review-available');privateHistory(await handle.fetchHistory(),t.f);
    });
    await check('Temporal scope supersession retains the first historical result and does not send the next batch',async()=>{
      const t=await fresh();await startWorker(t,{gateway:{...t.f.deps.gateway,transport:async(...args)=>{await t.f.edit();return t.f.transport(...args);}}});
      const handle=await startIntentScopeReview(env.client,t.queue,t.target),result=await handle.result();
      assert.equal(result.outcome,'superseded');assert.equal(result.planned,2);assert.equal(result.completed,0);assert.ok(result.checkpoint.resultDigest);
      assert.equal(t.f.state.calls,1);assert.equal(await t.f.count(),1);assert.equal((await t.f.read()).status,'superseded');privateHistory(await handle.fetchHistory(),t.f);
    });
    await check('Temporal scope uncertainty stops one attempt with no model retries, next-batch dispatch or fabricated coverage',async()=>{
      const t=await fresh();await startWorker(t,{gateway:{...t.f.deps.gateway,transport:async(...args)=>{await t.f.transport(...args);throw new Error('private-error-marker');}}});
      const handle=await startIntentScopeReview(env.client,t.queue,t.target),result=await handle.result();
      assert.equal(result.outcome,'attention-required');assert.equal(result.completed,0);assert.equal((await handle.describe()).status.name,'COMPLETED');
      assert.equal(t.f.state.calls,1);assert.equal(await t.f.count(),0);assert.equal(await t.f.count('request'),1);assert.equal(await t.f.reservations(),1);
      assert.equal((await t.f.read()).status,'attention-required');assert.equal((await t.f.run()).outcome,'attention-required');assert.equal(t.f.state.calls,1);
      const history=await handle.fetchHistory();assert.equal(history.events!.filter(e=>e.activityTaskScheduledEventAttributes).length,2);privateHistory(history,t.f);
    });
    await check('queued scope holds, newer source and expiration stop at planning before any model reservation',async()=>{
      for(const mode of ['hold','edit','expiry']){
        const t=await fresh(mode==='expiry'?1200:3600000),handle=await startIntentScopeReview(env.client,t.queue,t.target);
        if(mode==='hold')assert.equal((await t.f.lifecycle.hold({draftId:t.f.draftId,holdReference:randomUUID()})).outcome,'ok');
        if(mode==='edit')await t.f.edit();if(mode==='expiry')await delay(Math.max(0,Date.parse(t.f.execution.expiresAt)-Date.now()+50));
        await startWorker(t);const result=await handle.result();assert.equal(result.outcome,mode==='hold'?'attention-required':mode==='edit'?'superseded':'expired');
        assert.equal(result.planned,0);assert.equal(result.completed,0);assert.equal(result.checkpoint,null);assert.equal(t.f.state.calls,0);assert.equal(await t.f.reservations(),0);
        privateHistory(await handle.fetchHistory(),t.f);await stop();
      }
    });
    await check('wrong scope workflow identity and foreign worker references fail before source authorization',async()=>{
      const t=await fresh();let authorized=0;await startWorker(t,{authorize:async()=>{authorized++;}});
      const wrong=await env.client.workflow.start('reviewIntentScope',{workflowId:`wrong-${randomUUID()}`,taskQueue:t.queue,args:[t.target]});await assert.rejects(wrong.result());
      const foreign=await startIntentScopeReview(env.client,t.queue,{...t.target,organizationId:'foreign'});await assert.rejects(foreign.result());
      assert.equal(authorized,0);assert.equal(t.f.state.calls,0);assert.equal(await t.f.reservations(),0);privateHistory(await foreign.fetchHistory(),t.f);
    });
    await check('Temporal scope cancellation during planning closes the shared runtime and withholds late source admission',async()=>{
      const t=await fresh(),entered=gate(),held=gate();
      try{await startWorker(t,{authorize:async()=>{entered.release();await held.promise;}});
        const handle=await startIntentScopeReview(env.client,t.queue,t.target);await Promise.race([entered.promise,handle.result().then(()=>{throw new Error('Plan authority not reached');})]);
        await handle.cancel();await assert.rejects(handle.result());assert.equal(activity!.status().closed,true);held.release();await delay(50);
        assert.equal(t.f.state.calls,0);assert.equal(await t.f.reservations(),0);assert.equal((await handle.describe()).status.name,'CANCELLED');privateHistory(await handle.fetchHistory(),t.f);
      }finally{held.release();}
    });
    await check('Temporal cancellation after scope dispatch suppresses late response capture and cannot retry sent work',async()=>{
      const t=await fresh(),entered=gate(),held=gate();
      try{await startWorker(t,{gateway:{...t.f.deps.gateway,transport:async(...args)=>{const value=await t.f.transport(...args);entered.release();await held.promise;return value;}}});
        const handle=await startIntentScopeReview(env.client,t.queue,t.target);await Promise.race([entered.promise,handle.result().then(()=>{throw new Error('Scope transport not reached');})]);
        await handle.cancel();await assert.rejects(handle.result());assert.equal(activity!.status().closed,true);held.release();await delay(50);
        assert.equal(t.f.state.calls,1);assert.equal(await t.f.count(),0);assert.equal(await t.f.count('request'),1);assert.equal(await t.f.reservations(),1);
        assert.equal((await t.f.run()).outcome,'attention-required');assert.equal(t.f.state.calls,1);privateHistory(await handle.fetchHistory(),t.f);
      }finally{held.release();}
    });
    await check('scope planning rechecks current identity before releasing references into Temporal history',async()=>{
      const t=await fresh();let checks=0;await startWorker(t,{authorize:async()=>{if(++checks===2)throw new Error('private-error-marker');}});
      const handle=await startIntentScopeReview(env.client,t.queue,t.target),result=await handle.result();
      assert.equal(result.outcome,'attention-required');assert.equal(result.planned,0);assert.equal(checks,2);assert.equal(t.f.state.calls,0);assert.equal(await t.f.reservations(),0);
      privateHistory(await handle.fetchHistory(),t.f);
    });
  }finally{try{await stop();}finally{await harness.close();}}
}
