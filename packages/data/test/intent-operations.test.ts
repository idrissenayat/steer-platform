import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createIntentOperationStore } from '../src/intent-operations.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';

const config = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52', branch: 'codex/fixture',
  action: 'candidate-save', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64),
  expiresAt: '2026-09-07T20:00:00.000Z', budget: null };
const input = { draftId: '00000000-0000-4000-8000-000000000209', draftRevision: 1, inputDigest: 'b'.repeat(64) };
const ref = { operationId: input.draftId, inputDigest: input.inputDigest };
const dependencies = { authorize: async () => {}, verifyCheckpoint: async () => {} };

test('strict operation configuration and request shapes reject private content and invented authority before I/O', async () => {
  let connections = 0, checks = 0;
  const pool: DatabasePool = { connect: async () => { connections++; throw new Error('private detail'); } };
  const make = () => createIntentOperationStore(pool, config, { ...dependencies, authorize: async () => { checks++; } });
  for (const patch of [{ sourceText: 'private' }, { action: 'other' }, { recordsPolicyDigest: 'a'.repeat(64) + '\n' }, { action: 'develop' }, { subject: '\ud800' }])
    assert.throws(() => createIntentOperationStore(pool, { ...config, ...patch }, dependencies));
  for (const patch of [{ originalText: 'private' }, { operationId: ref.operationId }, { draftId: input.draftId + '\n' }, { draftRevision: 0 },
    { draftRevision: 1.1 }, { inputDigest: 'b'.repeat(64) + '\n' }, { approved: true }]) assert.throws(() => make().create({ ...input, ...patch }));
  for (const patch of [{ organizationId: 'foreign' }, { operationId: '../new' }, { inputDigest: 'x' }]) assert.throws(() => make().inspect({ ...ref, ...patch }));
  const claim = { ...ref, stepId: 'candidate-save', stepInputDigest: 'c'.repeat(64), predecessorResultDigest: null, owner: 'worker', leaseMs: 1000 };
  for (const patch of [{ role: 'admin' }, { stepId: 'arbitrary' }, { leaseMs: 300001 }, { owner: '' }, { reserve: false }]) assert.throws(() => make().claim({ ...claim, ...patch }));
  assert.throws(() => make().transition({ ...ref, stepId: 'candidate-save', stepInputDigest: 'c'.repeat(64), predecessorResultDigest: null,
    event: { type: 'commit-dispatch', owner: 'worker', fencingToken: 1, dispatchAllowed: true } }));
  assert.equal(checks, 0); assert.equal(connections, 0);
});

test('missing identity, connection errors and closed stores never expose raw errors or dispatch permission', async () => {
  let connects = 0;
  const pool: DatabasePool = { connect: async () => { connects++; throw new Error('PRIVATE_DATABASE'); } };
  const denied = createIntentOperationStore(pool, config, { ...dependencies, authorize: async () => { throw new Error('PRIVATE_IDENTITY'); } });
  assert.deepEqual(await denied.inspect(ref), { outcome: 'unknown', dispatchAllowed: false }); assert.equal(connects, 0);
  const store = createIntentOperationStore(pool, config, dependencies);
  assert.deepEqual(await store.create(input), { outcome: 'unknown', dispatchAllowed: false }); assert.equal(connects, 1);
  store.close(); assert.deepEqual(await store.inspect(ref), { outcome: 'unavailable', dispatchAllowed: false }); assert.equal(connects, 1);
});

test('timed-out authorization retains all eight admission slots until actual work drains', async () => {
  let release!: () => void, checks = 0, connections = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  const pool: DatabasePool = { connect: async () => { connections++; throw new Error('synthetic'); } };
  const store = createIntentOperationStore(pool, config, { ...dependencies, authorize: async () => { checks++; await held; } });
  const tasks = Array.from({ length: 8 }, () => store.inspect(ref));
  assert.deepEqual(await store.inspect(ref), { outcome: 'unavailable', dispatchAllowed: false });
  assert.ok((await Promise.all(tasks)).every(result => result.outcome === 'unavailable' && !result.dispatchAllowed));
  assert.deepEqual(await store.inspect(ref), { outcome: 'unavailable', dispatchAllowed: false }); assert.equal(checks, 8); assert.equal(connections, 0);
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await store.inspect(ref)).outcome, 'unknown'); assert.equal(connections, 1);
});

test('an abandoned late connection is evicted without any SQL or leaked lease', async () => {
  let release!: (client: PoolClient) => void, evicted = false, queries = 0;
  const acquired = new Promise<PoolClient>(resolve => { release = resolve; });
  const store = createIntentOperationStore({ connect: () => acquired }, config, dependencies);
  assert.equal((await store.inspect(ref)).outcome, 'unavailable');
  release({ query: async () => { queries++; return { rows: [] }; }, release: (broken: boolean) => { evicted = broken; } } as unknown as PoolClient);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(evicted, true); assert.equal(queries, 0);
  store.close();
});

test('close during an authorization read cannot begin a late database operation', async () => {
  let release!: () => void, entered!: () => void, calls = 0;
  const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
  const store = createIntentOperationStore({ connect: async () => { calls++; throw new Error('should not connect'); } }, config,
    { ...dependencies, authorize: async () => { entered(); await held; } });
  const result = store.inspect(ref); await reached; store.close(); release();
  assert.equal((await result).outcome, 'unavailable'); assert.equal(calls, 0);
});
