import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { readRecordsReadsetPrototype, recordsReadsetGroups, assertRecordsReadsetsUsable } from './records-readset-prototype.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';

// Query/control tests only; the separate integration selection proves native SQL.
function fixture() {
  const config = { organizationId: `authenticated-generation-${randomUUID()}`, subject: 'synthetic-human', productId: 'synthetic-product',
    repository: 'github:52', branch: 'codex/fixture', configurationRevision: 'test-r1', recordsPolicyDigest: 'a'.repeat(64) };
  const target = { draftId: randomUUID(), operationIds: [randomUUID()], reviewIds: [randomUUID()], revisions: [1], budgetId: randomUUID() };
  const owner = { organization_id: config.organizationId, subject: config.subject, product_id: config.productId };
  const data: Record<string, any[]> = Object.fromEntries(recordsReadsetGroups.map(g => [g.name, []]));
  for (const name of ['revisions', 'latest_revision', 'operations', 'scope_runs', 'scope_originals']) data[name] = [{ ...owner }];
  const header = { ...owner, configuration_digest: createHash('sha256').update(JSON.stringify(config)).digest('hex'), held: false,
    created_at: new Date(Date.now() - 10000), use_until: new Date(Date.now() + 60000), clock_ms: Date.now() };
  const queries: string[] = [], released: boolean[] = []; let calls = 0;
  let actor: Record<string, unknown> = {}, mutate: ((sql: string) => void) | undefined;
  const pools = Object.fromEntries((['drafts', 'execution'] as const).map(role => [role, { async connect() {
    calls++; const expected = role === 'drafts' ? 'steer_draft_runtime' : 'steer_app';
    return { async query(sql: string, args?: unknown[]) {
      queries.push(sql); mutate?.(sql);
      if (sql.includes('FROM pg_roles')) return { rows: [{ rolname: expected, login_role: expected, rolsuper: false, rolbypassrls: false, owns_objects: false, ...actor }] };
      if (sql.includes('FROM steer_drafts.draft_lifecycles')) return { rows: [header] };
      if (sql.startsWith('WITH requested')) {
        assert.deepEqual(args, [config.organizationId, target.draftId, target.operationIds, target.reviewIds, target.revisions, target.budgetId]);
        assert.ok(!sql.includes(target.draftId)); assert.ok(!sql.includes(config.organizationId));
        return { rows: [{ clock_ms: header.clock_ms, data: Object.fromEntries(Object.entries(data).filter(([name]) => sql.includes(`'${name}',`))) }] };
      }
      assert.ok(sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('BEGIN ') || sql.startsWith('SELECT set_config('));
      return { rows: [] };
    }, release(broken = false) { released.push(broken); } } as unknown as PoolClient;
  } } as DatabasePool])) as { drafts: DatabasePool; execution: DatabasePool };
  return { config, target, data, header, pools, queries, released, calls: () => calls, actor: (v: typeof actor) => { actor = v; },
    mutate: (fn: typeof mutate) => { mutate = fn; } };
}
test('test-only snapshot uses two scoped roles, two bounded aggregates and four fresh caller checks', async () => {
  const f = fixture(); let current = 0;
  const result = await readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => { current++; });
  assert.equal(result.metrics.statements, 17); assert.equal(result.metrics.roleTransactions, 2); assert.equal(current, 4);
  assert.deepEqual(f.released, [false, false]); assert.equal(result.productionInstalled, false); assert.equal(result.recordsPoliciesVerified, false);
  const aggregates = f.queries.filter(q => q.startsWith('WITH requested')); assert.equal(aggregates.length, 2);
  assert.match(aggregates[1]!, /r\.operation_id=ANY\(q\.reviews\)/); assert.doesNotMatch(aggregates[1]!, /r\.review_id=ANY\(q\.reviews\)\)\)/);
  for (const g of recordsReadsetGroups) assert.ok(aggregates.some(q => q.includes(`'${g.name}',`) && q.includes(`LIMIT ${g.max + (g.name === 'latest_revision' ? 0 : 1)}`)));
  f.header.clock_ms = Number(f.header.clock_ms) + 1;
  assert.equal((await readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => {})).digest, result.digest);
});
test('malformed, duplicate, oversized and non-fixture targets fail before pool access', async () => {
  const f = fixture();
  for (const target of [{ ...f.target, extra: true }, { ...f.target, operationIds: [] },
    { ...f.target, operationIds: [...f.target.operationIds, ...f.target.operationIds] },
    { ...f.target, reviewIds: [...f.target.reviewIds, ...f.target.reviewIds] }, { ...f.target, revisions: [1, 1] },
    { ...f.target, revisions: Array.from({ length: 17 }, (_, i) => i + 1) }, { ...f.target, revisions: [1001] }])
    await assert.rejects(readRecordsReadsetPrototype(f.pools, f.config, target, async () => {}));
  await assert.rejects(readRecordsReadsetPrototype(f.pools, { ...f.config, organizationId: 'real-org' }, f.target, async () => {}));
  assert.equal(f.calls(), 0);
});
test('wrong SQL roles, owner, row overflow and lifecycle loss close leases and deny', async () => {
  for (const mutate of [(f: ReturnType<typeof fixture>) => f.actor({ rolsuper: true }),
    (f: ReturnType<typeof fixture>) => f.actor({ owns_objects: true }), (f: ReturnType<typeof fixture>) => f.actor({ rolbypassrls: true }),
    (f: ReturnType<typeof fixture>) => f.actor({ login_role: 'other' }), (f: ReturnType<typeof fixture>) => { f.header.held = true; },
    (f: ReturnType<typeof fixture>) => { f.header.use_until = new Date(0); },
    (f: ReturnType<typeof fixture>) => { f.data.revisions![0].subject = 'other'; },
    (f: ReturnType<typeof fixture>) => { f.data.revisions = Array.from({ length: 17 }, () => f.data.revisions![0]); }]) {
    const f = fixture(); mutate(f); await assert.rejects(readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => {}));
    assert.deepEqual(f.released, [true]); assert.ok(f.queries.includes('ROLLBACK'));
  }
});
test('abort, replaced dependency and late caller denial never return snapshot', async () => {
  const aborted = fixture(), controller = new AbortController(); controller.abort();
  await assert.rejects(readRecordsReadsetPrototype(aborted.pools, aborted.config, aborted.target, async () => {}, controller.signal));
  assert.equal(aborted.calls(), 0);
  const replaced = fixture(); replaced.mutate(sql => { if (sql.startsWith('BEGIN')) replaced.pools.execution = { connect: async () => { throw new Error('must not connect'); } }; });
  await assert.rejects(readRecordsReadsetPrototype(replaced.pools, replaced.config, replaced.target, async () => {}));
  assert.deepEqual(replaced.released, [true]);
  const late = fixture(); let checks = 0;
  await assert.rejects(readRecordsReadsetPrototype(late.pools, late.config, late.target, async () => { if (++checks === 4) throw new Error('late denial'); }));
  assert.equal(checks, 4); assert.deepEqual(late.released, [false, false]);
});
test('candidate-specific holds and expiry deny, independent of the draft lifecycle', async () => {
  for (const variant of [{ held: true }, { use_until: new Date(0).toISOString() }, { configuration_digest: 'b'.repeat(64) }]) {
    const f = fixture(); f.data.candidate_originals = [{ ...f.data.revisions![0], draft_id: f.target.draftId,
      held: false, configuration_digest: f.header.configuration_digest,
      draft_created_at: f.header.created_at.toISOString(), use_until: f.header.use_until.toISOString(),
      retention_deadline: new Date(Date.now() + 3600000).toISOString(), ...variant }];
    await assert.rejects(readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => {}));
    assert.deepEqual(f.released, [true]);
  }
});
test('physical key references are deduplicated without losing record membership', async () => {
  const f = fixture();
  Object.assign(f.data.revisions![0], { draft_id: f.target.draftId, encrypted_value: { keyId: 'synthetic-key' } });
  Object.assign(f.data.scope_originals![0], { draft_id: f.target.draftId, encrypted_value: { chunks: [{ keyId: 'synthetic-key' }, { keyId: 'synthetic-key' }] } });
  const result = await readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => {});
  assert.equal(result.keys.length, 1); assert.deepEqual(result.keys[0]!.records, ['revisions:0', 'scope_originals:0']);
  assert.equal(result.plaintextVerified, false); // Envelopes above are deliberately not real ciphertext.
});

