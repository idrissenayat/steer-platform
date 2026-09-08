import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {Pool,PoolClient} from 'pg';
import {planIntentScopeBatches} from '@steer/tool-registry/intent-scope-batches';
import {intentScopePrepareOutputSchema} from '@steer/tool-registry/intent-scope-prepare-contracts';
import {createScopeReviewOriginalStore} from '@steer/data/scope-review-originals';
import {scopeDraftIntegrationFixture} from '../../../packages/data/test/scope-originals.integration.ts';
import {createRecordedScopePreparer,createCorpusRecordedScopePreparer} from '../src/runtime.ts';
import {createGitHubReader} from '@steer/adapters/github';
import {createIntentCorpusEvidence} from '@steer/adapters/intent-corpus-evidence';
import {fixture as nativeGitFixture,binding,now} from '../../../packages/adapters/test/github-brief-fixture.ts';
import {createApi} from '../src/app.ts';

type Fixture=Awaited<ReturnType<typeof scopeDraftIntegrationFixture>>;
type Dependencies=Parameters<typeof createRecordedScopePreparer>[3];
type Pools=Parameters<typeof createRecordedScopePreparer>[0];
/** Actual authenticated HTTP/SQL path with synthetic grants, sources and keys.
 * No live records adoption, remote call, model, workflow start or Git write. */
