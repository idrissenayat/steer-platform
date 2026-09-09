import assert from 'node:assert/strict';
import { createHash,randomBytes,randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool,PoolClient } from 'pg';
import { scopeReviewFixture } from '../../tool-registry/test/intent-scope-review.fixture.ts';
import { fingerprintIntentScope } from '../../tool-registry/src/intent-revision-contracts.ts';
import { createDraftLifecycleStore } from '../src/draft-lifecycle.ts';
import { createDraftRevisionStore } from '../src/draft-revisions.ts';
import { describeScopeOriginal } from '../src/scope-original-contracts.ts';
import { createScopeReviewOperationStore } from '../src/scope-review-operations.ts';
import { createScopeReviewOriginalStore } from '../src/scope-review-originals.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';
import { intentEvidenceInputSchema } from '../../tool-registry/src/intent-evidence-contracts.ts';

type Dependencies=Parameters<typeof createScopeReviewOriginalStore>[2];
export type ScopeFixtureOptions={sourceCount?:number;inventoryComplete?:boolean;accessGapCount?:number;branch?:string;organizationId?:string;
  repositoryEvidence?:(input:ReturnType<typeof intentEvidenceInputSchema.parse>)=>Promise<ReturnType<typeof intentEvidenceInputSchema.parse>>};