test('private lifetime reaches the exact deadline and cannot be extended by a later snapshot or copied metadata', async () => {
  const f = fixture(); let now = 100;
  f.header.use_until = new Date(Number(f.header.clock_ms) + 1000);
  const read = () => readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => {}, new AbortController().signal, () => now);
  const first = await read(); now = 1099; assertRecordsReadsetsUsable(first);
  f.header.clock_ms = Number(f.header.clock_ms) - 500; const second = await read();
  now = 1100; assertRecordsReadsetsUsable(second);
  assert.throws(() => assertRecordsReadsetsUsable(first, second));
  assert.throws(() => assertRecordsReadsetsUsable({ ...second }));
  assert.throws(() => assertRecordsReadsetsUsable());
  now = 100; assert.throws(() => assertRecordsReadsetsUsable(first));
});

test('candidate use deadline remains effective while later work runs', async () => {
  const f = fixture(); let now = 50;
  f.data.candidate_originals = [{ ...f.data.revisions![0], draft_id: f.target.draftId, held: false,
    configuration_digest: f.header.configuration_digest, draft_created_at: f.header.created_at.toISOString(),
    use_until: new Date(Number(f.header.clock_ms) + 100).toISOString(), retention_deadline: f.header.use_until.toISOString() }];
  const snapshot = await readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => {}, new AbortController().signal, () => now);
  now = 149; assertRecordsReadsetsUsable(snapshot); now = 150; assert.throws(() => assertRecordsReadsetsUsable(snapshot));
});

test('invalid database times fail closed instead of creating a non-expiring NaN deadline', async () => {
  for (const clock of [undefined, null, '', 'NaN', '1.5', '-1', NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const f = fixture(); f.header.clock_ms = clock as number;
    await assert.rejects(readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => {}));
    assert.deepEqual(f.released, [true]);
  }
  for (const field of ['created_at', 'use_until'] as const) {
    const f = fixture(); f.header[field] = new Date(NaN);
    await assert.rejects(readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => {}));
  }
  const regressed = fixture(); regressed.mutate(sql => { if (sql.startsWith('WITH requested')) regressed.header.clock_ms--; });
  await assert.rejects(readRecordsReadsetPrototype(regressed.pools, regressed.config, regressed.target, async () => {}));
  assert.deepEqual(regressed.released, [true]);
});

test('clock regression or invalidity permanently invalidates a captured lifetime', async () => {
  for (const changed of [99, NaN, Infinity]) {
    const f = fixture(); let now = 100;
    const snapshot = await readRecordsReadsetPrototype(f.pools, f.config, f.target, async () => {}, new AbortController().signal, () => now);
    now = changed; assert.throws(() => assertRecordsReadsetsUsable(snapshot));
    now = 101; assert.throws(() => assertRecordsReadsetsUsable(snapshot));
  }
});
