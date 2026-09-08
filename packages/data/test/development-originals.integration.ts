import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool,PoolClient } from 'pg';
import type { DatabasePool } from '../src/runtime-pool.ts';
import { createDraftLifecycleStore } from '../src/draft-lifecycle.ts';
import { createDraftRevisionStore } from '../src/draft-revisions.ts';
import { createIntentOperationStore } from '../src/intent-operations.ts';
import { createDevelopmentOriginalStore } from '../src/development-originals.ts';
import { createDevelopmentResultStore } from '../src/development-results.ts';
import { originalFixture } from './development-original.fixture.ts';
type Dependencies=Parameters<typeof createDevelopmentOriginalStore>[2];
export async function testDevelopmentOriginals({admin,connect,check}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}) {
  const setup=async(ttl=3600000)=>{
    const config={organizationId:`original-${randomUUID()}`,subject:'synthetic-human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'originals-r1',recordsPolicyDigest:'a'.repeat(64)};
    const budget={organizationId:config.organizationId,subject:config.subject,configurationRevision:config.configurationRevision,budgetId:randomUUID(),approvalDigest:'b'.repeat(64),capMicrousd:30,architectMicrousd:3,testAgentMicrousd:2};
    await admin.query(`INSERT INTO steer_usage.model_budgets VALUES($1,$2,$3,$4,$5,30,3,2,now()-interval '1 minute',now()+interval '1 hour',true)`,
      [budget.organizationId,budget.budgetId,budget.subject,budget.configurationRevision,budget.approvalDigest]);
    const execution={...config,action:'develop',expiresAt:new Date(Date.now()+ttl).toISOString(),budget};
    const pools={drafts:connect('steer_draft_runtime'),execution:connect('steer_app')},key={keyId:`synthetic-${randomUUID()}`,bytes:randomBytes(32)};
    const state={keys:0,denied:false,evidenceDenied:false};
    const deps:Dependencies={authorize:async ctx=>{assert.deepEqual(Object.keys(ctx.target),['operationId','inputDigest']);if(state.denied)throw new Error('private-access');},
      authorizeOriginal:async()=>{if(state.evidenceDenied)throw new Error('private-source-denial');},authorizeOperation:async()=>{},authorizeDraft:async()=>{},
      keyForDraft:async(_ref,keyId)=>{state.keys++;assert.ok(keyId===null||keyId===key.keyId);return key;}};
    const lifecycle=createDraftLifecycleStore(pools.drafts,config,{authorize:async()=>{},verifyHold:async()=>{}}),created=await lifecycle.create({requestId:randomUUID()});
    assert.equal(created.outcome,'ok');if(created.outcome!=='ok')throw new Error();const draftId=created.value.draftId;
    const drafts=createDraftRevisionStore(pools.drafts,config,{authorize:deps.authorizeDraft,keyForDraft:deps.keyForDraft});
    const content={originalText:' Exact human original 🌸\r\n',clarificationTurns:[' Exact clarification '],documents:null};
    const saved=await drafts.append({draftId,mutationId:randomUUID(),expectedRevision:0,expectedDigest:null,content});
    assert.equal(saved.outcome,'acknowledged');if(saved.outcome!=='acknowledged')throw new Error();
    const description=await originalFixture(execution,{draftId,revision:1,sourceRevision:1,revisionDigest:saved.reference.revisionDigest,content});
    const operations=createIntentOperationStore(pools.execution,execution,{authorize:deps.authorizeOperation,verifyCheckpoint:async()=>{throw new Error();}});
    const op=await operations.create({draftId,draftRevision:1,inputDigest:description.inputDigest});assert.equal(op.outcome,'ok');if(op.outcome!=='ok')throw new Error();
    const target={operationId:op.value.operationId,inputDigest:description.inputDigest},input={...target,original:description.original};
    const make=(overrides:Partial<Dependencies>={},otherPools=pools,patch={})=>createDevelopmentOriginalStore(otherPools,{...config,...patch},{...deps,...overrides});
    const count=async()=>Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.development_originals WHERE organization_id=$1',[config.organizationId])).rows[0].n);
    return {config,execution,pools,key,state,deps,lifecycle,drafts,draftId,saved,operations,target,input,description,make,count};
  };
  await check('immutable encrypted development originals restore the full exact source, evidence, direction and prompt/configuration profile using only current records scope',async()=>{
    const f=await setup();assert.equal((await f.make().put(f.input)).outcome,'stored');
    const actual=await f.make().read(f.target);assert.deepEqual(actual.original,f.input.original);assert.equal(actual.executionAuthorized,false);assert.equal(actual.operationExpired,false);
    const row=(await admin.query('SELECT * FROM steer_drafts.development_originals WHERE operation_id=$1',[f.target.operationId])).rows[0];
    assert.ok(!JSON.stringify(row).includes('human original'));assert.ok(!JSON.stringify(row).includes('Evidence-marker'));assert.ok(!JSON.stringify(row).includes('instructions'));
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_usage.model_reservations WHERE budget_id=$1',[f.execution.budget.budgetId])).rows[0].n,0);
    assert.equal((await f.operations.inspect(f.target)).outcome,'ok');
  });
  await check('concurrent original capture stores one immutable input and conflicting prompts or foreign operation identifiers cannot overwrite it',async()=>{
    const f=await setup();const writes=await Promise.all(Array.from({length:4},()=>f.make({}, {drafts:connect('steer_draft_runtime'),execution:connect('steer_app')}).put(f.input)));
    assert.ok(writes.every(v=>v.outcome==='stored'));assert.equal(await f.count(),1);
    const changed=structuredClone(f.input);changed.original.profiles.architect.instructions+='changed';assert.equal((await f.make().put(changed)).outcome,'conflict');
    assert.notEqual((await f.make().put({...f.input,operationId:randomUUID()})).outcome,'stored');
    assert.deepEqual((await f.make().read(f.target)).original,f.input.original);
  });
  await check('lost original insert acknowledgement remains unknown and a fresh reader recovers exact bytes without another operation or reservation',async()=>{
    const f=await setup();let inserted=false;
    const uncertain:DatabasePool={async connect(){const c=await f.pools.drafts.connect();return{query:async(sql:string,values?:unknown[])=>{
      const result=await c.query(sql,values);if(sql.includes('INSERT INTO steer_drafts.development_originals'))inserted=true;
      if(sql==='COMMIT'&&inserted)throw new Error('private-lost-ack');return result;},release:(broken:boolean)=>c.release(broken)} as PoolClient;}};
    assert.equal((await f.make({}, {...f.pools,drafts:uncertain as Pool}).put(f.input)).outcome,'unknown');assert.equal(await f.count(),1);
    assert.deepEqual((await f.make().read(f.target)).original,f.input.original);assert.equal((await f.make().put(f.input)).outcome,'stored');assert.equal(await f.count(),1);
  });
  await check('restored expired original configuration composes with historical result reading without execution grants or another paid reservation',async()=>{
    const f=await setup(6000);assert.equal((await f.make().put(f.input)).outcome,'stored');
    const step={...f.target,stepId:'architect',stepInputDigest:'d'.repeat(64),predecessorResultDigest:null};
    assert.equal((await f.operations.claim({...step,owner:'synthetic-worker',leaseMs:300000})).outcome,'ok');
    assert.equal((await f.operations.transition({...step,event:{type:'commit-dispatch',owner:'synthetic-worker',fencingToken:1}})).dispatchAllowed,true);
    const resultDeps={authorizeOperation:f.deps.authorizeOperation,authorizeDraft:f.deps.authorizeDraft,keyForDraft:f.deps.keyForDraft,authorizeResult:async()=>{},authorizeHistoricalResult:async()=>{}};
    const result={role:'architect',output:{message:'Synthetic ready',questions:[],brief:'# Brief original',spec:'# Spec original'}};
    assert.equal((await createDevelopmentResultStore(f.pools,f.execution,resultDeps).put({...f.target,stepId:'architect',owner:'synthetic-worker',fencingToken:1,result})).outcome,'stored');
    await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));
    await admin.query('UPDATE steer_usage.model_budgets SET active=false WHERE budget_id=$1',[f.execution.budget.budgetId]);
    const recovered=await f.make({authorizeOperation:async()=>{throw new Error('expired-execution-grant');}}).read(f.target);assert.equal(recovered.operationExpired,true);
    const history=createDevelopmentResultStore(f.pools,recovered.original.configuration,{...resultDeps,authorizeOperation:async()=>{throw new Error('expired-execution-grant');}});
    assert.deepEqual((await history.readHistorical({...f.target,stepId:'architect'})).result,result);await assert.rejects(history.read({...f.target,stepId:'architect'}));
    assert.notEqual((await f.make().put(f.input)).outcome,'stored');assert.equal(recovered.retryAuthorized,false);
    assert.equal(Number((await admin.query('SELECT sum(amount_microusd) AS used FROM steer_usage.model_reservations WHERE budget_id=$1',[f.execution.budget.budgetId])).rows[0].used),3);
    history.close();
  });
  await check('newer editable drafts remain separate and holds, source-grant loss, current owner and key revocation deny original release',async()=>{
    const f=await setup();assert.equal((await f.make().put(f.input)).outcome,'stored');
    assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
      content:{...f.input.original.source.content,originalText:'A later human correction'}})).outcome,'acknowledged');
    const actual=await f.make().read(f.target);assert.equal(actual.latestDraftRevision,2);assert.deepEqual(actual.original,f.input.original);
    for(const patch of [{subject:'foreign'},{productId:'foreign'},{organizationId:'foreign'},{recordsPolicyDigest:'e'.repeat(64)}])await assert.rejects(f.make({},f.pools,patch).read(f.target));
    f.state.denied=true;let keys=f.state.keys;await assert.rejects(f.make().read(f.target));assert.equal(f.state.keys,keys);f.state.denied=false;
    f.state.evidenceDenied=true;await assert.rejects(f.make().read(f.target));f.state.evidenceDenied=false;
    await assert.rejects(f.make({keyForDraft:async()=>({...f.key,bytes:randomBytes(32)})}).read(f.target));
    let evidenceAllowed=true;await assert.rejects(f.make({authorizeOriginal:async()=>{if(!evidenceAllowed)throw new Error('private-revoked');},
      keyForDraft:async()=>{evidenceAllowed=false;return f.key;}}).read(f.target));
    await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()});keys=f.state.keys;await assert.rejects(f.make().read(f.target));assert.equal(f.state.keys,keys);assert.equal(await f.count(),1);
  });
  await check('original input SQL grants and strict metadata deny wrong runtime roles, plaintext injection and immutable rewrites',async()=>{
    const f=await setup();assert.equal((await f.make().put(f.input)).outcome,'stored');
    assert.deepEqual((await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='steer_drafts.development_originals'::regclass")).rows[0],{relrowsecurity:true,relforcerowsecurity:true});
    for(const role of ['steer_app','steer_projector','steer_auth_runtime']){const p=connect(role);await assert.rejects(p.query('SELECT * FROM steer_drafts.development_originals'));await assert.rejects(f.make({}, {...f.pools,drafts:p}).read(f.target));}
    await assert.rejects(f.make({}, {...f.pools,drafts:admin}).read(f.target));
    assert.equal((await f.pools.drafts.query('SELECT count(*)::int AS n FROM steer_drafts.development_originals')).rows[0].n,0);
    const row=(await admin.query('SELECT * FROM steer_drafts.development_originals WHERE operation_id=$1',[f.target.operationId])).rows[0],c=await f.pools.drafts.connect();
    try{
      await c.query("SELECT set_config('steer.draft_organization',$1,false),set_config('steer.draft_subject',$2,false),set_config('steer.draft_product',$3,false)",[f.config.organizationId,f.config.subject,f.config.productId]);
      for(const sql of ['DELETE FROM steer_drafts.development_originals','TRUNCATE steer_drafts.development_originals',"UPDATE steer_drafts.development_originals SET record='{}'"])await assert.rejects(c.query(sql),/permission denied/);
      await assert.rejects(c.query(`INSERT INTO steer_drafts.development_originals VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)`,
        [row.organization_id,row.subject,row.product_id,row.operation_id,row.input_digest,row.draft_id,row.draft_revision,JSON.stringify({...row.record,prompt:'plaintext-marker'}),JSON.stringify(row.encrypted_value)]),{code:'23514'});
    }finally{c.release(true);}
    await admin.query("UPDATE steer_drafts.development_originals SET encrypted_value=jsonb_set(encrypted_value,'{tag}',to_jsonb($2::text)) WHERE operation_id=$1",[f.target.operationId,Buffer.alloc(16).toString('base64url')]);
    await assert.rejects(f.make().read(f.target));assert.equal(await f.count(),1);
  });
  await check('closing while an original key lookup is pending withholds late bytes without changing the captured input',async()=>{
    const f=await setup();assert.equal((await f.make().put(f.input)).outcome,'stored');let release!:()=>void,entered!:()=>void;
    const held=new Promise<void>(r=>{release=r;}),reached=new Promise<void>(r=>{entered=r;});
    const store=f.make({keyForDraft:async()=>{entered();await held;return f.key;}}),pending=store.read(f.target);await reached;store.close();release();await assert.rejects(pending);
    assert.deepEqual((await f.make().read(f.target)).original,f.input.original);
  });
  await check('draft authority revoked at the final original-key lookup prevents capture and late restored-content release',async()=>{
    const f=await setup();let allowed=true,reads=0;
    const writer=f.make({authorizeDraft:async()=>{if(!allowed)throw new Error('private-draft-revoked');},
      keyForDraft:async()=>{if(++reads===3)allowed=false;return f.key;}});
    assert.equal((await writer.put(f.input)).outcome,'unavailable');assert.equal(reads,3);assert.equal(await f.count(),0);
    assert.equal((await f.make().put(f.input)).outcome,'stored');allowed=true;reads=0;
    const reader=f.make({authorizeDraft:async()=>{if(!allowed)throw new Error('private-draft-revoked');},
      keyForDraft:async()=>{if(++reads===4)allowed=false;return f.key;}});
    await assert.rejects(reader.read(f.target));assert.equal(reads,4);assert.equal(await f.count(),1);
  });
}
