import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import type {Client} from '@temporalio/client';
import {createScopeActivities} from '../src/scope-activity.ts';
import {startIntentScopeReview} from '../src/client.ts';
import {createScopeWorker} from '../src/worker.ts';
import {parseScopeTarget,parseScopeStepTarget,parseScopePlanResult,parseScopeStepResult,scopeWorkflowId,
  type ScopePlanResult,type ScopeStepResult} from '../src/scope-workflow-contracts.ts';
const target={organizationId:'synthetic-org',reviewId:randomUUID(),preparationDigest:'a'.repeat(64)},step={...target,batchId:'b'.repeat(64)};
const flags={semanticQualityVerified:false,authoritativeClearance:false,executionAuthorized:false,retryAuthorized:false,gateSigned:false} as const;
const plan=(outcome:ScopePlanResult['outcome']='ready'):ScopePlanResult=>({kind:'steer-scope-plan/v1',reviewId:target.reviewId,preparationDigest:target.preparationDigest,outcome,batchIds:outcome==='ready'?[step.batchId]:[],...flags});
const result=(outcome:ScopeStepResult['outcome']='succeeded'):ScopeStepResult=>({kind:'steer-scope-step-outcome/v1',reviewId:target.reviewId,preparationDigest:target.preparationDigest,batchId:step.batchId,outcome,resultDigest:['succeeded','superseded'].includes(outcome)?'c'.repeat(64):null,...flags});
const runtime=()=>({binding:target,plan:async()=>plan(),run:async()=>result(),close(){}});
const gate=()=>{let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return{promise,release};};
test('scope history references reject caller batch lists, private content, authority and changed identities',()=>{
  assert.deepEqual(parseScopeTarget(target),target);assert.deepEqual(parseScopeStepTarget(step),step);
  for(const raw of [null,{}, {...target,batchIds:[step.batchId]}, {...target,privateText:'private'}, {...target,approved:true},
    {...target,reviewId:target.reviewId.toUpperCase()}, {...target,preparationDigest:target.preparationDigest+'\n'}, {...target,organizationId:'org\n'}])assert.throws(()=>parseScopeTarget(raw));
  for(const raw of [{...step,extra:true},{...step,batchId:'x'},{...step,batchId:step.batchId+'\n'}])assert.throws(()=>parseScopeStepTarget(raw));
  assert.equal(scopeWorkflowId(target),scopeWorkflowId({...target,preparationDigest:'d'.repeat(64)}));
  assert.notEqual(scopeWorkflowId(target),scopeWorkflowId({...target,organizationId:'other'}));
  assert.ok(scopeWorkflowId({...target,organizationId:'a'+':'.repeat(63)}).length<=255);
});
test('scope plan/result parsers require exact metadata, bounded manifest batches and non-authoritative outcomes',()=>{
  for(const outcome of ['ready','expired','superseded','attention-required','busy'] as const)assert.deepEqual(parseScopePlanResult(plan(outcome),target),plan(outcome));
  for(const patch of [{batchIds:[]},{batchIds:Array(1)},{batchIds:[step.batchId,step.batchId]}, {batchIds:Array.from({length:9},(_,i)=>i.toString().repeat(64))},
    {batchIds:['not-a-digest']},{privateSource:'private'},{preparationDigest:'f'.repeat(64)},{outcome:'complete'},{executionAuthorized:true}])assert.throws(()=>parseScopePlanResult({...plan(),...patch},target));
  assert.throws(()=>parseScopePlanResult({...plan('busy'),batchIds:[step.batchId]},target));
  assert.equal(Object.isFrozen(parseScopePlanResult(plan(),target).batchIds),true);
  for(const outcome of ['succeeded','superseded','attention-required','busy'] as const)assert.deepEqual(parseScopeStepResult(result(outcome),step),result(outcome));
  assert.equal(parseScopeStepResult({...result('superseded'),resultDigest:null},step).resultDigest,null);
  for(const patch of [{resultDigest:null},{resultDigest:'x'},{resultDigest:'c'.repeat(64)+'\n'},{batchId:'f'.repeat(64)},{outcome:'ready'},{outcome:'busy'},
    {privateFinding:'private'},...Object.keys(flags).map(k=>({[k]:true}))])assert.throws(()=>parseScopeStepResult({...result(),...patch},step));
});
test('scope scheduling refuses duplicate reuse and caller batching with bounded execution and no retry policy',async()=>{
  let calls=0,options:any;const client={workflow:{start:async(name:string,value:any)=>{assert.equal(name,'reviewIntentScope');calls++;options=value;}}} as unknown as Client;
  await startIntentScopeReview(client,'synthetic-scope',target);assert.equal(calls,1);assert.deepEqual(options.args,[target]);assert.equal(options.workflowId,scopeWorkflowId(target));
  assert.equal(options.workflowIdConflictPolicy,'FAIL');assert.equal(options.workflowIdReusePolicy,'REJECT_DUPLICATE');assert.equal(options.retry,undefined);assert.equal(options.workflowExecutionTimeout,'30 minutes');
  assert.throws(()=>startIntentScopeReview(client,'queue',{...target,batchIds:[step.batchId]}));
  for(const invalid of ['queue\n',undefined,42]){assert.throws(()=>startIntentScopeReview(client,invalid as string,target));
    assert.throws(()=>createScopeWorker({namespace:'default',taskQueue:invalid} as any,{} as any));}assert.equal(calls,1);
  assert.throws(()=>createScopeWorker({namespace:'default',taskQueue:'queue'} as any,{} as any));
});
test('scope activity binds the actual runtime identity and denies substitution before any records or model work',async()=>{
  assert.throws(()=>createScopeActivities(target,{...runtime(),binding:{...target,organizationId:'other'}}));
  for(const method of ['plan','run','close'])assert.throws(()=>createScopeActivities(target,{...runtime(),[method]:undefined} as any));
  let calls=0;const activity=createScopeActivities(target,{...runtime(),plan:async()=>{calls++;return plan();},run:async()=>{calls++;return result();}});
  for(const raw of [{...target,organizationId:'foreign'},{...target,preparationDigest:'f'.repeat(64)},{...target,extra:true}])await assert.rejects(activity.readScopePlan(raw,new AbortController().signal));
  await assert.rejects(activity.reviewScopeBatch({...step,reviewId:randomUUID()},new AbortController().signal));await assert.rejects(activity.readScopePlan(target,{} as AbortSignal));assert.equal(calls,0);
  assert.deepEqual(await activity.readScopePlan(target,new AbortController().signal),plan());assert.deepEqual(await activity.reviewScopeBatch(step,new AbortController().signal),result());activity.close();
  await assert.rejects(activity.readScopePlan(target,new AbortController().signal));assert.equal(calls,2);
});
test('scope activities sanitize raw failures and reject private or mismatched plan/batch output',async()=>{
  for(const phase of ['plan','run'])for(const malformed of [false,true]){
    const activity=createScopeActivities(target,{...runtime(),[phase]:async()=>{if(!malformed)throw new Error('private-error-marker');return phase==='plan'?{...plan(),source:'private'}:{...result(),batchId:'f'.repeat(64)};}} as any);
    await assert.rejects(phase==='plan'?activity.readScopePlan(target,new AbortController().signal):activity.reviewScopeBatch(step,new AbortController().signal),/^Error: Scope review requires attention\.$/);activity.close();
  }
});
test('scope activity cancellation and explicit close withhold late plan/batch results and retain draining admission',async()=>{
  for(const phase of ['plan','run'])for(const mode of ['cancel','close']){
    const entered=gate(),held=gate();let closes=0;let observed:AbortSignal|undefined;
    const activity=createScopeActivities(target,{...runtime(),[phase]:async(...args:any[])=>{observed=args.at(-1);entered.release();await held.promise;return phase==='plan'?plan():result();},close(){closes++;}});
    const signal=new AbortController(),pending=assert.rejects(phase==='plan'?activity.readScopePlan(target,signal.signal):activity.reviewScopeBatch(step,signal.signal),/requires attention/);
    try{await entered.promise;await assert.rejects(activity.readScopePlan(target,new AbortController().signal));
      if(mode==='cancel')signal.abort();else activity.close();await pending;assert.equal(observed?.aborted,true);assert.equal(closes,1);assert.deepEqual(activity.status(),{active:true,closed:true});
      held.release();await new Promise(r=>setImmediate(r));assert.deepEqual(activity.status(),{active:false,closed:true});
    }finally{held.release();activity.close();}
  }
});
test('scope activity deadline closes stalled plan admission without publishing a late result',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const entered=gate(),held=gate();let closes=0;
  const activity=createScopeActivities(target,{...runtime(),plan:async()=>{entered.release();await held.promise;return plan();},close(){closes++;}});
  const pending=assert.rejects(activity.readScopePlan(target,new AbortController().signal),/requires attention/);
  try{await entered.promise;t.mock.timers.tick(100000);await pending;assert.equal(closes,1);assert.deepEqual(activity.status(),{active:true,closed:true});
    held.release();await new Promise(r=>setImmediate(r));assert.equal(activity.status().active,false);
  }finally{held.release();activity.close();}
});