export async function testScopePreparation({admin,connect,check:checkBase}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}){
  const services:{close():void}[]=[],owned:Pool[]=[],cleanup:Array<()=>void>=[];
  const check=(name:string,run:()=>Promise<void>)=>checkBase(name,async()=>{try{await run();}finally{services.splice(0).forEach(s=>s.close());await Promise.all(owned.splice(0).map(p=>p.end()));cleanup.splice(0).forEach(f=>f());}});
  const setup=async(sourceCount=4,ttl=3600000,branch?:string)=>{
    const f=await scopeDraftIntegrationFixture({admin,connect:role=>{const pool=connect(role);owned.push(pool);return pool;}},false,ttl,{sourceCount,...(branch===undefined?{}:{branch})});
    services.push(f.drafts,f.lifecycle);return f;
  };
  const rows=async(f:Fixture)=>({runs:(await admin.query('SELECT * FROM steer_execution.scope_review_runs WHERE organization_id=$1 ORDER BY review_id',[f.config.organizationId])).rows,
    originals:(await admin.query('SELECT * FROM steer_drafts.scope_review_originals WHERE organization_id=$1 ORDER BY review_id',[f.config.organizationId])).rows,
    batches:(await admin.query('SELECT * FROM steer_execution.scope_review_batches WHERE organization_id=$1',[f.config.organizationId])).rows,
    reservations:(await admin.query('SELECT * FROM steer_usage.model_reservations WHERE organization_id=$1',[f.config.organizationId])).rows});
  const api=async(f:Fixture,patch:Partial<Dependencies>={},pools:Pools=f.pools,configuration:unknown=f.execution,profile:unknown=f.described.original.profile,
    supplied?:ReturnType<typeof createRecordedScopePreparer>)=>{
    const c=f.config,s=f.saved.reference,evidence=await (patch.evidenceFor??(async()=>f.described.original.evidence))({} as never,async()=>{});
    const plan=await planIntentScopeBatches(evidence);
    const service=supplied??createRecordedScopePreparer(pools,configuration,profile,{records:f.deps,evidenceFor:async()=>f.described.original.evidence,authorizePreparation:async()=>{},...patch});services.push(service);
    const state={principal:{organizationId:c.organizationId,subject:c.subject,type:'human',hats:[],toolGrants:['intent.scope.prepare'],expiresAt:new Date(Date.now()+300000).toISOString()}};
    const input={organizationId:c.organizationId,productId:c.productId,repository:c.repository,configurationRevision:c.configurationRevision,draftId:f.draftId,
      revision:1,revisionDigest:s.revisionDigest,scopeInputDigest:s.scopeInputDigest,sourceSnapshotDigest:plan.summary.sourceSnapshotDigest};
    const app=createApi({authenticate:async()=>state.principal,services:{intentScopePreparer:service}});
    const post=(override={})=>app.request('/v1/tools/intent.scope.prepare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input,...override})});
    return{service,state,input,post};
  };
  await check('scope prepare HTTP admits and encrypts exact multi-batch saved scope once without Exam, reservation or dispatch',async()=>{
    const f=await setup(34),a=await api(f),response=await a.post();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const output=intentScopePrepareOutputSchema.parse(await response.json());assert.equal(output.outcome,'prepared');assert.ok(output.reference);
    assert.equal(output.coverage?.plannedCount,34);assert.equal(output.coverage?.batchCount,2);assert.equal(output.modelCallsStarted,0);
    const before=await rows(f);assert.equal(before.runs.length,1);assert.equal(before.originals.length,1);assert.deepEqual(before.batches,[]);assert.deepEqual(before.reservations,[]);
    a.service.close();const again=await api(f);assert.deepEqual(await (await again.post()).json(),output);assert.deepEqual(await rows(f),before);
    const originals=createScopeReviewOriginalStore(f.pools,f.config,f.deps);services.push(originals);
    const restored=await originals.read(output.reference!);assert.deepEqual(restored.original,f.described.original);assert.deepEqual(restored.manifest,f.described.manifest);
    for(const marker of [f.content.originalText,'EXAM-MARKER-NOT-FOR-SCOPE','synthetic-scope-route',f.described.original.profile.instructions,'ciphertext'])assert.equal(JSON.stringify(output).includes(marker),false);
    assert.equal(JSON.stringify(restored.original).includes('EXAM-MARKER-NOT-FOR-SCOPE'),false);
    assert.equal(JSON.stringify(before.originals).includes(f.content.originalText),false);
  });
  await check('parallel HTTP preparations converge on one immutable review and encrypted original',async()=>{
    const f=await setup(),apis=await Promise.all(Array.from({length:4},()=>api(f)));
    const outputs=await Promise.all(apis.map(async a=>{const response=await a.post();assert.equal(response.status,200);return response.json();}));
    assert.ok(outputs.every(o=>o.outcome==='prepared'));for(const o of outputs)assert.deepEqual(o,outputs[0]);
    const stored=await rows(f);assert.equal(stored.runs.length,1);assert.equal(stored.originals.length,1);assert.equal(stored.reservations.length,0);
  });
  await check('lost scope admission and encrypted-original acknowledgements recover exact preparation without duplicate identities or expiry renewal',async()=>{
    for(const table of ['steer_execution.scope_review_runs','steer_drafts.scope_review_originals']){
      const f=await setup(),role=table.includes('steer_execution')?'execution':'drafts';let inserted=false,lost=false;
      const pools={...f.pools,[role]:{async connect(){const c=await f.pools[role].connect();return{query:async(sql:string,values?:unknown[])=>{
        const result=await c.query(sql,values);if(sql.includes(`INSERT INTO ${table}`))inserted=true;
        if(sql==='COMMIT'&&inserted&&!lost){lost=true;throw new Error('PRIVATE lost acknowledgement');}return result;},release:(broken:boolean)=>c.release(broken)} as PoolClient;}}};
      const first=await (await (await api(f,{},pools)).post()).json();assert.equal(first.outcome,'unknown');assert.equal(first.originalPreserved,false);assert.equal(lost,true);
      const prior=await rows(f),second=await (await (await api(f)).post()).json();assert.equal(second.outcome,'prepared');
      const after=await rows(f);assert.equal(after.runs.length,1);assert.deepEqual(after.runs,prior.runs);assert.equal(after.originals.length,1);
      if(prior.originals.length)assert.deepEqual(after.originals,prior.originals);assert.equal(after.reservations.length,0);
      if(first.reference)assert.deepEqual(first.reference,second.reference);
    }
  });
  await check('empty and incomplete source coverage never becomes newness or unnecessary model work',async()=>{
    for(const mode of ['empty','missing','partial','inaccessible']){
      const f=await setup(),evidence={...f.described.original.evidence};
      if(mode==='empty'){evidence.inventory=[];evidence.documents=[];}
      if(mode==='missing')evidence.documents=[];
      if(mode==='partial')evidence.documents=evidence.documents.slice(1);
      if(mode==='inaccessible'){evidence.inventoryComplete=false;evidence.accessGapCount=1;}
      const a=await api(f,{evidenceFor:async()=>evidence}),response=await a.post();assert.equal(response.status,200);const output=intentScopePrepareOutputSchema.parse(await response.json());
      assert.equal(output.outcome,mode==='empty'?'no-sources':mode==='missing'?'scope-incomplete':'prepared');assert.equal(output.authoritativeClearance,false);
      assert.equal(output.coverage?.plannedComplete,mode==='empty');assert.equal((await rows(f)).reservations.length,0);
      if(['empty','missing'].includes(mode)){assert.equal(output.reference,null);assert.equal((await rows(f)).runs.length,0);}
      if(mode==='partial'){assert.equal(output.coverage?.gapCount,2);assert.equal(output.coverage?.plannedCount,2);}
    }
  });
  await check('scope prepare endpoint defaults closed and rejects agents, missing grants, foreign scope and caller content before writes',async()=>{
    const f=await setup(),a=await api(f),request={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(a.input)};
    assert.equal((await createApi().request('/v1/tools/intent.scope.prepare',request)).status,401);
    assert.equal((await createApi({authenticate:async()=>a.state.principal}).request('/v1/tools/intent.scope.prepare',request)).status,503);
    for(const key of ['organizationId','productId','repository','configurationRevision'])assert.equal((await a.post({[key]:'foreign'})).status,403);
    for(const key of ['profile','budget','documents','reviewId','batchIds','choice'])assert.equal((await a.post({[key]:'PRIVATE'})).status,422);
    a.state.principal.type='agent';assert.equal((await a.post()).status,403);a.state.principal.type='human';a.state.principal.toolGrants=[];assert.equal((await a.post()).status,403);
    assert.deepEqual(await rows(f),{runs:[],originals:[],batches:[],reservations:[]});
  });
  await check('stale saved revisions and repository snapshots cannot be prepared over newer human work',async()=>{
    const f=await setup(),a=await api(f);
    for(const key of ['revisionDigest','scopeInputDigest','sourceSnapshotDigest'])assert.equal((await (await a.post({[key]:'f'.repeat(64)})).json()).outcome,'conflict');
    assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
      content:{...f.content,originalText:'New human correction'}})).outcome,'acknowledged');
    assert.equal((await (await a.post()).json()).outcome,'conflict');assert.equal((await rows(f)).runs.length,0);
    const changing=await setup();let reads=0;
    const b=await api(changing,{evidenceFor:async()=>{reads++;return{...changing.described.original.evidence,inventoryComplete:reads>2?false:true};}});
    assert.equal((await (await b.post()).json()).outcome,'conflict');assert.equal((await rows(changing)).runs.length,0);
  });
  await check('records, key, preparation and pinned profile denials never become a ready receipt',async()=>{
    for(const denied of ['authorizePreparation','authorizeDraft','authorizeOriginal','keyForDraft','profile','nonvoid']){
      const f=await setup(),fail=async()=>{throw new Error('PRIVATE authority denial');};let patch:Partial<Dependencies>={},profile:unknown=f.described.original.profile;
      if(denied==='authorizePreparation')patch={authorizePreparation:fail};
      else if(denied==='nonvoid')patch={authorizePreparation:async()=>true as any};
      else if(denied==='profile')profile={...f.described.original.profile,allowedResponseModels:['changed']};
      else patch={records:{...f.deps,[denied]:fail}};
      const result=await (await (await api(f,patch,f.pools,f.execution,profile)).post()).json();assert.notEqual(result.outcome,'prepared');assert.equal(result.originalPreserved,false);assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
      const stored=await rows(f);assert.equal(stored.originals.length,0);assert.equal(stored.reservations.length,0);
    }
  });
  await check('mid-flight grant revocation conceals committed scope admission and exact reauthorization recovers it',async()=>{
    const f=await setup();let revoke=()=>{};
    const a=await api(f,{records:{...f.deps,authorize:async c=>{if(c.action==='put')revoke();}}});revoke=()=>{a.state.principal.toolGrants=[];};
    assert.equal((await a.post()).status,403);const before=await rows(f);assert.equal(before.runs.length,1);assert.equal(before.originals.length,0);
    const next=await (await (await api(f)).post()).json();assert.equal(next.outcome,'prepared');assert.deepEqual((await rows(f)).runs,before.runs);
  });
  await check('edits or holds after review admission stop original capture without undoing immutable metadata',async()=>{
    for(const action of ['edit','hold']){
      const f=await setup();let applied=false;
      const a=await api(f,{records:{...f.deps,authorizeReview:async()=>{
        if(!applied&&(await rows(f)).runs.length){applied=true;
          if(action==='hold')assert.equal((await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()})).outcome,'ok');
          else assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,content:{...f.content,originalText:'Corrected after admission'}})).outcome,'acknowledged');
        }
      }}});
      const output=await (await a.post()).json();assert.equal(output.outcome,'unknown');assert.equal(applied,true);
      const stored=await rows(f);assert.equal(stored.runs.length,1);assert.equal(stored.originals.length,0);assert.equal(stored.reservations.length,0);
    }
  });
  await check('expired fixed scope execution cannot be re-prepared with renewed expiry or another review identity',async()=>{
    const f=await setup(4,2500),a=await api(f),first=await (await a.post()).json();assert.equal(first.outcome,'prepared');const before=await rows(f);
    await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));assert.notEqual((await (await a.post()).json()).outcome,'prepared');
    const renewed=await api(f,{},f.pools,{...f.execution,expiresAt:new Date(Date.now()+60000).toISOString()});
    assert.notEqual((await (await renewed.post()).json()).outcome,'prepared');assert.deepEqual(await rows(f),before);
  });
  const corpusFixture=async()=>{
    const f=await setup(4,3600000,binding.branch),git=nativeGitFixture({after:f=>cleanup.push(f)});
    git.add([{path:'intent/0001/BRIEF.md',content:'# Existing billing\nHuman invoices.\n'},
      {path:'intent/0001/SPEC.md',content:'# Existing scope\nOut of scope: patient booking.\n'},
      {path:'intent/0001/EXAM.md',content:'PRIVATE EXAM MUST NOT ENTER SCOPE'}]);
    const reader=createGitHubReader({...binding,organizationId:f.config.organizationId},{appJwt:async()=>'synthetic-app-jwt',fetch:git.transport,now:()=>now});
    let permitted=true;
    const authority={authorize:async()=>{if(!permitted)throw new Error('PRIVATE corpus denial');return{permissionsRevision:'p1'};},
      select:async(context:unknown)=>({...context as object,selection:'canonical',authorityDigest:'a'.repeat(64)}),authorizeSource:async()=>{}};
    const {organizationId,productId,repository,branch}=f.config,corpus=createIntentCorpusEvidence(reader,{organizationId,productId,repository,branch,retrievalConfigurationRevision:'retrieval-r1'},authority);services.push(corpus);
    const evidence=(await corpus.collect({organizationId,productId,repository,branch,scopeInputDigest:f.saved.reference.scopeInputDigest},async()=>{})).evidence;
    const service=createCorpusRecordedScopePreparer(reader,f.pools,f.execution,f.described.original.profile,'retrieval-r1',{records:f.deps,authorizePreparation:async()=>{},authority});
    const a=await api(f,{evidenceFor:async()=>evidence},f.pools,f.execution,f.described.original.profile,service);
    return{f,git,reader,evidence,a,revoke(){permitted=false;}};
  };
  await check('scope preparation HTTP composes actual native-Git repository discovery with encrypted SQL capture and exact reopen',async()=>{
    const {f,git,evidence,a}=await corpusFixture(),response=await a.post();assert.equal(response.status,200);const output=await response.json();assert.equal(output.outcome,'prepared');
    const originals=createScopeReviewOriginalStore(f.pools,f.config,f.deps);services.push(originals);const recovered=await originals.read(output.reference);
    assert.deepEqual(recovered.original.evidence,evidence);assert.equal(recovered.original.evidence.head,git.head());assert.equal(output.coverage.plannedCount,2);
    assert.deepEqual(evidence.inventory.map(s=>s.path),['intent/0001/BRIEF.md','intent/0001/SPEC.md']);
    assert.equal(JSON.stringify(recovered.original).includes('PRIVATE EXAM'),false);assert.equal(git.mutations(),0);assert.equal((await rows(f)).reservations.length,0);
  });
  await check('scope preparation native-Git head drift and corpus authority loss deny capture before SQL admission',async()=>{
    for(const mode of ['head','authority']){
      const {f,git,reader,a,revoke}=await corpusFixture();
      if(mode==='authority')revoke();else{const read=reader.readHead;let heads=0;
        reader.readHead=async()=>{if(++heads===3)git.add([{path:'intent/0001/SPEC.md',content:'# Changed scope\nBooking included\n'}]);return read();};}
      const response=await a.post(),output=await response.json();assert.notEqual(output.outcome,'prepared');assert.equal(JSON.stringify(output).includes('PRIVATE'),false);
      assert.deepEqual(await rows(f),{runs:[],originals:[],batches:[],reservations:[]});assert.equal(git.mutations(),0);
    }
  });
  await check('expiry during the final preparation authority check withholds readiness without undoing captured scope',async()=>{
    const f=await setup(4,2500);let checks=0;
    const a=await api(f,{authorizePreparation:async()=>{if(++checks===3)await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));}});
    const result=await (await a.post()).json();assert.equal(checks,3);assert.equal(result.outcome,'unknown');assert.equal(result.readyToRequestStart,false);
    const stored=await rows(f);assert.equal(stored.runs.length,1);assert.equal(stored.originals.length,1);assert.equal(stored.reservations.length,0);
  });
}
