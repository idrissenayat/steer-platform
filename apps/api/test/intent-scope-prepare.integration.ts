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
import {expireAgedDraftLifecycle} from '../../../packages/data/test/aged-draft-lifecycle.fixture.ts';

type Fixture=Awaited<ReturnType<typeof scopeDraftIntegrationFixture>>;
type Dependencies=Parameters<typeof createRecordedScopePreparer>[3];
type Pools=Parameters<typeof createRecordedScopePreparer>[0];
/** Actual authenticated HTTP/SQL path with synthetic grants, sources and keys.
 * No live records adoption, remote call, model, workflow start or Git write. */
export async function testScopePreparation({admin,connect,check:checkBase}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}){
  const services:{close():void}[]=[],owned:Pool[]=[],cleanup:Array<()=>void>=[];
  const check=(name:string,run:()=>Promise<void>)=>checkBase(name,async()=>{try{await run();}finally{services.splice(0).forEach(s=>s.close());await Promise.all(owned.splice(0).map(p=>p.end()));cleanup.splice(0).forEach(f=>f());}});
  const setup=async(sourceCount=4,ttl=3600000,branch?:string,agedLifecycle=false)=>{
    const f=await scopeDraftIntegrationFixture({admin,connect:role=>{const pool=connect(role);owned.push(pool);return pool;}},false,ttl,{sourceCount,agedLifecycle,...(branch===undefined?{}:{branch})});
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
  await check('scope preparation owns exactly two draft key reads per phase and closes draft verification after evidence but before each effect',async()=>{
    const f=await setup(),keys=[0,0,0],events:string[]=[];let phase=0,open=false,finalKey=false;
    const pool=(role:'drafts'|'execution')=>({async connect(){const c=await f.pools[role].connect();return{
      query:async(sql:string,values?:unknown[])=>{
        if(/^\s*INSERT INTO steer_(execution\.scope_review_runs|drafts\.scope_review_originals)\b/.test(sql)){
          assert.equal(open,false);assert.equal(finalKey,false);assert.equal(keys[phase-1],2);events.push(`write:${phase}`);
        }return c.query(sql,values);
      },release:(broken:boolean)=>c.release(broken)} as PoolClient;}});
    const a=await api(f,{records:{...f.deps,keyForDraft:async(...args)=>{
      if(open||finalKey){keys[phase-1]=keys[phase-1]!+1;events.push(`${open?'initial':'final'}:${phase}`);finalKey=false;}
      return f.deps.keyForDraft(...args);
    }},withEvidenceRead:async(_input,_current,work)=>{
      phase++;open=true;try{await work(async()=>f.described.original.evidence);}finally{open=false;}
      finalKey=true;events.push(`evidence-closed:${phase}`);
    }},{drafts:pool('drafts'),execution:pool('execution')});
    const result=await (await a.post()).json();assert.equal(result.outcome,'prepared');assert.deepEqual(keys,[2,2,2]);assert.equal(finalKey,false);
    assert.deepEqual(events,['initial:1','evidence-closed:1','final:1','write:1','initial:2','evidence-closed:2','final:2','write:2','initial:3','evidence-closed:3','final:3']);
    const before=await rows(f);assert.equal(before.runs.length,1);assert.equal(before.originals.length,1);assert.equal(before.reservations.length,0);
    const originals=createScopeReviewOriginalStore(f.pools,f.config,f.deps);services.push(originals);
    assert.deepEqual((await originals.read(result.reference)).original,f.described.original);
  });
  await check('scope preparation rejects successful late draft changes after evidence closure in all three effect-separated phases',async()=>{
    for(const target of [1,2,3])for(const mode of ['edit','hold','expire','key','grant','close']){
      const f=await setup(4,3600000,undefined,mode==='expire');let phase=0,changed=false,denied=false,keyChanged=false;
      let a:Awaited<ReturnType<typeof api>>;
      a=await api(f,{records:{...f.deps,authorizeDraft:async c=>{if(denied)throw new Error('PRIVATE revoked draft');await f.deps.authorizeDraft(c);},
        keyForDraft:async(...args)=>{const key=await f.deps.keyForDraft(...args);return keyChanged?{...key,bytes:Buffer.alloc(32)}:key;}},
        withEvidenceRead:async(_input,_current,work)=>{
          phase++;await work(async()=>f.described.original.evidence);if(phase!==target)return;
          if(mode==='edit')assert.equal((await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
            content:{...f.content,originalText:'Late human correction'}})).outcome,'acknowledged');
          if(mode==='hold')assert.equal((await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()})).outcome,'ok');
          if(mode==='expire')await expireAgedDraftLifecycle(admin,f.draftId);
          if(mode==='key')keyChanged=true;if(mode==='grant')denied=true;if(mode==='close')a.service.close();changed=true;
        }});
      const response=await a.post(),result=await response.json();assert.equal(changed,true,`${target}/${mode} transition must succeed`);
      assert.equal(response.status,200);assert.equal(result.outcome,target===1?'unavailable':'unknown');assert.equal(result.readyToRequestStart,false);
      const stored=await rows(f);assert.equal(stored.runs.length,target===1?0:1);assert.equal(stored.originals.length,target===3?1:0);assert.equal(stored.reservations.length,0);
      assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
    }
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
    const authority:Parameters<typeof createIntentCorpusEvidence>[2]={authorize:async()=>{if(!permitted)throw new Error('PRIVATE corpus denial');return{permissionsRevision:'p1'};},
      select:async(context:unknown)=>({...context as object,selection:'canonical',authorityDigest:'a'.repeat(64)}),authorizeSource:async()=>{}};
    const {organizationId,productId,repository,branch}=f.config,corpus=createIntentCorpusEvidence(reader,{organizationId,productId,repository,branch,retrievalConfigurationRevision:'retrieval-r1'},authority);services.push(corpus);
    const evidence=(await corpus.collect({organizationId,productId,repository,branch,scopeInputDigest:f.saved.reference.scopeInputDigest},async()=>{})).evidence;
    const service=createCorpusRecordedScopePreparer(reader,f.pools,f.execution,f.described.original.profile,'retrieval-r1',{records:f.deps,authorizePreparation:async()=>{},authority});
    const a=await api(f,{evidenceFor:async()=>evidence},f.pools,f.execution,f.described.original.profile,service);
    return{f,git,reader,evidence,a,corpus,authority,revoke(){permitted=false;}};
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
  await check('private scope preparation windows reduce native body reads while preserving the full fallback and exact original',async()=>{
    const c=await corpusFixture(),{f,corpus,a,git}=c,start=git.calls.length;
    // Observe the transport, not a replacement method: the actual application
    // pins its native reader and uses one two-document batch per source phase.
    const output=await (await a.post()).json();assert.equal(output.outcome,'prepared');
    const windowCalls=git.calls.slice(start);assert.equal(windowCalls.filter(c=>c.corpusQuery).length,4);
    assert.equal(windowCalls.filter(c=>c.path.includes('/git/blobs/')).length,0);
    const before=await rows(f),{organizationId,productId,repository,branch}=f.config;
    const fallback=await api(f,{evidenceFor:async(_input,current)=>(await corpus.collect({organizationId,productId,repository,branch,
      scopeInputDigest:f.saved.reference.scopeInputDigest},current)).evidence});
    const fallbackStart=git.calls.length;assert.deepEqual(await (await fallback.post()).json(),output);
    const fallbackCalls=git.calls.slice(fallbackStart);assert.equal(fallbackCalls.filter(c=>c.path.includes('/git/blobs/')).length,14);
    assert.equal(fallbackCalls.filter(c=>c.corpusQuery).length,0);assert.ok(windowCalls.length<fallbackCalls.length);
    assert.deepEqual(await rows(f),before);assert.equal(c.git.mutations(),0);assert.equal(before.reservations.length,0);
    const originals=createScopeReviewOriginalStore(f.pools,f.config,f.deps);services.push(originals);
    assert.deepEqual((await originals.read(output.reference)).original.evidence,c.evidence);
  });
  await check('actual scope preparation rejects a replaced native reader before SQL admission',async()=>{
    const c=await corpusFixture(),method=c.reader.readArtifact;let invoked=0;
    c.reader.readArtifact=async(...args)=>{invoked++;return method(...args);};
    const output=await (await c.a.post()).json();assert.equal(output.outcome,'unavailable');assert.equal(invoked,0);
    assert.deepEqual(await rows(c.f),{runs:[],originals:[],batches:[],reservations:[]});assert.equal(c.git.mutations(),0);
  });
  await check('scope preparation windows close before every admission or original write and reopen with fresh native bodies',async()=>{
    const c=await corpusFixture(),{f,reader,corpus}=c,{organizationId,productId,repository,branch}=f.config;
    let open=false,windows=0,policies=0;const writes:string[]=[],bodyPhases:string[]=[],method=reader.readArtifact;
    reader.readArtifact=async(...args)=>{bodyPhases.push(`${open?windows:0}:${writes.length}`);return method(...args);};
    const pool=(role:'drafts'|'execution')=>({async connect(){const client=await f.pools[role].connect();return{
      query:async(sql:string,values?:unknown[])=>{
        if(/^\s*INSERT INTO steer_(execution\.scope_review_runs|drafts\.scope_review_originals)\b/.test(sql)){
          assert.equal(open,false,'Read-only evidence window crossed a write');writes.push(sql.includes('scope_review_runs')?'admission':'original');
        }
        return client.query(sql,values);
      },release:(broken:boolean)=>client.release(broken)} as PoolClient;}});
    const evidenceFor:Dependencies['evidenceFor']=async(_input,current)=>(await corpus.collect({organizationId,productId,repository,branch,
      scopeInputDigest:f.saved.reference.scopeInputDigest},current)).evidence;
    const a=await api(f,{evidenceFor,authorizePreparation:async()=>{assert.equal(open,true);policies++;},
      withEvidenceRead:async(input,current,work)=>{
        assert.equal(open,false);open=true;windows++;
        try{await corpus.withReadSession({organizationId,productId,repository,branch,scopeInputDigest:input.scopeInputDigest},current,
          read=>work(async()=>(await read()).evidence));}finally{open=false;}
      }},{drafts:pool('drafts'),execution:pool('execution')});
    bodyPhases.length=0;const output=await (await a.post()).json();assert.equal(output.outcome,'prepared');
    assert.equal(open,false);assert.equal(windows,3);assert.equal(policies,3);assert.deepEqual(writes,['admission','original']);
    assert.deepEqual(bodyPhases,['0:0','0:0','1:0','1:0','2:1','2:1','3:2','3:2']);
    const stored=await rows(f);assert.equal(stored.runs.length,1);assert.equal(stored.originals.length,1);assert.equal(stored.reservations.length,0);
  });
  await check('final private corpus grant recheck denies scope admission after otherwise completed validation',async()=>{
    const c=await corpusFixture(),{f,corpus,authority}=c,{organizationId,productId,repository,branch}=f.config;let revoked=false;
    authority.authorizeSource=async ref=>{if(revoked&&ref.path.endsWith('/SPEC.md'))throw new Error('PRIVATE revoked source');};
    const a=await api(f,{evidenceFor:async()=>c.evidence,withEvidenceRead:async(input,current,work)=>
      corpus.withReadSession({organizationId,productId,repository,branch,scopeInputDigest:input.scopeInputDigest},current,async read=>{
        await work(async()=>(await read()).evidence);revoked=true;
      })});
    const output=await (await a.post()).json();assert.equal(output.outcome,'unavailable');assert.equal(output.originalPreserved,false);
    assert.deepEqual(await rows(f),{runs:[],originals:[],batches:[],reservations:[]});assert.equal(c.git.mutations(),0);
  });
  await check('new native evidence after admission or original persistence is not reused across effect boundaries',async()=>{
    for(const target of ['scope_review_runs','scope_review_originals']){
      const c=await corpusFixture(),{f,git,reader,authority}=c;let inserted=false,changed=false;
      const role=target==='scope_review_runs'?'execution':'drafts';
      const pools={...f.pools,[role]:{async connect(){const client=await f.pools[role].connect();return{
        query:async(sql:string,values?:unknown[])=>{const result=await client.query(sql,values);
          if(sql.includes(`INSERT INTO steer_${role==='execution'?'execution':'drafts'}.${target}`))inserted=true;
          if(sql==='COMMIT'&&inserted&&!changed){changed=true;git.add([{path:'intent/0001/SPEC.md',content:'# Changed source after an effect\n'}]);}
          return result;
        },release:(broken:boolean)=>client.release(broken)} as PoolClient;}}};
      const service=createCorpusRecordedScopePreparer(reader,pools,f.execution,f.described.original.profile,'retrieval-r1',
        {records:f.deps,authorizePreparation:async()=>{},authority});
      const a=await api(f,{evidenceFor:async()=>c.evidence},pools,f.execution,f.described.original.profile,service);
      const output=await (await a.post()).json();assert.equal(changed,true);assert.equal(output.outcome,'unknown');assert.equal(output.originalPreserved,false);
      const stored=await rows(f);assert.equal(stored.runs.length,1);assert.equal(stored.originals.length,target==='scope_review_runs'?0:1);
      assert.equal(stored.reservations.length,0);assert.equal(git.mutations(),0);
      if(stored.originals.length){const originals=createScopeReviewOriginalStore(f.pools,f.config,f.deps);services.push(originals);
        assert.deepEqual((await originals.read(output.reference)).original.evidence,c.evidence);}
    }
  });
}
