import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {Pool} from 'pg';
import type {DevelopmentReadFixture as Fixture} from './intent-development-read.integration.ts';
import {createVerifiedDevelopmentHistoryExchangeReader} from '../src/runtime.ts';
import {createDevelopmentStepRuntime} from '../../worker/src/development-step-runtime.ts';
import {createDevelopmentObservationStore} from '@steer/data/development-observations';
import {createDevelopmentOriginalStore} from '@steer/data/development-originals';
import {createDevelopmentResultStore} from '@steer/data/development-results';
import {createExpiredDevelopmentStepReader,createHistoricalDevelopmentStepReader} from '@steer/data/intent-operations';

type Dependencies=Parameters<typeof createVerifiedDevelopmentHistoryExchangeReader>[2];
export async function testDevelopmentHistory(setup:(ttl?:number)=>Promise<Fixture>,check:(name:string,run:()=>Promise<void>)=>Promise<void>,admin:Pool){
  const captured={architect:{message:'Private Architect message',questions:[],brief:'# Exact Brief 🌸\r\n',spec:'# Exact Spec\n'},testAgent:{exam:'# Exact Exam\r\nNOT RUN'}};
  const run=async(f:Fixture,role:'architect'|'test-agent',fail=false)=>{
    let calls=0;const model=f.recordedModel(async()=>{calls++;if(fail)throw new Error('Synthetic unknown');
      return Response.json({id:'synthetic-history',object:'chat.completion',model:'synthetic-provider-model',
        choices:[{index:0,message:{role:'assistant',content:JSON.stringify(role==='architect'?captured.architect:captured.testAgent)},finish_reason:'stop'}],
        usage:{prompt_tokens:2,completion_tokens:1,total_tokens:3}});});
    const runtime=createDevelopmentStepRuntime(f.pools,f.config,f.target,{reader:f.reader,model,authorize:async()=>{}});
    try{const result=await runtime.run(role,new AbortController().signal);assert.equal(calls,1);return result;}finally{runtime.close();model.close();}
  };
  const historyRecords=(f:Fixture):Dependencies['records']=>({...f.deps,authorize:async()=>{throw new Error('Ordinary observation denied');},authorizeHistoricalRead:async()=>{},
    originals:{...f.deps.originals,authorize:async()=>{throw new Error('Ordinary input denied');},authorizeHistoricalRead:async()=>{},authorizeOperation:async()=>{throw new Error('Execution denied');}},
    results:{...f.deps.results,authorizeResult:async()=>{throw new Error('Ordinary output denied');},authorizeHistoricalResult:async()=>{},authorizeOperation:async()=>{throw new Error('Execution denied');}}});
  const read=async(f:Fixture,role:'architect'|'test-agent',patch:Partial<Dependencies>={})=>{
    const reader=createVerifiedDevelopmentHistoryExchangeReader(f.pools,f.config,{records:historyRecords(f),profiles:f.gatewayProfiles,...patch});
    assert.deepEqual(Object.keys(reader),['read','close']);
    try{return await reader.read({...f.target,stepId:role});}finally{reader.close();}
  };
  const snapshot=async(f:Fixture)=>{
    const value:Record<string,unknown>={};
    for(const table of ['steer_execution.intent_operations','steer_execution.intent_steps','steer_drafts.development_originals','steer_drafts.development_results','steer_drafts.development_observations'])
      value[table]=(await admin.query(`SELECT * FROM ${table} WHERE operation_id=$1 ORDER BY row_to_json(${table.split('.')[1]})::text`,[f.target.operationId])).rows;
    value.revisions=(await admin.query('SELECT * FROM steer_drafts.draft_revisions WHERE draft_id=$1 ORDER BY revision',[f.draftId])).rows;
    value.reservations=(await admin.query('SELECT * FROM steer_usage.model_reservations WHERE budget_id=$1 ORDER BY reservation_id',[f.execution.budget.budgetId])).rows;
    return value;
  };
  await check('historical development SDK exchanges preserve both completed roles after edits and expiry without renewing execution or altering records',async()=>{
    const f=await setup(30000);for(const role of ['architect','test-agent'] as const)assert.equal((await run(f,role)).outcome,'succeeded');
    const originals=createDevelopmentOriginalStore(f.pools,f.config,f.deps.originals);const original=(await originals.read(f.target)).original;originals.close();
    const expired=createExpiredDevelopmentStepReader(f.pools.execution,original.configuration,{authorize:async()=>{}});
    const retained=createHistoricalDevelopmentStepReader(f.pools.execution,original.configuration,{authorize:async()=>{}});
    const results=createDevelopmentResultStore(f.pools,original.configuration,{...f.deps.results,authorizeHistoricalResult:async()=>{}});
    try{await assert.rejects(expired.inspectExpired({...f.target,stepId:'architect'}));await assert.rejects(results.readHistorical({...f.target,stepId:'architect'}));
      assert.equal((await retained.inspectHistorical({...f.target,stepId:'architect'})).operationExpired,false);
    }finally{expired.close();retained.close();results.close();}
    assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
      content:{...f.content,originalText:'A later human correction',documents:{brief:'Human edited Brief',spec:'Human edited Spec',exam:'Human edited Exam'}}})).outcome,'acknowledged');
    const before=await snapshot(f),first=await read(f,'architect'),second=await read(f,'test-agent');
    assert.equal(first.historical,true);assert.deepEqual(first.response.result,{role:'architect',output:captured.architect});
    assert.deepEqual(second.response.result,{role:'test-agent',output:captured.testAgent});assert.ok(first.resultReference);assert.ok(second.resultReference);
    assert.equal(second.resultReference.predecessorResultDigest,first.resultReference.resultDigest);
    const source=JSON.parse((second.request.rendered as any).request.source);assert.equal(source.brief,captured.architect.brief);
    assert.doesNotMatch(JSON.stringify(second.request),/Human edited|Private Architect message|Exact Exam/);
    assert.equal('checkpoint' in second,false);assert.equal(second.executionAuthorized,false);assert.equal(second.retryAuthorized,false);
    await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));
    assert.deepEqual(await read(f,'architect'),first);assert.deepEqual(await read(f,'test-agent'),second);assert.deepEqual(await snapshot(f),before);
    const normal=createDevelopmentObservationStore(f.pools,f.config,f.deps);try{await assert.rejects(normal.readExchange({...f.target,stepId:'architect'}));}finally{normal.close();}
  });
  await check('historical development denies missing current history, result, source and profile authority instead of returning retained output',async()=>{
    const f=await setup();assert.equal((await run(f,'architect')).outcome,'succeeded');const before=await snapshot(f),records=historyRecords(f);
    for(const field of ['authorizeHistoricalRead'] as const){const missing={...records};delete missing[field];await assert.rejects(read(f,'architect',{records:missing}));}
    const originalMissing={...records.originals};delete originalMissing.authorizeHistoricalRead;await assert.rejects(read(f,'architect',{records:{...records,originals:originalMissing}}));
    const resultMissing={...records.results};delete resultMissing.authorizeHistoricalResult;await assert.rejects(read(f,'architect',{records:{...records,results:resultMissing}}));
    for(const patch of [{authorizeHistoricalRead:async()=>true as any},{originals:{...records.originals,authorizeOriginal:async()=>{throw new Error('Source revoked');}}},
      {results:{...records.results,keyForDraft:async()=>{throw new Error('Result key revoked');}}}])await assert.rejects(read(f,'architect',{records:{...records,...patch}}));
    await assert.rejects(read(f,'architect',{profiles:{...f.gatewayProfiles,architect:{...f.gatewayProfiles.architect,instructions:'Substituted instructions'}}}));
    await assert.rejects(read(f,'architect',{profiles:{...f.gatewayProfiles,architect:{...f.gatewayProfiles.architect,allowedResponseModels:['foreign']}}}));
    assert.deepEqual(await snapshot(f),before);
    assert.equal((await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()})).outcome,'ok');await assert.rejects(read(f,'architect'));
  });
  await check('historical development never promotes incomplete, uncertain or quarantined response history',async()=>{
    const f=await setup();await assert.rejects(read(f,'architect'));assert.equal((await run(f,'architect')).outcome,'succeeded');
    await assert.rejects(read(f,'test-agent'));assert.equal((await run(f,'test-agent',true)).outcome,'attention-required');
    const before=await snapshot(f);await assert.rejects(read(f,'test-agent'));assert.deepEqual((await read(f,'architect')).response.result,{role:'architect',output:captured.architect});assert.deepEqual(await snapshot(f),before);
  });
  await check('historical development withholds late verifier results on access loss, key loss, closure and nonvoid verification',async()=>{
    const f=await setup();assert.equal((await run(f,'architect')).outcome,'succeeded');const records=historyRecords(f),before=await snapshot(f);
    for(const failure of ['access','key','close','nonvoid']){
      let revoked=false;const store=createDevelopmentObservationStore(f.pools,f.config,{...records,
        authorizeHistoricalRead:async()=>{if(revoked&&failure==='access')throw new Error('History revoked');},
        originals:{...records.originals,keyForDraft:async(...args)=>{if(revoked&&failure==='key')throw new Error('Key revoked');return records.originals.keyForDraft(...args);}},
        verifyHistoricalExchange:async()=>{revoked=true;if(failure==='close')store.close();if(failure==='nonvoid')return true as any;}});
      try{await assert.rejects(store.readHistoricalExchange({...f.target,stepId:'architect'}),{message:'Draft storage is unavailable.'});}finally{store.close();}
    }
    assert.deepEqual(await snapshot(f),before);
  });
}
