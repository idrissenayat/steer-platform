import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import type { scopeStepIntegrationFixture } from '../../worker/test/scope-step-runtime.integration.ts';
import { buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';
import { planIntentScopeBatches } from '@steer/tool-registry/intent-scope-batches';
import { buildIntentDevelopmentContext } from '@steer/tool-registry/intent-development-context';
import { createDevelopmentOriginalStore } from '@steer/data/development-originals';
import { describeDevelopmentOriginal } from '@steer/data/development-original-contracts';
import { renderDevelopmentRequest, createDevelopmentRequestReader } from '@steer/data/development-requests';
import { originalFixture } from '../../../packages/data/test/development-original.fixture.ts';
import { createAssessedRecordedDevelopmentPreparer, createVerifiedScopeReviewReader, createVerifiedScopeReviewHistoryReader, createRecordedDevelopmentStarter, createVerifiedDevelopmentHistoryExchangeReader } from '../src/runtime.ts';
import { RECORDED_MASTRA_REVISION } from '@steer/agents/recorded-mastra';
import { createRecordedDevelopmentModel } from '../../worker/src/recorded-development-model.ts';
import { createDevelopmentStepRuntime } from '../../worker/src/development-step-runtime.ts';
import { createApi } from '../src/app.ts';

type Fixture = Awaited<ReturnType<typeof scopeStepIntegrationFixture>>;
type Dependencies = Parameters<typeof createAssessedRecordedDevelopmentPreparer>[3];
async function assessedApi(f: Fixture, evidence = f.described.original.evidence, patch: Partial<Dependencies> = {}, recorded = false) {
  const execution = { ...f.config, action: 'develop', expiresAt: f.execution.expiresAt, budget: f.execution.budget };
  const baseline = await originalFixture(execution, { draftId: f.draftId, revision: 1, sourceRevision: 1,
    revisionDigest: f.saved.reference.revisionDigest, content: f.content });
  const records: Dependencies['records'] = { authorize: async () => {}, authorizeOriginal: async () => {}, authorizeOperation: async () => {},
    authorizeDraft: f.deps.records.originals.authorizeDraft, keyForDraft: f.deps.records.originals.keyForDraft };
  const scope = { records: f.deps.records, profile: f.deps.profile };
  const profiles = recorded ? {architect:{...baseline.original.profiles.architect,runtimeRevision:RECORDED_MASTRA_REVISION},
    testAgent:{...baseline.original.profiles.testAgent,runtimeRevision:RECORDED_MASTRA_REVISION}} : baseline.original.profiles;
  const service = createAssessedRecordedDevelopmentPreparer(f.pools, execution, profiles, {
    records, scope, evidenceFor: async () => evidence, authorizePreparation: async () => {}, ...patch });
  const principal = { organizationId: f.config.organizationId, subject: f.config.subject, type: 'human', hats: [],
    toolGrants: ['intent.development.prepare'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const app = createApi({ authenticate: async () => principal, services: { intentDevelopmentPreparer: service } });
  const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository,
    configurationRevision: f.config.configurationRevision, draftId: f.draftId, revision: 1, revisionDigest: f.saved.reference.revisionDigest,
    scopeInputDigest: f.saved.reference.scopeInputDigest, sourceSnapshotDigest: (await buildIntentEvidenceEnvelope(evidence)).sourceSnapshotDigest,
    choice: baseline.original.direction.choice, draftingContextDigest: (await buildIntentDevelopmentContext(evidence)).contextDigest };
  const post = (scopeReview?: unknown, patch = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.development.prepare', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...patch, ...(scopeReview ? { scopeReview } : {}) }) }));
  return { service, post, records, scope, input, baseline, profiles };
}
const selection = (f: Fixture, review: Awaited<ReturnType<Fixture['read']>>) => ({ kind: 'recorded', ...f.target, resultsDigest: review.review!.resultsDigest });

export async function testAssessedDevelopment(setup: (count?: number, ttl?: number, large?: boolean) => Promise<Fixture>,
  check: (name: string, run: () => Promise<void>) => Promise<void>, admin: Pool) {
  await check('historical development composes full assessed multi-batch inputs with both actual SDK roles and retained output verification after human edits',async()=>{
    const f=await setup(34);assert.equal((await f.run(0)).outcome,'succeeded');assert.equal((await f.run(1)).outcome,'succeeded');
    const a=await assessedApi(f,f.described.original.evidence,{},true),review=await f.read();
    const current=createVerifiedScopeReviewReader(f.pools,f.config,a.scope),history=createVerifiedScopeReviewHistoryReader(f.pools,f.config,
      {...a.scope,records:{...a.scope.records,authorizeHistoricalRead:async()=>{},authorizeHistoricalReview:async()=>{}}});
    const records={originals:{...a.records,scopeReview:current},results:{authorizeOperation:a.records.authorizeOperation,
      authorizeDraft:a.records.authorizeDraft,keyForDraft:a.records.keyForDraft,authorizeResult:async()=>{}},authorize:async()=>{}};
    const profiles=Object.fromEntries(Object.entries(a.profiles).map(([role,p])=>[role,{profileRevision:p.configurationRevision,
      instructions:p.instructions,modelRoute:p.modelRoute,maxOutputTokens:p.maxOutputTokens,allowedResponseModels:['synthetic-provider-model']}])) as Parameters<typeof createRecordedDevelopmentModel>[3]['gateway']['profiles'];
    let calls=0;
    try {
      const prepared=await (await a.post(selection(f,review))).json();assert.equal(prepared.outcome,'prepared');
      for(const role of ['architect','test-agent'] as const){
        const model=createRecordedDevelopmentModel(f.pools,f.config,prepared.reference,{records,authorize:async()=>{},gateway:{
          gatewayUrl:'http://127.0.0.1:4000/v1',gatewayKey:'synthetic-unused',profiles,transport:async(_url,init)=>{
            calls++;const wire=JSON.parse(String(init?.body)),source=JSON.parse(wire.messages[1].content);assert.equal(source.scopeEvidence.evidence.length,34);
            assert.doesNotMatch(wire.messages[1].content,/EXAM-MARKER-NOT-FOR-SCOPE/);
            return Response.json({id:'synthetic-assessed-history',object:'chat.completion',model:'synthetic-provider-model',choices:[{index:0,
              message:{role:'assistant',content:JSON.stringify(role==='architect'?{message:'Drafted',questions:[],brief:'# Assessed Brief',spec:'# Assessed Spec'}:{exam:'# Assessed Exam\nNOT RUN'})},finish_reason:'stop'}],
              usage:{prompt_tokens:2,completion_tokens:1,total_tokens:3}});
          }}});
        const phases:Array<{phase:string;ms:number;ok:boolean}>=[];
        const traced={execute:async(...args:Parameters<typeof model.execute>)=>{const start=performance.now();let ok=false;try{const value=await model.execute(...args);ok=true;return value;}finally{phases.push({phase:'execute',ms:Math.round(performance.now()-start),ok});}},
          verify:async(...args:Parameters<typeof model.verify>)=>{const start=performance.now();let ok=false;try{await model.verify(...args);ok=true;}finally{phases.push({phase:'verify',ms:Math.round(performance.now()-start),ok});}}};
        const runtime=createDevelopmentStepRuntime(f.pools,f.config,prepared.reference,{reader:{originals:records.originals,results:records.results,authorizeRequest:async()=>{}},model:traced,authorize:async()=>{}});
        try {const start=performance.now(),outcome=await runtime.run(role,new AbortController().signal);
          const states=(await admin.query('SELECT step_id,record->>\'state\' AS state FROM steer_execution.intent_steps WHERE operation_id=$1',[prepared.reference.operationId])).rows;
          const observations=(await admin.query('SELECT stage FROM steer_drafts.development_observations WHERE operation_id=$1',[prepared.reference.operationId])).rows;
          assert.equal(outcome.outcome,'succeeded',JSON.stringify({role,calls,durationMs:Math.round(performance.now()-start),states,observations,phases}));
        }finally{runtime.close();model.close();}
      }
      await f.edit();const reservations=await f.reservations();
      const retained=createVerifiedDevelopmentHistoryExchangeReader(f.pools,f.config,{profiles,records:{...records,authorizeHistoricalRead:async()=>{},
        originals:{...records.originals,scopeHistory:history,authorizeHistoricalRead:async()=>{},authorizeOperation:async()=>{throw new Error('No execution');}},
        results:{...records.results,authorizeHistoricalResult:async()=>{},authorizeOperation:async()=>{throw new Error('No execution');}}}});
      try {for(const role of ['architect','test-agent'] as const){const result=await retained.read({...prepared.reference,stepId:role});assert.equal(result.historical,true);
        assert.equal(result.response.result.role,role);assert.ok(result.resultReference);const source=JSON.parse((result.request.rendered as any).request.source);
        assert.equal(source.scopeEvidence.evidence.length,34);assert.equal(source.direction.scopeReview.kind,'recorded');assert.equal(result.executionAuthorized,false);
      }}finally{retained.close();}
      assert.equal(calls,2);assert.equal(f.state.calls,2);assert.equal(reservations,4);assert.equal(await f.reservations(),reservations);
    }finally{current.close();history.close();a.service.close();}
  });
  await check('assessed generation input history restores exact multi-batch lineage after source edits and expiry without current execution or new records',async()=>{
    const f=await setup(34,15000);assert.equal((await f.run(0)).outcome,'succeeded');assert.equal((await f.run(1)).outcome,'succeeded');
    const a=await assessedApi(f),review=await f.read(),current=createVerifiedScopeReviewReader(f.pools,f.config,a.scope);
    const normal=createDevelopmentOriginalStore(f.pools,f.config,{...a.records,scopeReview:current});
    const history=createVerifiedScopeReviewHistoryReader(f.pools,f.config,{...a.scope,records:{...a.scope.records,
      authorizeHistoricalRead:async()=>{},authorizeHistoricalReview:async()=>{},originals:{...a.scope.records.originals,
        authorizeReview:async()=>{throw new Error('Old scope execution unavailable');}}}});
    let oldAccess=0;
    const records={...a.records,scopeHistory:history,authorizeHistoricalRead:async()=>{},
      authorize:async()=>{oldAccess++;throw new Error('Ordinary original access denied');},
      authorizeOperation:async()=>{oldAccess++;throw new Error('Old generation execution unavailable');},
      scopeReview:{scope:current.scope,read:async()=>{oldAccess++;throw new Error('Current scope reader must not be called');}}};
    const stored=async()=>({originals:(await admin.query('SELECT * FROM steer_drafts.development_originals WHERE organization_id=$1 ORDER BY operation_id',[f.config.organizationId])).rows,
      operations:(await admin.query('SELECT * FROM steer_execution.intent_operations WHERE organization_id=$1 ORDER BY operation_id',[f.config.organizationId])).rows,
      revisions:(await admin.query('SELECT * FROM steer_drafts.draft_revisions WHERE organization_id=$1 ORDER BY revision',[f.config.organizationId])).rows});
    try {
      const prepared=await (await a.post(selection(f,review))).json();assert.equal(prepared.outcome,'prepared');
      const captured=(await normal.read(prepared.reference)).original;await f.edit();await assert.rejects(normal.read(prepared.reference));
      const before=await stored();
      for(let attempt=0;attempt<2;attempt++){
        const reader=createDevelopmentOriginalStore(f.pools,f.config,records);
        try {const result=await reader.readHistorical(prepared.reference);assert.equal(result.historical,true);assert.equal(result.latestDraftRevision,2);
          assert.deepEqual(result.original,captured);assert.equal(result.original.evidence.documents.length,34);assert.equal(result.executionAuthorized,false);assert.equal(result.retryAuthorized,false);
        } finally {reader.close();}
      }
      await delay(Math.max(0,Date.parse(f.execution.expiresAt)-Date.now()+50));
      const reader=createDevelopmentOriginalStore(f.pools,f.config,records);
      try {const result=await reader.readHistorical(prepared.reference);assert.equal(result.operationExpired,true);assert.deepEqual(result.original,captured);
        assert.equal((await reader.put({...prepared.reference,original:result.original})).outcome,'unavailable');
      } finally {reader.close();}
      assert.equal(oldAccess,1); // Only the deliberately attempted ordinary put.
      assert.deepEqual(await stored(),before);assert.equal(f.state.calls,2);assert.equal(await f.reservations(),2);
    } finally {normal.close();current.close();history.close();a.service.close();}
  });
  await check('assessed generation history rejects missing or revoked history, substituted evidence, original key loss and holds without reviving current reads',async()=>{
    const f=await setup();assert.equal((await f.run()).outcome,'succeeded');const review=await f.read(),a=await assessedApi(f);
    const history=createVerifiedScopeReviewHistoryReader(f.pools,f.config,{...a.scope,records:{...a.scope.records,
      authorizeHistoricalRead:async()=>{},authorizeHistoricalReview:async()=>{}}});
    const records={...a.records,authorizeHistoricalRead:async()=>{},scopeHistory:history};
    const readers:Array<{close():void}>=[];
    const make=(patch:Partial<Parameters<typeof createDevelopmentOriginalStore>[2]>={})=>{const r=createDevelopmentOriginalStore(f.pools,f.config,{...records,...patch});readers.push(r);return r;};
    try {
      const prepared=await (await a.post(selection(f,review))).json();assert.equal(prepared.outcome,'prepared');await f.edit();
      assert.equal((await make().readHistorical(prepared.reference)).latestDraftRevision,2);
      for(const field of ['authorizeHistoricalRead','scopeHistory'] as const){
        const incomplete:Parameters<typeof createDevelopmentOriginalStore>[2]={...records};delete incomplete[field];
        const reader=createDevelopmentOriginalStore(f.pools,f.config,incomplete);readers.push(reader);
        await assert.rejects(reader.readHistorical(prepared.reference),{message:'Draft storage is unavailable.'});
      }
      for(const patch of [{authorizeHistoricalRead:async()=>true as any},{authorizeOriginal:async()=>{throw new Error('Retained source denied');}},
        {scopeHistory:{...history,read:async()=>({...await history.read({organizationId:f.config.organizationId,productId:f.config.productId,repository:f.config.repository,...f.target},async()=>{}) as object,sourceSnapshotDigest:'f'.repeat(64)})}},
        {keyForDraft:async()=>{throw new Error('Historical key revoked');}}])await assert.rejects(make(patch).readHistorical(prepared.reference),{message:'Draft storage is unavailable.'});
      let allowed=true;await assert.rejects(make({authorizeHistoricalRead:async()=>{if(!allowed)throw new Error('History revoked');},
        keyForDraft:async(...args)=>{const key=await a.records.keyForDraft(...args);allowed=false;return key;}}).readHistorical(prepared.reference));
      assert.equal((await f.lifecycle.hold({draftId:f.draftId,holdReference:randomUUID()})).outcome,'ok');await assert.rejects(make().readHistorical(prepared.reference));
      assert.equal(f.state.calls,1);assert.equal(await f.reservations(),1);
    } finally {readers.forEach(r=>r.close());history.close();a.service.close();}
  });
  await check('assessed HTTP preparation binds actual recorded SDK/SQL findings, retries one immutable input and renders both fresh roles without prior Exam', async () => {
    const f = await setup(); assert.equal((await f.run()).outcome, 'succeeded'); const review = await f.read(), selected = selection(f, review), a = await assessedApi(f);
    const reader = createVerifiedScopeReviewReader(f.pools, f.config, a.scope);
    const originals = createDevelopmentOriginalStore(f.pools, f.config, { ...a.records, scopeReview: reader });
    try {
      const response = await a.post(selected); assert.equal(response.status, 200); const prepared = await response.json();
      assert.equal(prepared.outcome, 'prepared'); assert.ok(prepared.reference);
      const again = await (await a.post(selected)).json(); assert.deepEqual(again, prepared);
      const original = (await originals.read(prepared.reference)).original;
      assert.deepEqual(original.direction.scopeReview, { kind: 'recorded', ...f.target, results: review.review });
      assert.deepEqual(original.source.content, f.content); assert.deepEqual(original.direction.choice, a.input.choice);
      const { scopeReview: _review, draftingContextDigest: _context, ...legacyDirection } = original.direction;
      assert.notEqual((await describeDevelopmentOriginal({ ...original, direction: legacyDirection })).inputDigest, prepared.reference.inputDigest);
      const architect = await renderDevelopmentRequest({ original, operationId: prepared.reference.operationId, role: 'architect', predecessor: null });
      const context = JSON.parse(architect.rendered.request.source); assert.deepEqual(context.direction, original.direction);
      const { draftingContextDigest: _digest, ...priorDirection } = original.direction;
      const priorPacket = await renderDevelopmentRequest({ original: { ...original, direction: priorDirection }, operationId: prepared.reference.operationId, role: 'architect', predecessor: null });
      assert.equal(JSON.parse(priorPacket.rendered.request.source).scopeEvidence.kind, 'steer-intent-evidence/v1');
      const predecessor = { checkpoint: { binding: { organizationId: f.config.organizationId, subject: f.config.subject,
        operationId: prepared.reference.operationId, stepId: 'architect', draftId: f.draftId, draftRevision: 1,
        inputDigest: architect.stepReference.stepInputDigest, configurationRevision: f.config.configurationRevision },
        resultRef: randomUUID(), resultDigest: 'd'.repeat(64), recordsPolicyDigest: f.config.recordsPolicyDigest },
        result: { role: 'architect', output: { message: 'ARCHITECT-PRIVATE-MESSAGE', questions: [], brief: '# Synthetic Brief', spec: '# Synthetic Spec' } } };
      const examiner = await renderDevelopmentRequest({ original, operationId: prepared.reference.operationId, role: 'test-agent', predecessor });
      assert.deepEqual(JSON.parse(examiner.rendered.request.source).direction, original.direction);
      assert.doesNotMatch(architect.rendered.request.source + examiner.rendered.request.source, /EXAM-MARKER-NOT-FOR-SCOPE|ARCHITECT-PRIVATE-MESSAGE/);
      assert.equal(f.state.calls, 1); assert.equal(await f.reservations(), 1);
      assert.equal(Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.development_originals WHERE organization_id=$1', [f.config.organizationId])).rows[0].n), 1);
      const noReader = createDevelopmentOriginalStore(f.pools, f.config, a.records);
      try { await assert.rejects(noReader.read(prepared.reference)); } finally { noReader.close(); }
      await f.edit(); await assert.rejects(originals.read(prepared.reference));
    } finally { originals.close(); reader.close(); a.service.close(); }
  });
  await check('assessed admission rejects omitted references, caller findings, pending review and substituted results before creating development records', async () => {
    const f = await setup(), a = await assessedApi(f);
    try {
      assert.notEqual((await a.post()).status, 200);
      const selected = { kind: 'recorded', ...f.target, resultsDigest: 'd'.repeat(64) };
      assert.notEqual((await a.post({ ...selected, findings: [] })).status, 200);
      assert.equal((await (await a.post(selected)).json()).outcome, 'unavailable');
      assert.equal((await f.run()).outcome, 'succeeded');
      assert.equal((await (await a.post(selected)).json()).outcome, 'unavailable');
      assert.equal(Number((await admin.query('SELECT count(*) AS n FROM steer_execution.intent_operations WHERE organization_id=$1', [f.config.organizationId])).rows[0].n), 0);
    } finally { a.service.close(); }
  });
  await check('assessed preparation and restored input require current pinned profile and scope source permissions', async () => {
    const f = await setup(); assert.equal((await f.run()).outcome, 'succeeded'); const selected = selection(f, await f.read());
    let allowed = true;
    const scope = { profile: f.deps.profile, records: { ...f.deps.records, authorize: async () => { if (!allowed) throw new Error('Private revocation'); } } };
    const a = await assessedApi(f, f.described.original.evidence, { scope });
    const reader = createVerifiedScopeReviewReader(f.pools, f.config, scope), originals = createDevelopmentOriginalStore(f.pools, f.config, { ...a.records, scopeReview: reader });
    try {
      const prepared = await (await a.post(selected)).json(); assert.equal(prepared.outcome, 'prepared');
      allowed = false; await assert.rejects(originals.read(prepared.reference));
      assert.equal((await (await a.post(selected)).json()).outcome, 'unavailable');
      allowed = true;
      const wrong = await assessedApi(f, f.described.original.evidence, { scope: { ...scope, profile: { ...f.described.original.profile, modelRoute: 'different' } } });
      try { assert.equal((await (await wrong.post(selected)).json()).outcome, 'unavailable'); } finally { wrong.service.close(); }
      assert.equal(f.state.calls, 1); assert.equal(await f.reservations(), 1);
    } finally { originals.close(); reader.close(); a.service.close(); }
  });
  await check('explicit complete empty corpus prepares without a scope model call but incomplete inventory remains blocked', async () => {
    const f = await setup(), evidence = { ...f.described.original.evidence, inventory: [], documents: [] }, a = await assessedApi(f, evidence);
    const selected = { kind: 'empty-corpus', planDigest: (await planIntentScopeBatches(evidence)).summary.planDigest };
    try { const prepared = await (await a.post(selected)).json(); assert.equal(prepared.outcome, 'prepared');
      const originals = createDevelopmentOriginalStore(f.pools, f.config, a.records);
      try { assert.deepEqual((await originals.read(prepared.reference)).original.direction.scopeReview, selected); } finally { originals.close(); }
      const history = createDevelopmentOriginalStore(f.pools, f.config, { ...a.records, authorizeHistoricalRead: async () => {},
        authorize: async () => { throw new Error('No ordinary input permission'); } });
      try { const retained = await history.readHistorical(prepared.reference); assert.equal(retained.historical, true);
        assert.deepEqual(retained.original.direction.scopeReview, selected);
      } finally { history.close(); }
      assert.equal(f.state.calls, 0); assert.equal(await f.reservations(), 0);
    } finally { a.service.close(); }
    const incomplete = await assessedApi(f, { ...evidence, inventoryComplete: false });
    try { assert.equal((await (await incomplete.post(selected)).json()).outcome, 'scope-incomplete'); } finally { incomplete.service.close(); }
  });
  await check('assessed full-source drafting spans two batches without the legacy 32-document truncation and preserves every exact source in the role input', async () => {
    const f = await setup(34); assert.equal((await f.run(0)).outcome, 'succeeded'); assert.equal((await f.run(1)).outcome, 'succeeded');
    const review = await f.read(); assert.equal(review.status, 'review-available'); const a = await assessedApi(f);
    try { const result = await (await a.post(selection(f, review))).json(); assert.equal(result.outcome, 'prepared'); assert.equal(result.coverage.includedCount, 34);
      const reader = createVerifiedScopeReviewReader(f.pools, f.config, a.scope), originals = createDevelopmentOriginalStore(f.pools, f.config, { ...a.records, scopeReview: reader });
      try { const original = (await originals.read(result.reference)).original;
        assert.equal(original.direction.draftingContextDigest, a.input.draftingContextDigest);
        const rendered = await renderDevelopmentRequest({ original, operationId: result.reference.operationId, role: 'architect', predecessor: null });
        const context = JSON.parse(rendered.rendered.request.source).scopeEvidence;
        assert.equal(context.kind, 'steer-development-context/v1'); assert.equal(context.coverage.complete, true); assert.equal(context.evidence.length, 34);
        for (const doc of f.described.original.evidence.documents) assert.equal(context.evidence.find((s: any) => s.sourceId === doc.sourceId).content, doc.content);
      } finally { originals.close(); reader.close(); }
      assert.equal(f.state.calls, 2); assert.equal(await f.reservations(), 2);
    } finally { a.service.close(); }
  });
  await check('assessed start and worker request reconstruction revalidate scope evidence; missing reader or later revocation cannot schedule or release context', async () => {
    const f = await setup(); assert.equal((await f.run()).outcome, 'succeeded'); const selected = selection(f, await f.read()), a = await assessedApi(f);
    let allowed = true, schedules = 0;
    const scope = createVerifiedScopeReviewReader(f.pools, f.config, { ...a.scope, records: { ...a.scope.records,
      authorize: async () => { if (!allowed) throw new Error('Private source revocation'); } } });
    const records = { ...a.records, scopeReview: scope }, scheduler = { start: async (_target: unknown, current: () => Promise<void>) => {
      await current(); schedules++; return { outcome: 'unknown' }; } };
    const starter = createRecordedDevelopmentStarter(f.pools, f.config, { records, scheduler, authorizeStart: async () => {} });
    const missing = createRecordedDevelopmentStarter(f.pools, f.config, { records: a.records, scheduler, authorizeStart: async () => {} });
    const requests = createDevelopmentRequestReader(f.pools, f.config, { originals: records,
      results: { ...a.records, authorizeResult: async () => {} }, authorizeRequest: async () => {} });
    try {
      const prepared = await (await a.post(selected)).json(); assert.equal(prepared.outcome, 'prepared');
      const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository,
        ...prepared.reference, draftId: f.draftId, revision: 1, revisionDigest: f.saved.reference.revisionDigest };
      await assert.rejects(missing.start(input, async () => {})); assert.equal(schedules, 0);
      assert.equal((await starter.start(input, async () => {})).receipt.outcome, 'unknown'); assert.equal(schedules, 1);
      const request = await requests.read({ ...prepared.reference, role: 'architect' });
      assert.equal(JSON.parse(request.rendered.request.source).direction.scopeReview.results.resultsDigest, selected.resultsDigest);
      allowed = false; await assert.rejects(requests.read({ ...prepared.reference, role: 'architect' }));
      await assert.rejects(starter.start(input, async () => {})); assert.equal(schedules, 1); assert.equal(await f.reservations(), 1);
    } finally { requests.close(); missing.close(); starter.close(); scope.close(); a.service.close(); }
  });
  await check('assessed full-context omission or substituted digest cannot prepare or admit any development identity', async () => {
    const f = await setup(); assert.equal((await f.run()).outcome, 'succeeded'); const selected = selection(f, await f.read()), a = await assessedApi(f);
    try {
      assert.notEqual((await a.post(selected, { draftingContextDigest: undefined })).status, 200);
      assert.equal((await (await a.post(selected, { draftingContextDigest: 'f'.repeat(64) })).json()).outcome, 'conflict');
      assert.equal(Number((await admin.query('SELECT count(*) AS n FROM steer_execution.intent_operations WHERE organization_id=$1', [f.config.organizationId])).rows[0].n), 0);
    } finally { a.service.close(); }
  });
  await check('complete recorded scope across a large corpus cannot bypass the unchanged aggregate drafting-byte limit', async () => {
    const f = await setup(8, 3600000, true); assert.equal(f.prepared.batches.length, 2);
    assert.equal((await f.run(0)).outcome, 'succeeded'); assert.equal((await f.run(1)).outcome, 'succeeded');
    const review = await f.read(); assert.equal(review.status, 'review-available'); const a = await assessedApi(f);
    try {
      const result = await (await a.post(selection(f, review))).json(); assert.equal(result.outcome, 'scope-incomplete');
      assert.equal(result.coverage.complete, false); assert.ok(result.coverage.gapCount > 0); assert.equal(result.reference, null);
      assert.equal(f.state.calls, 2); assert.equal(await f.reservations(), 2);
    } finally { a.service.close(); }
  });
}