export async function scopeDraftIntegrationFixture({admin,connect}:{admin:Pool;connect(role:string):Pool},large=false,ttl=3600000,
  options:ScopeFixtureOptions={}) {
  const f=await scopeReviewFixture(options.sourceCount??(large?40:4));
  const config={organizationId:options.organizationId??`scope-original-${randomUUID()}`,subject:'synthetic-human',productId:f.scope.productId,repository:f.scope.repository,
    branch:options.branch??f.evidence.branch,configurationRevision:'scope-original-r1',recordsPolicyDigest:'a'.repeat(64)};
  const budget={organizationId:config.organizationId,subject:config.subject,configurationRevision:config.configurationRevision,budgetId:randomUUID(),
    approvalDigest:'b'.repeat(64),capMicrousd:30,architectMicrousd:3,testAgentMicrousd:2};
  const execution={...config,expiresAt:new Date(Date.now()+ttl).toISOString(),budget,
    scopeTerms:{approvalDigest:'c'.repeat(64),profileDigest:f.prepared.batches[0]!.packet.profileDigest,amountMicrousd:4}};
  await admin.query(`INSERT INTO steer_usage.model_budgets VALUES($1,$2,$3,$4,$5,30,3,2,now()-interval '1 minute',now()+interval '1 hour',true)`,
    [budget.organizationId,budget.budgetId,budget.subject,budget.configurationRevision,budget.approvalDigest]);
  const pools={drafts:connect('steer_draft_runtime'),execution:connect('steer_app')},key={keyId:`synthetic-${randomUUID()}`,bytes:randomBytes(32)};
  const deps:Dependencies={authorize:async()=>{},authorizeOriginal:async()=>{},authorizeReview:async()=>{},authorizeDraft:async()=>{},
    keyForDraft:async(_ref,keyId)=>{assert.ok(keyId===null||keyId===key.keyId);return key;}};
  const lifecycle=createDraftLifecycleStore(pools.drafts,config,{authorize:async()=>{},verifyHold:async()=>{}}),created=await lifecycle.create({requestId:randomUUID()});
  assert.equal(created.outcome,'ok');if(created.outcome!=='ok')throw new Error('Synthetic lifecycle missing');
  const draftId=created.value.draftId,drafts=createDraftRevisionStore(pools.drafts,config,{authorize:deps.authorizeDraft,keyForDraft:deps.keyForDraft});
  const content={originalText:f.scope.originalText,clarificationTurns:f.scope.clarificationTurns,documents:{...f.scope.documents,exam:'EXAM-MARKER-NOT-FOR-SCOPE'}};
  const saved=await drafts.append({draftId,mutationId:randomUUID(),expectedRevision:0,expectedDigest:null,content});
  assert.equal(saved.outcome,'acknowledged');if(saved.outcome!=='acknowledged')throw new Error('Synthetic revision missing');
  const scope={...f.scope,organizationId:config.organizationId,draftId},documents=f.evidence.documents.map((d,i)=>({...d,content:large?`# Source ${i}\n`+'x'.repeat(20000):d.content}));
  const fixtureEvidence={...f.evidence,inventoryComplete:options.inventoryComplete??f.evidence.inventoryComplete,
    accessGapCount:options.accessGapCount??f.evidence.accessGapCount,
    organizationId:config.organizationId,branch:config.branch,scopeInputDigest:(await fingerprintIntentScope(scope)).scopeInputDigest,documents,
    inventory:f.evidence.inventory.map((s,i)=>({...s,contentDigest:createHash('sha256').update(documents[i]!.content).digest('hex'),
      blobOid:createHash('sha1').update(`blob ${Buffer.byteLength(documents[i]!.content)}\0${documents[i]!.content}`).digest('hex')}))};
  // Resolve repository bytes BEFORE immutable original hashing/admission. Never
  // rewrite retained scope evidence to fit a later destination fixture.
  const evidence=options.repositoryEvidence?await options.repositoryEvidence(fixtureEvidence):fixtureEvidence;
  const described=await describeScopeOriginal({kind:'steer-scope-original/v1',configuration:execution,
    source:{revision:1,revisionDigest:saved.reference.revisionDigest,scope},evidence,profile:f.profile});
  return{config,execution,pools,key,deps,draftId,drafts,lifecycle,saved,content,described};
}
export async function scopeOriginalIntegrationFixture(dependencies:Parameters<typeof scopeDraftIntegrationFixture>[0],large=false,ttl=3600000,
  options:Parameters<typeof scopeDraftIntegrationFixture>[3]={}) {
  const base=await scopeDraftIntegrationFixture(dependencies,large,ttl,options),{config,execution,pools,deps,described}=base;
  const reviews=createScopeReviewOperationStore(pools.execution,execution,{authorize:deps.authorizeReview}),admitted=await reviews.admit(described.manifest);
  assert.equal(admitted.outcome,'ok');if(admitted.outcome!=='ok')throw new Error('Synthetic review missing');
  const target={reviewId:admitted.value.reviewId,preparationDigest:described.manifest.preparationDigest},input={...target,original:described.original};
  const make=(overrides:Partial<Dependencies>={},otherPools:{drafts:DatabasePool;execution:DatabasePool}=pools,patch={})=>createScopeReviewOriginalStore(otherPools,{...config,...patch},{...deps,...overrides});
  const row=async()=>(await dependencies.admin.query('SELECT * FROM steer_drafts.scope_review_originals WHERE review_id=$1',[target.reviewId])).rows[0];
  return{...base,reviews,target,input,make,row};
}
export async function testScopeOriginals({admin,connect,check}:{admin:Pool;connect(role:string):Pool;check(name:string,run:()=>Promise<void>):Promise<void>}) {
  const setup=(large=false,ttl=3600000)=>scopeOriginalIntegrationFixture({admin,connect},large,ttl);
  await check('encrypted multi-batch scope originals restore exact Unicode input, full corpus and pinned profile without Exam or reservations',async()=>{
    const f=await setup(true);assert.ok(Buffer.byteLength(JSON.stringify(f.input.original))>786432);assert.ok(f.described.manifest.batches.length>1);
    assert.equal((await f.make().put(f.input)).outcome,'stored');
    const read=await f.make().read(f.target);assert.deepEqual(read.original,f.input.original);assert.deepEqual(read.manifest,f.described.manifest);
    assert.equal(read.executionAuthorized,false);assert.equal(read.retryAuthorized,false);assert.equal(read.reviewExpired,false);
    assert.equal(JSON.stringify(read.original).includes('EXAM-MARKER-NOT-FOR-SCOPE'),false);
    const row=await f.row();assert.ok(row.encrypted_value.chunks.length>1);
    for(const source of ['# Source 0',f.content.originalText,f.input.original.profile.instructions])assert.equal(JSON.stringify(row).includes(source),false);
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM steer_usage.model_reservations WHERE budget_id=$1',[f.execution.budget.budgetId])).rows[0].n,0);
  });
  await check('parallel capture and lost insert acknowledgement converge on one immutable encrypted scope original',async()=>{
    const f=await setup();let inserted=false;
    const uncertain:DatabasePool={async connect(){const c=await f.pools.drafts.connect();return{query:async(sql:string,values?:unknown[])=>{
      const result=await c.query(sql,values);if(sql.includes('INSERT INTO steer_drafts.scope_review_originals'))inserted=true;
      if(sql==='COMMIT'&&inserted)throw new Error('Synthetic lost original acknowledgement');return result;},release:(broken:boolean)=>c.release(broken)} as PoolClient;}};
    assert.equal((await f.make({}, {...f.pools,drafts:uncertain}).put(f.input)).outcome,'unknown');
    const first=await f.row(),writers=await Promise.all(Array.from({length:4},()=>f.make({}, {drafts:connect('steer_draft_runtime'),execution:connect('steer_app')}).put(f.input)));
    assert.ok(writers.every(r=>r.outcome==='stored'));assert.deepEqual(await f.row(),first);assert.deepEqual((await f.make().read(f.target)).original,f.input.original);
    const changed=structuredClone(f.input);changed.original.profile.maxOutputTokens=4096;
    assert.notEqual((await f.make().put(changed)).outcome,'stored');
    assert.notEqual((await f.make().put({...f.input,reviewId:randomUUID()})).outcome,'stored');assert.deepEqual(await f.row(),first);
  });
  await check('expired scope inputs remain explicitly historical under current records authority and cannot renew execution',async()=>{
    const f=await setup(false,1500);assert.equal((await f.make().put(f.input)).outcome,'stored');
    await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));
    const read=await f.make({authorizeReview:async()=>{throw new Error('Expired execution authority');}}).read(f.target);
    assert.equal(read.reviewExpired,true);assert.equal(read.executionAuthorized,false);assert.deepEqual(read.original,f.input.original);
    assert.notEqual((await f.make().put(f.input)).outcome,'stored');
    assert.equal((await f.reviews.admit(f.described.manifest)).outcome,'unavailable');
  });
  await check('new edits do not overwrite old scope originals or permit stale original capture',async()=>{
    const f=await setup();assert.equal((await f.make().put(f.input)).outcome,'stored');const before=await f.row();
    const edit=await f.drafts.append({draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
      content:{...f.content,originalText:'New human scope'}});assert.equal(edit.outcome,'acknowledged');
    const read=await f.make().read(f.target);assert.equal(read.latestDraftRevision,2);assert.deepEqual(read.original,f.input.original);
    assert.notEqual((await f.make().put(f.input)).outcome,'stored');assert.deepEqual(await f.row(),before);
    const notCaptured=await setup();await notCaptured.drafts.append({draftId:notCaptured.draftId,mutationId:randomUUID(),expectedRevision:1,
      expectedDigest:notCaptured.saved.reference.revisionDigest,content:{...notCaptured.content,originalText:'Changed before capture'}});
    assert.notEqual((await notCaptured.make().put(notCaptured.input)).outcome,'stored');assert.equal(await notCaptured.row(),undefined);
  });
  await check('scope original isolation and current source, owner, records and historical-key revocation deny plaintext release',async()=>{
    const f=await setup();assert.equal((await f.make().put(f.input)).outcome,'stored');
    for(const patch of [{organizationId:'foreign'},{subject:'foreign'},{productId:'foreign'},{recordsPolicyDigest:'f'.repeat(64)}])await assert.rejects(f.make({},f.pools,patch).read(f.target));
    let keys=0;
    await assert.rejects(f.make({authorize:async()=>{throw new Error('Denied');},keyForDraft:async()=>{keys++;return f.key;}}).read(f.target));assert.equal(keys,0);
    await assert.rejects(f.make({authorizeOriginal:async()=>{throw new Error('Source revoked');}}).read(f.target));
    await assert.rejects(f.make({keyForDraft:async()=>({...f.key,bytes:randomBytes(32)})}).read(f.target));
    let allowed=true;
    await assert.rejects(f.make({authorizeOriginal:async()=>{if(!allowed)throw new Error('Late source revocation');},keyForDraft:async()=>{allowed=false;return f.key;}}).read(f.target));
    const held=await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()});assert.equal(held.outcome,'ok');
    await assert.rejects(f.make({keyForDraft:async()=>{keys++;return f.key;}}).read(f.target));assert.equal(keys,0);
    assert.ok(await f.row());
  });
  await check('SQL refuses plaintext metadata, runtime rewrites/deletion and wrong-role reads of scope originals',async()=>{
    const f=await setup();assert.equal((await f.make().put(f.input)).outcome,'stored');const row=await f.row();
    assert.deepEqual((await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='steer_drafts.scope_review_originals'::regclass")).rows[0],{relrowsecurity:true,relforcerowsecurity:true});
    assert.equal((await f.pools.drafts.query('SELECT * FROM steer_drafts.scope_review_originals')).rowCount,0);
    for(const role of ['steer_app','steer_projector','steer_auth_runtime'])await assert.rejects(connect(role).query('SELECT * FROM steer_drafts.scope_review_originals'),{code:'42501'});
    await assert.rejects(f.make({}, {...f.pools,drafts:admin}).read(f.target));
    for(const sql of ['DELETE FROM steer_drafts.scope_review_originals','TRUNCATE steer_drafts.scope_review_originals',"UPDATE steer_drafts.scope_review_originals SET record='{}'"])
      await assert.rejects(f.pools.drafts.query(sql),{code:'42501'});
    await assert.rejects(admin.query(`INSERT INTO steer_drafts.scope_review_originals VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
      [row.organization_id,row.subject,row.product_id,row.review_id,row.preparation_digest,row.payload_digest,row.draft_id,row.draft_revision,
        JSON.stringify({...row.record,privatePrompt:'cannot persist'}),JSON.stringify(row.encrypted_value)]),{code:'23514'});
    await assert.rejects(admin.query(`INSERT INTO steer_drafts.scope_review_originals VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
      [row.organization_id,row.subject,row.product_id,row.review_id,row.preparation_digest,row.payload_digest,row.draft_id,row.draft_revision,
        JSON.stringify(row.record),JSON.stringify({...row.encrypted_value,privatePrompt:'cannot persist'})]),{code:'23514'});
  });
  await check('ciphertext transplantation, chunk reordering and revocation at final source-key check cannot release scope originals',async()=>{
    const f=await setup(true);assert.equal((await f.make().put(f.input)).outcome,'stored');const row=await f.row();
    await admin.query('UPDATE steer_drafts.scope_review_originals SET encrypted_value=$1::jsonb WHERE review_id=$2',
      [JSON.stringify({...row.encrypted_value,chunks:[...row.encrypted_value.chunks].reverse()}),f.target.reviewId]);
    await assert.rejects(f.make().read(f.target));
    await admin.query('UPDATE steer_drafts.scope_review_originals SET encrypted_value=$1::jsonb WHERE review_id=$2',[JSON.stringify(row.encrypted_value),f.target.reviewId]);
    const other=await setup();assert.equal((await other.make().put(other.input)).outcome,'stored');
    await admin.query('UPDATE steer_drafts.scope_review_originals SET encrypted_value=$1::jsonb WHERE review_id=$2',[JSON.stringify(row.encrypted_value),other.target.reviewId]);
    await assert.rejects(other.make({keyForDraft:async()=>f.key}).read(other.target));
    let calls=0,allowed=true;
    await assert.rejects(f.make({authorizeDraft:async()=>{if(!allowed)throw new Error('Late draft revocation');},keyForDraft:async()=>{if(++calls===4)allowed=false;return f.key;}}).read(f.target));
    assert.equal(calls,4);assert.deepEqual((await f.make().read(f.target)).original,f.input.original);
  });
  await check('closing a pending scope key lookup withholds late content and leaves the durable original untouched',async()=>{
    const f=await setup();assert.equal((await f.make().put(f.input)).outcome,'stored');const row=await f.row();
    let release!:()=>void,entered!:()=>void;const held=new Promise<void>(r=>{release=r;}),reached=new Promise<void>(r=>{entered=r;});
    const store=f.make({keyForDraft:async()=>{entered();await held;return f.key;}}),read=store.read(f.target);
    await reached;store.close();release();await assert.rejects(read);assert.deepEqual(await f.row(),row);
  });
}
