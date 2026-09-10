import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createRecordsReadSetReader, type RecordsReadSetAuthority, type RecordsReadSetGroup, type RecordsReadSetLease } from '../src/records-readset.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';

const names: RecordsReadSetGroup[] = ['revisions', 'latest_revision', 'scope_originals', 'scope_observations', 'development_originals',
  'development_results', 'development_observations', 'candidate_originals', 'operations', 'steps', 'scope_runs', 'scope_batches', 'reservations', 'budget', 'scope_terms'];
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const deferred = () => { let resolve = () => {}; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise<void>(r => setImmediate(r));
function fixture() {
  const config = { organizationId: `records-owner-${randomUUID()}`, subject: 'synthetic-human', productId: 'synthetic-product',
    repository: 'github:52', branch: 'codex/fixture', configurationRevision: 'test-r1', recordsPolicyDigest: 'a'.repeat(64) };
  const target = { draftId: randomUUID(), operationIds: [randomUUID()], reviewIds: [randomUUID()], revisions: [1], budgetId: randomUUID() };
  const owner = { organization_id: config.organizationId, subject: config.subject, product_id: config.productId };
  const subjectOwner = { organization_id: config.organizationId, subject: config.subject };
  const header = { ...owner, draft_id: target.draftId, configuration_digest: createHash('sha256').update(JSON.stringify(config)).digest('hex'), held: false,
    created_at: new Date(Date.now() - 10000).toISOString(), use_until: new Date(Date.now() + 60000).toISOString(), clock_ms: Date.now() };
  const encrypted = { ...owner, draft_id: target.draftId, encrypted_value: { keyId: 'synthetic-key', ciphertext: 'fixture-not-real-ciphertext' } };
  const batch = randomUUID(), data: Record<RecordsReadSetGroup, any[]> = {
    revisions: [{ ...encrypted, revision: 1 }], latest_revision: [{ ...owner, revision: 1 }],
    scope_originals: [{ ...encrypted, review_id: target.reviewIds[0] }],
    scope_observations: [{ ...encrypted, review_id: target.reviewIds[0], batch_id: batch, stage: 'request' }],
    development_originals: [{ ...encrypted, operation_id: target.operationIds[0] }],
    development_results: [{ ...encrypted, operation_id: target.operationIds[0], step_id: 'architect' }],
    development_observations: [{ ...encrypted, operation_id: target.operationIds[0], step_id: 'architect', stage: 'request' }],
    candidate_originals: [{ ...encrypted, operation_id: target.operationIds[0], held: false, configuration_digest: header.configuration_digest,
      draft_created_at: header.created_at, use_until: header.use_until, retention_deadline: new Date(Date.now() + 3600000).toISOString() }],
    operations: [{ ...subjectOwner, draft_id: target.draftId, operation_id: target.operationIds[0] }],
    steps: [{ ...subjectOwner, operation_id: target.operationIds[0], step_id: 'architect', budget_id: target.budgetId }],
    scope_runs: [{ ...owner, draft_id: target.draftId, review_id: target.reviewIds[0] }],
    scope_batches: [{ ...owner, review_id: target.reviewIds[0], batch_id: batch }],
    reservations: [{ ...subjectOwner, operation_id: target.operationIds[0], reservation_id: randomUUID(), budget_id: target.budgetId }],
    budget: [{ ...subjectOwner, budget_id: target.budgetId }], scope_terms: [{ ...subjectOwner, budget_id: target.budgetId }],
  };
  const queries: string[] = [], releases: boolean[] = [], grants: RecordsReadSetGroup[] = [];
  let connects = 0, callerChecks = 0, now = 100, permissionsRevision = 'records-grants-1', denied: RecordsReadSetGroup | undefined;
  let onQuery: ((sql: string) => Promise<void>) | undefined, onConnect: (() => Promise<void>) | undefined;
  let actor: Record<string, unknown> = {}, beforeGrant: ((group: RecordsReadSetGroup) => Promise<void>) | undefined;
  const authority: RecordsReadSetAuthority = {
    async authorize(context) { assert.deepEqual(context, { configuration: config, target }); return { permissionsRevision }; },
    records: Object.fromEntries(names.map(group => [group, async function(this: unknown, context: any) {
      assert.equal(this, authority.records); assert.equal(context.group, group); assert.deepEqual(context.target, target);
      assert.ok(Object.isFrozen(context.metadata)); assert.ok(!('encrypted_value' in context.metadata));
      grants.push(group); await beforeGrant?.(group); if (denied === group) throw new Error('private provider details');
    }])) as RecordsReadSetAuthority['records'],
  };
  const pools = Object.fromEntries((['drafts', 'execution'] as const).map(role => [role, { async connect() {
    assert.equal(this, pools[role]); connects++; await onConnect?.(); const expected = role === 'drafts' ? 'steer_draft_runtime' : 'steer_app';
    return { async query(sql: string, args?: unknown[]) {
      queries.push(sql); await onQuery?.(sql);
      if (sql.includes('FROM pg_roles')) return { rows: [{ rolname: expected, login_role: expected, rolsuper: false, rolbypassrls: false, owns_objects: false, ...actor }] };
      if (sql.includes('FROM steer_drafts.draft_lifecycles')) return { rows: [clone(header)] };
      if (sql.startsWith('WITH requested')) {
        assert.deepEqual(args, [config.organizationId, target.draftId, target.operationIds, target.reviewIds, target.revisions, target.budgetId]);
        assert.ok(!sql.includes(target.draftId)); assert.ok(!sql.includes(config.organizationId));
        const metadata = sql.includes("to_jsonb(selected) - 'encrypted_value'");
        if (!metadata) assert.ok(names.every(name => grants.includes(name)), 'Ciphertext dispatch requires every independent row policy.');
        return { rows: [{ clock_ms: header.clock_ms, data: Object.fromEntries(Object.entries(data).filter(([name]) => sql.includes(`'${name}',`))
          .map(([name, rows]) => [name, clone(rows).map(row => { if (metadata) delete row.encrypted_value; return row; })])) }] };
      }
      assert.ok(sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('BEGIN ') || sql.startsWith('SELECT set_config(')); return { rows: [] };
    }, release(broken = false) { releases.push(broken); } } as unknown as PoolClient;
  } } as DatabasePool])) as { drafts: DatabasePool; execution: DatabasePool };
  return { config, target, header, data, queries, releases, grants, pools, authority,
    owner: () => createRecordsReadSetReader(pools, config, authority, { monotonicNow: () => now }),
    current: async () => { callerChecks++; }, connects: () => connects, callerChecks: () => callerChecks,
    clock: (v: number) => { now = v; }, revision: (v: string) => { permissionsRevision = v; }, deny: (v: RecordsReadSetGroup) => { denied = v; },
    query: (v: typeof onQuery) => { onQuery = v; }, connect: (v: typeof onConnect) => { onConnect = v; },
    actor: (v: typeof actor) => { actor = v; }, grant: (v: typeof beforeGrant) => { beforeGrant = v; } };
}
const consume = async (lease: RecordsReadSetLease) => { await lease.recheck(); return lease.snapshot.digest; };

test('native non-model candidate-save step requires a null budget; model steps still require the exact budget', async () => {
  const f = fixture(), owner = f.owner();
  f.data.steps.push({ organization_id: f.config.organizationId, subject: f.config.subject,
    operation_id: f.target.operationIds[0], step_id: 'candidate-save', budget_id: null });
  try {
    await owner.withReadSet(f.target, f.current, consume);
    f.data.steps[1].budget_id = f.target.budgetId; await assert.rejects(owner.withReadSet(f.target, f.current, consume));
    f.data.steps[1].budget_id = null; f.data.steps[0].budget_id = null; await assert.rejects(owner.withReadSet(f.target, f.current, consume));
    f.data.steps[0].budget_id = randomUUID(); await assert.rejects(owner.withReadSet(f.target, f.current, consume));
  } finally { await owner.shutdown(); }
});

test('owned reader uses metadata-first independent policies, exact full snapshots and six scoped transactions', async () => {
  const f = fixture(), owner = f.owner();
  try {
    const result = await owner.withReadSet(f.target, f.current, async lease => {
      assert.ok(Object.isFrozen(lease.snapshot.data.revisions[0])); assert.equal(lease.snapshot.plaintextVerified, false);
      assert.equal(lease.snapshot.keys.length, 1); assert.equal(lease.snapshot.keys[0]!.records.length, 7);
      assert.throws(() => { (lease.snapshot.data.revisions[0] as any).subject = 'changed'; });
      await lease.recheck(); return 'verified by trusted test callback';
    });
    assert.equal(result.value, 'verified by trusted test callback'); assert.equal(result.metrics.statements, 51);
    assert.equal(result.metrics.roleTransactions, 6); assert.equal(result.metrics.callerChecks, 13);
    assert.equal(result.metrics.metadataGrants, 13); assert.equal(result.metrics.recordPolicyChecks, 30);
    assert.equal(f.callerChecks(), 13); assert.deepEqual(f.releases, Array(6).fill(false));
    const aggregates = f.queries.filter(q => q.startsWith('WITH requested')); assert.equal(aggregates.length, 6);
    assert.ok(aggregates.slice(0, 2).every(q => q.includes(" - 'encrypted_value'")));
    assert.ok(aggregates.slice(2).every(q => !q.includes(" - 'encrypted_value'")));
    assert.match(aggregates[1]!, /r\.operation_id=ANY\(q\.reviews\)/);
    for (const group of names) assert.equal(f.grants.filter(name => name === group).length, 2);
    // A second call repeats policy and database work; nothing is cached.
    await owner.withReadSet(f.target, f.current, consume); assert.equal(f.connects(), 12);
  } finally { await owner.shutdown(); }
});

test('invalid configuration, target, missing policy and changed bindings fail closed before content dispatch', async () => {
  const f = fixture(), owner = f.owner();
  try {
    for (const target of [{ ...f.target, extra: true }, { ...f.target, operationIds: [] },
      { ...f.target, operationIds: [...f.target.operationIds, ...f.target.operationIds] }, { ...f.target, reviewIds: [] },
      { ...f.target, reviewIds: [...f.target.reviewIds, ...f.target.reviewIds] }, { ...f.target, revisions: [1, 1] },
      { ...f.target, revisions: [1001] }, { ...f.target, revisions: Array.from({ length: 17 }, (_, i) => i + 1) }])
      await assert.rejects(owner.withReadSet(target, f.current, consume));
    assert.equal(f.connects(), 0);
    assert.throws(() => createRecordsReadSetReader(f.pools, { ...f.config, recordsPolicyDigest: '' }, f.authority));
    delete (f.authority.records as Partial<RecordsReadSetAuthority['records']>).steps;
    assert.throws(() => f.owner()); await assert.rejects(owner.withReadSet(f.target, f.current, consume));
  } finally { await owner.shutdown(); }
  for (const change of [(f: ReturnType<typeof fixture>) => { f.authority.records.steps = async () => {}; },
    (f: ReturnType<typeof fixture>) => { f.authority.authorize = async () => ({ permissionsRevision: 'changed' }); },
    (f: ReturnType<typeof fixture>) => { f.pools.drafts.connect = async () => { throw new Error('must not run'); }; }]) {
    const fixtureCase = fixture(), reader = fixtureCase.owner(); change(fixtureCase);
    await assert.rejects(reader.withReadSet(fixtureCase.target, fixtureCase.current, consume)); assert.equal(fixtureCase.connects(), 0); await reader.shutdown();
  }
});

test('each independent record denial prevents every ciphertext query and verifier invocation', async () => {
  for (const name of names) {
    const f = fixture(), owner = f.owner(); let used = false; f.deny(name);
    try {
      await assert.rejects(owner.withReadSet(f.target, f.current, async lease => { used = true; await lease.recheck(); }),
        { message: 'The complete records read set could not be verified.' });
      assert.equal(used, false); assert.equal(f.connects(), 2);
      assert.ok(f.queries.filter(q => q.startsWith('WITH requested')).every(q => q.includes(" - 'encrypted_value'")));
    } finally { await owner.shutdown(); }
  }
});

test('wrong SQL role, missing role flags, foreign owner, wrong targets, overflow and missing membership deny', async () => {
  for (const change of [(f: ReturnType<typeof fixture>) => f.actor({ rolsuper: true }),
    (f: ReturnType<typeof fixture>) => f.actor({ owns_objects: true }), (f: ReturnType<typeof fixture>) => f.actor({ rolbypassrls: undefined }),
    (f: ReturnType<typeof fixture>) => f.actor({ login_role: 'other' }), (f: ReturnType<typeof fixture>) => { f.header.subject = 'other'; },
    (f: ReturnType<typeof fixture>) => { f.header.draft_id = randomUUID(); }, (f: ReturnType<typeof fixture>) => { f.header.held = true; },
    (f: ReturnType<typeof fixture>) => { f.data.revisions[0].subject = 'other'; },
    (f: ReturnType<typeof fixture>) => { delete f.data.revisions[0].product_id; },
    (f: ReturnType<typeof fixture>) => { f.data.revisions[0].revision = 2; },
    (f: ReturnType<typeof fixture>) => { f.data.operations[0].operation_id = randomUUID(); },
    (f: ReturnType<typeof fixture>) => { delete f.data.operations[0].draft_id; },
    (f: ReturnType<typeof fixture>) => { f.data.scope_runs[0].review_id = randomUUID(); },
    (f: ReturnType<typeof fixture>) => { f.data.scope_originals[0].draft_id = randomUUID(); },
    (f: ReturnType<typeof fixture>) => { f.data.budget = []; },
    (f: ReturnType<typeof fixture>) => { f.data.revisions = Array(17).fill(f.data.revisions[0]); },
    (f: ReturnType<typeof fixture>) => { f.data.steps.push(clone(f.data.steps[0])); },
    (f: ReturnType<typeof fixture>) => { f.data.scope_terms[0].budget_id = randomUUID(); },
    (f: ReturnType<typeof fixture>) => { f.data.revisions[0].oversize = 'x'.repeat(16 * 1024 * 1024); }]) {
    const f = fixture(), owner = f.owner(); change(f);
    try { await assert.rejects(owner.withReadSet(f.target, f.current, consume)); }
    finally { await owner.shutdown(); }
    assert.equal(f.releases.length, f.connects());
  }
});

test('metadata changes after grants cannot reach decoding, including same-row metadata edits', async () => {
  for (const change of [(f: ReturnType<typeof fixture>) => { f.data.revisions[0].record = { changed: true }; },
    (f: ReturnType<typeof fixture>) => { f.data.latest_revision[0].revision = 2; },
    (f: ReturnType<typeof fixture>) => { f.header.use_until = new Date(Date.parse(f.header.use_until) + 1000).toISOString(); }]) {
    const f = fixture(), owner = f.owner(); let used = false;
    f.grant(async group => { if (group === 'scope_terms') change(f); });
    try { await assert.rejects(owner.withReadSet(f.target, f.current, async () => { used = true; })); assert.equal(used, false); }
    finally { await owner.shutdown(); }
  }
});

test('late policy, grants revision, ciphertext, execution rows and lifecycle changes deny final result', async () => {
  for (const change of [(f: ReturnType<typeof fixture>) => f.deny('scope_observations'),
    (f: ReturnType<typeof fixture>) => f.revision('records-grants-2'),
    (f: ReturnType<typeof fixture>) => { f.data.revisions[0].encrypted_value.ciphertext = 'different'; },
    (f: ReturnType<typeof fixture>) => { f.data.steps[0].state = 'changed'; },
    (f: ReturnType<typeof fixture>) => { f.header.held = true; },
    (f: ReturnType<typeof fixture>) => { f.data.candidate_originals[0].held = true; },
    (f: ReturnType<typeof fixture>) => { f.data.latest_revision[0].revision = 2; }]) {
    const f = fixture(), owner = f.owner(); let reached = false;
    try { await assert.rejects(owner.withReadSet(f.target, f.current, async lease => { reached = true; change(f); await lease.recheck(); return 'must not release'; })); assert.ok(reached); }
    finally { await owner.shutdown(); }
  }
});

test('recheck is mandatory, one-use, and cannot be salvaged by catching a failed verification', async () => {
  for (const use of [async () => 'skipped', async (lease: RecordsReadSetLease) => { await lease.recheck(); await assert.rejects(lease.recheck()); return 'twice'; },
    async (lease: RecordsReadSetLease) => { const work = lease.recheck(); void work.catch(() => {}); return 'not awaited'; }]) {
    const f = fixture(), owner = f.owner();
    try { await assert.rejects(owner.withReadSet(f.target, f.current, use)); }
    finally { await owner.shutdown(); }
  }
  const f = fixture(), owner = f.owner();
  try { await assert.rejects(owner.withReadSet(f.target, f.current, async lease => {
    f.deny('steps'); await assert.rejects(lease.recheck()); return 'caught denial';
  })); } finally { await owner.shutdown(); }
});

test('initial expiry, candidate expiry, monotonic regression and invalid database clocks remain closed', async () => {
  for (const clock of [undefined, null, '', 'NaN', '1.5', '1\n', -1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const f = fixture(), owner = f.owner(); f.header.clock_ms = clock as number;
    try { await assert.rejects(owner.withReadSet(f.target, f.current, consume)); } finally { await owner.shutdown(); }
  }
  for (const change of [(f: ReturnType<typeof fixture>) => f.clock(99), (f: ReturnType<typeof fixture>) => f.clock(NaN),
    (f: ReturnType<typeof fixture>) => f.clock(30100), (f: ReturnType<typeof fixture>) => { f.header.clock_ms--; }]) {
    const f = fixture(), owner = f.owner();
    try { await assert.rejects(owner.withReadSet(f.target, f.current, async lease => { change(f); await lease.recheck(); })); }
    finally { await owner.shutdown(); }
  }
  for (const candidate of [false, true]) {
    const f = fixture(), owner = f.owner();
    if (candidate) f.data.candidate_originals[0].use_until = new Date(f.header.clock_ms + 1000).toISOString();
    else f.header.use_until = new Date(f.header.clock_ms + 1000).toISOString();
    try { await assert.rejects(owner.withReadSet(f.target, f.current, async lease => {
      f.clock(1099); await lease.recheck(); f.clock(1100); assert.throws(lease.check); f.clock(100); return 'expired';
    })); } finally { await owner.shutdown(); }
  }
});

test('malformed envelope key references never reach a key or decoder callback', async () => {
  for (const envelope of [{ keyId: 'synthetic-key\n' }, { keyId: '' }, { keyId: 1 }, { chunks: [] }, { chunks: [null] }]) {
    const f = fixture(), owner = f.owner(); let used = false; f.data.revisions[0].encrypted_value = envelope;
    try { await assert.rejects(owner.withReadSet(f.target, f.current, async () => { used = true; })); assert.equal(used, false); }
    finally { await owner.shutdown(); }
  }
});

test('fresh current/grant checks and pinned dependencies reject changes during ciphertext IO', async () => {
  for (const change of [(f: ReturnType<typeof fixture>) => f.revision('changed-during-io'),
    (f: ReturnType<typeof fixture>) => { f.authority.records.steps = async () => {}; },
    (f: ReturnType<typeof fixture>) => { f.pools.execution = { connect: async () => { throw new Error('must not connect'); } }; }]) {
    const f = fixture(), owner = f.owner(); let used = false, changed = false;
    f.query(async sql => { if (!changed && sql.startsWith('WITH requested') && !sql.includes(" - 'encrypted_value'")) { change(f); changed = true; } });
    try { await assert.rejects(owner.withReadSet(f.target, f.current, async () => { used = true; })); assert.ok(changed); assert.equal(used, false); }
    finally { await owner.shutdown(); }
    assert.equal(f.releases.length, f.connects());
  }
  const f = fixture(), owner = f.owner();
  try { await assert.rejects(owner.withReadSet(f.target, (async () => true) as unknown as () => Promise<void>, consume)); assert.equal(f.connects(), 0); }
  finally { await owner.shutdown(); }
});

test('late source closure may run after records recheck, but a late grant revision still withholds return', async () => {
  const f = fixture(), owner = f.owner();
  try { await assert.rejects(owner.withReadSet(f.target, f.current, async lease => {
    await lease.recheck(); f.revision('revoked-after-final-records'); return 'source-callback-finished';
  })); } finally { await owner.shutdown(); }
});

test('four cancelled held verifiers retain all slots and shutdown drains their actual work', async () => {
  const f = fixture(), owner = f.owner(), gate = deferred(), reached = deferred(), signals = Array.from({ length: 4 }, () => new AbortController());
  let uses = 0, stopped = false;
  const calls = signals.map(signal => owner.withReadSet(f.target, f.current, async lease => {
    if (++uses === 4) reached.resolve(); await gate.promise; await lease.recheck();
  }, signal.signal));
  const rejected = calls.map(call => assert.rejects(call));
  try {
    await reached.promise; signals.forEach(signal => signal.abort()); await Promise.all(rejected);
    const count = f.connects(); await assert.rejects(owner.withReadSet(f.target, f.current, consume)); assert.equal(f.connects(), count);
    const shutdown = owner.shutdown().then(() => { stopped = true; }); await tick(); assert.equal(stopped, false);
    gate.resolve(); await shutdown; assert.equal(stopped, true);
  } finally { gate.resolve(); await owner.shutdown(); await Promise.all(rejected); }
});

test('cancelled pending connect and SQL retain ownership until leases are cleaned up', async () => {
  for (const phase of ['connect', 'sql'] as const) {
    const f = fixture(), owner = f.owner(), gate = deferred(), reached = deferred(), signal = new AbortController();
    if (phase === 'connect') f.connect(async () => { reached.resolve(); await gate.promise; });
    else f.query(async sql => { if (sql.startsWith('WITH requested')) { reached.resolve(); await gate.promise; } });
    const call = owner.withReadSet(f.target, f.current, consume, signal.signal), rejection = assert.rejects(call); let stopped = false;
    try {
      await reached.promise; signal.abort(); await rejection;
      const shutdown = owner.shutdown().then(() => { stopped = true; }); await tick(); assert.equal(stopped, false);
      gate.resolve(); await shutdown; assert.deepEqual(f.releases, [true]);
    } finally { gate.resolve(); await owner.shutdown(); await rejection; }
  }
});

test('a forgotten pending recheck drains even after the verifier returns or throws', async () => {
  for (const throws of [false, true]) {
    const f = fixture(), owner = f.owner(), gate = deferred(), reached = deferred(), signal = new AbortController();
    let finalPass = false, stopped = false;
    f.grant(async group => { if (finalPass && group === 'revisions') { reached.resolve(); await gate.promise; } });
    const call = owner.withReadSet(f.target, f.current, async lease => {
      finalPass = true; const ignored = lease.recheck(); void ignored.catch(() => {}); await reached.promise;
      if (throws) throw new Error('verifier failed'); return 'unawaited';
    }, signal.signal), rejection = assert.rejects(call);
    try {
      await reached.promise; signal.abort(); await rejection;
      const shutdown = owner.shutdown().then(() => { stopped = true; }); await tick(); assert.equal(stopped, false);
      gate.resolve(); await shutdown; assert.equal(stopped, true);
    } finally { gate.resolve(); await owner.shutdown(); await rejection; }
  }
});
