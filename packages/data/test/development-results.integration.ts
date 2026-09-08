import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool, PoolClient } from 'pg';
import { createDevelopmentResultStore } from '../src/development-results.ts';
import { createDraftLifecycleStore } from '../src/draft-lifecycle.ts';
import { createDraftRevisionStore } from '../src/draft-revisions.ts';
import { createIntentOperationStore, createExpiredDevelopmentStepReader, type IntentCheckpointReference } from '../src/intent-operations.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';
type Dependencies = Parameters<typeof createDevelopmentResultStore>[2];
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stored = (v: Awaited<ReturnType<ReturnType<typeof createDevelopmentResultStore>['put']>>) => {
  assert.equal(v.outcome, 'stored'); if (v.outcome !== 'stored') throw new Error('Synthetic result unavailable'); return v.checkpoint;
};
export async function testDevelopmentResults({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  const setup = async (dispatch = true, operationTtl = 3600000) => {
    const draftConfig = { organizationId: `results-${randomUUID()}`, subject: 'synthetic-human', productId: 'product', repository: 'github:52',
      branch: 'codex/synthetic', configurationRevision: 'results-r1', recordsPolicyDigest: 'a'.repeat(64) };
    const budget = { organizationId: draftConfig.organizationId, subject: draftConfig.subject, configurationRevision: draftConfig.configurationRevision,
      budgetId: randomUUID(), approvalDigest: 'b'.repeat(64), capMicrousd: 30, architectMicrousd: 3, testAgentMicrousd: 2 };
    await admin.query(`INSERT INTO steer_usage.model_budgets VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()-interval '1 minute',now()+interval '1 hour',true)`,
      [budget.organizationId,budget.budgetId,budget.subject,budget.configurationRevision,budget.approvalDigest,30,3,2]);
    const config = { ...draftConfig, action: 'develop', expiresAt: new Date(Date.now()+operationTtl).toISOString(), budget };
    const pools = { execution: connect('steer_app'), drafts: connect('steer_draft_runtime') };
    const key = { keyId: `synthetic-${randomUUID()}`, bytes: randomBytes(32) }, state = { denied: false, keys: 0 };
    const dependencies: Dependencies = { authorizeOperation: async () => { if (state.denied) throw new Error('private-authority-marker'); },
      authorizeDraft: async () => { if (state.denied) throw new Error('private-draft-marker'); },
      authorizeResult: async ctx => { assert.deepEqual(Object.keys(ctx.target), ['operationId','stepId']); if (state.denied) throw new Error('private-result-marker'); },
      keyForDraft: async (_ref, keyId) => { state.keys++; assert.ok(keyId === null || keyId === key.keyId); return key; } };
    const lifecycle = createDraftLifecycleStore(pools.drafts, draftConfig, { authorize: async () => {}, verifyHold: async () => {} });
    const created = await lifecycle.create({ requestId: randomUUID() }); assert.equal(created.outcome, 'ok');
    if (created.outcome !== 'ok') throw new Error('Synthetic lifecycle unavailable'); const draftId = created.value.draftId;
    const drafts = createDraftRevisionStore(pools.drafts, draftConfig, { authorize: dependencies.authorizeDraft, keyForDraft: dependencies.keyForDraft });
    const source = { originalText: '  Synthetic original 🌸\r\n', clarificationTurns: ['Exact reply'], documents: null };
    const saved = await drafts.append({ draftId, mutationId: randomUUID(), expectedRevision: 0, expectedDigest: null, content: source });
    assert.equal(saved.outcome, 'acknowledged'); if (saved.outcome !== 'acknowledged') throw new Error('Synthetic draft unavailable');
    const make = (overrides: Partial<Dependencies> = {}, otherPools: Parameters<typeof createDevelopmentResultStore>[0] = pools, patch = {}) => createDevelopmentResultStore(otherPools, { ...config, ...patch }, { ...dependencies, ...overrides });
    const operations = (execution: DatabasePool = pools.execution) => createIntentOperationStore(execution, config, {
      authorize: dependencies.authorizeOperation, verifyCheckpoint: async ref => { const reader = make(); try { await reader.verifyCheckpoint(ref); } finally { reader.close(); } },
    });
    const op = await operations().create({ draftId, draftRevision: 1, inputDigest: hash(['synthetic-input',saved.reference]) });
    assert.equal(op.outcome, 'ok'); if (op.outcome !== 'ok') throw new Error('Synthetic operation unavailable');
    const target = { operationId: op.value.operationId, inputDigest: op.value.inputDigest, stepId: 'architect' };
    const claim = { ...target, stepInputDigest: hash(['synthetic-architect',source]), predecessorResultDigest: null as string | null, owner: 'synthetic-worker', leaseMs: 300000 };
    const { owner: _owner, leaseMs: _lease, ...step } = claim;
    assert.equal((await operations().claim(claim)).outcome, 'ok');
    const dispatchCommand = { ...step, event: { type: 'commit-dispatch', owner: claim.owner, fencingToken: 1 } };
    if (dispatch) assert.equal((await operations().transition(dispatchCommand)).dispatchAllowed, true);
    const result = { role: 'architect' as const, output: { message: ' Synthetic ready 🌸 ', questions: [], brief: ' # Synthetic Brief\r\n', spec: '# Synthetic Spec\n ' } };
    const input = { ...target, owner: claim.owner, fencingToken: 1, result };
    const checkpointCommand = (ref: IntentCheckpointReference) => ({ ...step,
      event: { type: 'checkpoint', owner: claim.owner, fencingToken: 1, resultRef: ref.resultRef, resultDigest: ref.resultDigest } });
    const count = async () => Number((await admin.query('SELECT count(*) AS n FROM steer_drafts.development_results WHERE operation_id=$1', [target.operationId])).rows[0].n);
    const used = async () => Number((await admin.query('SELECT sum(amount_microusd) AS used FROM steer_usage.model_reservations WHERE budget_id=$1', [budget.budgetId])).rows[0].used);
    return { config,draftConfig,pools,key,state,dependencies,lifecycle,drafts,draftId,source,saved,make,operations,target,claim,step,input,
      dispatchCommand,checkpointCommand,count,used };
  };
  await check('encrypted role originals survive reconstruction and actual checkpoint readback advances Test Agent without another Architect reservation', async () => {
    const f = await setup(), writer = f.make(), ref = stored(await writer.put(f.input)); writer.close();
    const reader = f.make({}, { execution: connect('steer_app'), drafts: connect('steer_draft_runtime') });
    assert.deepEqual((await reader.read(f.target)).result, f.input.result); await reader.verifyCheckpoint(ref);
    assert.equal((await f.operations().transition(f.checkpointCommand(ref))).outcome, 'ok');
    const next = { ...f.claim, stepId: 'test-agent', stepInputDigest: hash(['synthetic-exam',ref]), predecessorResultDigest: ref.resultDigest };
    assert.equal((await f.operations().claim(next)).outcome, 'ok');
    const { owner: _owner, leaseMs: _lease, ...step } = next;
    assert.equal((await f.operations().transition({ ...step, event: { type: 'commit-dispatch', owner: next.owner, fencingToken: 1 } })).dispatchAllowed, true);
    const exam = { role: 'test-agent', output: { exam: '# Synthetic Exam\nNOT RUN\n' } };
    const examRef = stored(await f.make().put({ ...f.input, stepId: 'test-agent', result: exam }));
    assert.notEqual(examRef.resultRef, ref.resultRef);
    assert.equal((await f.operations().transition({ ...step, event: { type: 'checkpoint', owner: next.owner, fencingToken: 1,
      resultRef: examRef.resultRef, resultDigest: examRef.resultDigest } })).outcome, 'ok');
    assert.deepEqual((await f.make().read({ ...f.target, stepId: 'test-agent' })).result, exam);
    assert.equal(await f.used(), 5); assert.equal(await f.count(), 2);
    assert.equal((await f.operations().transition(f.dispatchCommand)).dispatchAllowed, false); reader.close();
  });
  await check('duplicate role results converge once while changed output, wrong fence or mismatched checkpoint cannot replace originals', async () => {
    const f = await setup();
    const outcomes = await Promise.all(Array.from({ length: 4 }, () => f.make({}, { execution: connect('steer_app'), drafts: connect('steer_draft_runtime') }).put(f.input)));
    const refs = outcomes.map(stored); assert.equal(new Set(refs.map(ref => ref.resultRef)).size, 1); assert.equal(await f.count(), 1);
    assert.equal((await f.make().put({ ...f.input, result: { ...f.input.result, output: { ...f.input.result.output, brief: '# Changed' } } })).outcome, 'conflict');
    assert.equal((await f.make().put({ ...f.input, fencingToken: 2 })).outcome, 'conflict');
    await assert.rejects(f.make().verifyCheckpoint({ ...refs[0]!, resultRef: randomUUID() }));
    assert.deepEqual((await f.make().read(f.target)).result, f.input.result); assert.equal(await f.used(), 3);
  });
  await check('undispatched, unknown and known-failed steps cannot publish or restore role result bytes', async () => {
    const f = await setup(false), keys = f.state.keys;
    assert.equal((await f.make().put(f.input)).outcome, 'unavailable'); assert.equal(f.state.keys, keys); assert.equal(await f.count(), 0);
    for (const kind of ['outcome-unknown','known-failure']) {
      const g = await setup(); const ref = stored(await g.make().put(g.input));
      const event = kind === 'outcome-unknown' ? { type: kind, fencingToken: 1 } : { type: kind, fencingToken: 1, owner: g.claim.owner };
      assert.equal((await g.operations().transition({ ...g.step, event })).outcome, 'ok'); const keys = g.state.keys;
      await assert.rejects(g.make().read(g.target)); await assert.rejects(g.make().verifyCheckpoint(ref));
      assert.equal((await g.make().put(g.input)).outcome, 'unavailable'); assert.equal(g.state.keys, keys); assert.equal(await g.count(), 1);
    }
  });
  await check('lost role-result COMMIT acknowledgement recovers the same bytes and reference without an extra dispatch or charge', async () => {
    const f = await setup(); let lose = true;
    const uncertain: DatabasePool = { async connect() { const c = await f.pools.drafts.connect(); let inserted = false; return {
      query: async (sql: string, values?: unknown[]) => { const result = await c.query(sql, values);
        if (sql.startsWith('INSERT INTO steer_drafts.development_results')) inserted = true;
        if (sql === 'COMMIT' && inserted && lose) { lose = false; throw new Error('private-lost-result-ack'); } return result; },
      release: (broken: boolean) => c.release(broken),
    } as PoolClient; } };
    assert.equal((await f.make({}, { ...f.pools, drafts: uncertain }).put(f.input)).outcome, 'unknown'); assert.equal(await f.count(), 1);
    const ref = stored(await f.make().put(f.input)); assert.deepEqual((await f.make().read(f.target)).checkpoint, ref);
    assert.equal((await f.operations().transition(f.checkpointCommand(ref))).outcome, 'ok');
    assert.equal((await f.operations().transition(f.dispatchCommand)).dispatchAllowed, false); assert.equal(await f.used(), 3);
  });
  await check('current holds and authority loss deny role originals without deleting them or silently continuing a step', async () => {
    const f = await setup(), ref = stored(await f.make().put(f.input));
    assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok'); const keys = f.state.keys;
    await assert.rejects(f.make().read(f.target)); await assert.rejects(f.make().verifyCheckpoint(ref)); assert.equal(f.state.keys, keys);
    assert.equal(await f.count(), 1);
    const g = await setup(); stored(await g.make().put(g.input));
    await assert.rejects(g.make({ keyForDraft: async () => { g.state.denied = true; return g.key; } }).read(g.target));
    assert.equal(await g.count(), 1);
  });
  await check('older generated originals remain distinct from newer editable drafts and cannot restore gate or execution authority', async () => {
    const f = await setup(), ref = stored(await f.make().put(f.input));
    assert.equal((await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1,
      expectedDigest: f.saved.reference.revisionDigest, content: { ...f.source, originalText: 'A different human correction' } })).outcome, 'acknowledged');
    const original = await f.make().read(f.target); assert.deepEqual(original.result, f.input.result);
    assert.equal(original.sourceDraftRevision, 1); assert.equal(original.latestDraftRevision, 2);
    assert.equal(original.gateSigned, false); assert.equal(original.executionAuthorized, false);
    assert.deepEqual(original.checkpoint, ref); assert.equal((await f.drafts.read({ draftId: f.draftId, revision: 'latest' })).content.originalText, 'A different human correction');
  });
  await check('role result SQL is ciphertext-only, owner-isolated, immutable and rejects foreign runtime roles', async () => {
    const f = await setup(), captured: string[] = []; let inTransaction = false;
    const observed: DatabasePool = { async connect() { const c = await f.pools.drafts.connect(); return {
      query: async (sql: string, values?: unknown[]) => { captured.push(JSON.stringify([sql,values])); const r = await c.query(sql,values);
        if (sql.startsWith('BEGIN')) inTransaction = true; if (sql === 'COMMIT' || sql === 'ROLLBACK') inTransaction = false; return r; },
      release: (broken: boolean) => c.release(broken),
    } as PoolClient; } };
    stored(await f.make({ keyForDraft: async (ref,keyId) => { assert.equal(inTransaction,false); return f.dependencies.keyForDraft(ref,keyId); },
      authorizeResult: async ctx => { assert.equal(inTransaction,false); await f.dependencies.authorizeResult(ctx); } }, { ...f.pools, drafts: observed }).put(f.input));
    const rows = (await admin.query('SELECT * FROM steer_drafts.development_results WHERE operation_id=$1', [f.target.operationId])).rows;
    for (const text of [...captured,JSON.stringify(rows)]) for (const marker of ['Synthetic Brief','Synthetic Spec','Synthetic ready',f.key.bytes.toString('base64url')]) assert.equal(text.includes(marker),false);
    const table = (await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='steer_drafts.development_results'::regclass")).rows[0];
    assert.deepEqual(table,{ relrowsecurity:true,relforcerowsecurity:true });
    assert.equal((await f.pools.drafts.query('SELECT * FROM steer_drafts.development_results')).rowCount,0);
    for (const sql of ['DELETE FROM steer_drafts.development_results','TRUNCATE steer_drafts.development_results',"UPDATE steer_drafts.development_results SET record='{}'"])
      await assert.rejects(f.pools.drafts.query(sql),{ code:'42501' });
    const keys = f.state.keys;
    for (const role of ['steer_app','steer_auth_runtime','steer_projector'])
      await assert.rejects(f.make({}, { ...f.pools,drafts:connect(role) }).read(f.target));
    await assert.rejects(f.make({}, { ...f.pools,drafts:admin }).read(f.target));
    await assert.rejects(f.make({}, f.pools, { recordsPolicyDigest:'f'.repeat(64) }).read(f.target));
    assert.equal(f.state.keys,keys);
  });
  await check('corrupt result ciphertext and substituted historical keys cannot satisfy the actual execution checkpoint verifier', async () => {
    const f = await setup(), ref = stored(await f.make().put(f.input));
    await assert.rejects(f.make({ keyForDraft: async () => ({ ...f.key,bytes:randomBytes(32) }) }).read(f.target));
    // Owned administrator simulates corruption only in this disposable database.
    await admin.query(`UPDATE steer_drafts.development_results SET encrypted_value=jsonb_set(encrypted_value,'{tag}',to_jsonb($2::text)) WHERE operation_id=$1`,
      [f.target.operationId,Buffer.alloc(16).toString('base64url')]);
    await assert.rejects(f.make().verifyCheckpoint(ref)); assert.notEqual((await f.operations().transition(f.checkpointCommand(ref))).outcome,'ok');
    const observed = await f.operations().inspect({ operationId:f.target.operationId,inputDigest:f.target.inputDigest }); assert.equal(observed.outcome,'ok');
    if (observed.outcome==='ok') assert.equal(observed.value.steps[0]?.record.state,'dispatch-committed');
    assert.equal(await f.used(),3);
  });
  await check('result restoration snapshots provider-owned historical key buffers and late close cannot release captured output', async () => {
    const f = await setup(); stored(await f.make().put(f.input)); let reads = 0;
    try {
      await assert.rejects(f.make({ keyForDraft: async () => { if (++reads === 4) f.key.bytes[0]! ^= 1; return f.key; } }).read(f.target));
      assert.equal(reads,4);
    } finally { if (reads >= 4) f.key.bytes[0]! ^= 1; }
    assert.deepEqual((await f.make().read(f.target)).result,f.input.result);
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release=resolve; }), reached = new Promise<void>(resolve => { entered=resolve; });
    const store = f.make({ keyForDraft: async () => { entered(); await held; return f.key; } });
    const pending = store.read(f.target); await reached; store.close(); release(); await assert.rejects(pending);
    assert.equal(await f.count(),1);
  });
  await check('role capture rejects extra authority, source substitution and SQL plaintext metadata before a checkpoint can be acknowledged', async () => {
    const f = await setup(), ref = stored(await f.make().put(f.input));
    assert.equal((await f.make().put({ ...f.input, approved:true })).outcome,'unavailable');
    assert.equal((await f.make().put({ ...f.input, result:{ role:'architect',output:{ ...f.input.result.output,questions:['Unanswered?'] } } })).outcome,'unavailable');
    await assert.rejects(f.make().verifyCheckpoint({ ...ref,binding:{ ...ref.binding,draftRevision:2 } }));
    const row = (await admin.query('SELECT * FROM steer_drafts.development_results WHERE operation_id=$1',[f.target.operationId])).rows[0];
    const client = await f.pools.drafts.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)",
        [f.config.organizationId,f.config.subject,f.config.productId]);
      await assert.rejects(client.query(`INSERT INTO steer_drafts.development_results
        (organization_id,subject,product_id,operation_id,step_id,result_ref,draft_id,draft_revision,result_digest,record,encrypted_value)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`,[row.organization_id,row.subject,row.product_id,row.operation_id,row.step_id,
        row.result_ref,row.draft_id,row.draft_revision,row.result_digest,JSON.stringify({ ...row.record,sourceText:'plaintext-marker' }),JSON.stringify(row.encrypted_value)]),{ code:'23514' });
      await client.query('ROLLBACK');
    } finally { await client.query('ROLLBACK'); client.release(); }
    assert.equal(await f.count(),1); await f.make().verifyCheckpoint(ref);
  });
  await check('explicit historical result access after real operation expiry preserves originals without reactivating execution or budget authority', async () => {
    const f = await setup(true,5000), ref = stored(await f.make().put(f.input));
    assert.equal((await f.operations().transition(f.checkpointCommand(ref))).outcome,'ok');
    let historyReads=0;
    const historical = f.make({ authorizeHistoricalResult:async ctx => { historyReads++; assert.equal(ctx.action,'read'); } });
    await assert.rejects(historical.readHistorical(f.target)); // Not an alternative active-job route.
    await delay(Math.max(0,Date.parse(f.config.expiresAt)-Date.now()+25));
    const before = (await admin.query('SELECT * FROM steer_execution.intent_steps WHERE operation_id=$1',[f.target.operationId])).rows;
    await admin.query('UPDATE steer_usage.model_budgets SET active=false WHERE budget_id=$1',[f.config.budget.budgetId]);
    await assert.rejects(f.make().readHistorical(f.target)); // Capability omitted by default.
    await assert.rejects(historical.read(f.target)); await assert.rejects(historical.verifyCheckpoint(ref));
    assert.equal((await historical.put(f.input)).outcome,'unavailable');
    assert.equal((await f.operations().transition(f.dispatchCommand)).dispatchAllowed,false);
    assert.notEqual((await f.operations().transition(f.checkpointCommand(ref))).outcome,'ok');
    const original = await historical.readHistorical(f.target);
    assert.deepEqual(original.result,f.input.result); assert.equal(original.historical,true);
    assert.equal('checkpoint' in original,false); assert.equal(original.executionAuthorized,false); assert.equal(original.retryAuthorized,false);
    assert.deepEqual((await admin.query('SELECT * FROM steer_execution.intent_steps WHERE operation_id=$1',[f.target.operationId])).rows,before);
    assert.equal(await f.used(),3); assert.ok(historyReads>0); historical.close();
  });
  await check('expired-step metadata uses read-only SQL, exact original binding and current history authorization outside the pool lease', async () => {
    const f = await setup(true,4000); stored(await f.make().put(f.input));
    await delay(Math.max(0,Date.parse(f.config.expiresAt)-Date.now()+25));
    const sql: string[] = []; let leases=0,checks=0;
    const observed: DatabasePool = { async connect() { const c = await f.pools.execution.connect(); leases++; return {
      query:async (query:string,values?:unknown[]) => { sql.push(query); return c.query(query,values); },
      release:(broken:boolean) => { leases--; c.release(broken); },
    } as PoolClient; } };
    const authorize = async () => { checks++; assert.equal(leases,0); assert.equal((await f.pools.execution.query('SELECT * FROM steer_execution.intent_steps')).rowCount,0); };
    const reader = createExpiredDevelopmentStepReader(observed,f.config,{ authorize });
    const result = await reader.inspectExpired(f.target); assert.equal(result.dispatchAllowed,false); assert.equal(checks,2);
    assert.ok(sql.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
    assert.ok(sql.every(query => !/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|pg_advisory_xact_lock)\b/i.test(query)));
    assert.equal('claim' in reader,false); assert.equal('transition' in reader,false);
    await assert.rejects(reader.inspectExpired({ ...f.target,inputDigest:'f'.repeat(64) }));
    await assert.rejects(createExpiredDevelopmentStepReader(f.pools.execution,{ ...f.config,productId:'foreign' },{ authorize }).inspectExpired(f.target));
    for (const pool of [admin,connect('steer_projector'),connect('steer_auth_runtime'),connect('steer_draft_runtime')])
      await assert.rejects(createExpiredDevelopmentStepReader(pool,f.config,{ authorize:async () => {} }).inspectExpired(f.target));
    reader.close(); await assert.rejects(reader.inspectExpired(f.target));
  });
  await check('current historical authority, draft holds and newer edits still govern originals after operation expiry', async () => {
    const f = await setup(true,4000); stored(await f.make().put(f.input));
    await delay(Math.max(0,Date.parse(f.config.expiresAt)-Date.now()+25));
    let allowed=true;
    const reader = f.make({ authorizeHistoricalResult:async () => { if (!allowed) throw new Error('private-history-revoked'); } });
    assert.equal((await f.drafts.append({ draftId:f.draftId,mutationId:randomUUID(),expectedRevision:1,expectedDigest:f.saved.reference.revisionDigest,
      content:{ ...f.source,originalText:'A newer human decision' } })).outcome,'acknowledged');
    const historical = await reader.readHistorical(f.target); assert.equal(historical.sourceDraftRevision,1); assert.equal(historical.latestDraftRevision,2);
    assert.deepEqual(historical.result,f.input.result);
    await assert.rejects(f.make({ authorizeHistoricalResult:async () => {} },f.pools,
      { subject:'foreign',budget:{ ...f.config.budget,subject:'foreign' } }).readHistorical(f.target));
    await assert.rejects(f.make({ authorizeHistoricalResult:async () => {} },f.pools,{ recordsPolicyDigest:'f'.repeat(64) }).readHistorical(f.target));
    allowed=false; const keys=f.state.keys; await assert.rejects(reader.readHistorical(f.target)); assert.equal(f.state.keys,keys);
    allowed=true; await f.lifecycle.hold({ draftId:f.draftId,holdReference:randomUUID() });
    await assert.rejects(reader.readHistorical(f.target)); assert.equal(f.state.keys,keys); assert.equal(await f.count(),1); reader.close();
  });
  await check('historical access cannot erase quarantines and suppresses late key-time authority loss or close', async () => {
    const f = await setup(true,5000); stored(await f.make().put(f.input));
    assert.equal((await f.operations().transition({ ...f.step,event:{ type:'outcome-unknown',fencingToken:1 } })).outcome,'ok');
    const g = await setup(true,5000); stored(await g.make().put(g.input));
    await delay(Math.max(0,Date.parse(g.config.expiresAt)-Date.now()+25));
    const keys=f.state.keys;
    await assert.rejects(f.make({ authorizeHistoricalResult:async () => {} }).readHistorical(f.target)); assert.equal(f.state.keys,keys);
    let allowed=true;
    await assert.rejects(g.make({ authorizeHistoricalResult:async () => { if (!allowed) throw new Error('private-history-marker'); },
      keyForDraft:async () => { allowed=false; return g.key; } }).readHistorical(g.target));
    let draftAllowed=true,keyReads=0;
    await assert.rejects(g.make({ authorizeHistoricalResult:async () => {},
      authorizeDraft:async () => { if (!draftAllowed) throw new Error('private-draft-read-revoked'); },
      keyForDraft:async () => { if (++keyReads===3) draftAllowed=false; return g.key; } }).readHistorical(g.target));
    assert.equal(keyReads,4); // Revoked after source restoration, during result decryption.
    let release!: () => void,entered!: () => void;
    const held=new Promise<void>(resolve => { release=resolve; }),reached=new Promise<void>(resolve => { entered=resolve; });
    const reader=g.make({ authorizeHistoricalResult:async () => {},keyForDraft:async () => { entered(); await held; return g.key; } });
    const pending=reader.readHistorical(g.target); await reached; reader.close(); release(); await assert.rejects(pending);
    assert.equal(await f.count(),1); assert.equal(await g.count(),1); assert.equal(await g.used(),3);
  });
}
