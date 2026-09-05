import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectionConsumer, type ProjectionConsumerPort } from '../src/projection-consumer.ts';

const scope = { organizationId: 'org', repository: 'github:47' };
const cursor = (position: string, generation = '00000000-0000-4000-8000-000000000047') => ({ ...scope, position, generation });
const reference = (recordKey = 'a', revision = 'a') => ({ recordKey, sourceRevision: revision.repeat(40), contentDigest: revision.repeat(64) });
const snapshot = () => ({ ...scope, outcome: 'snapshot', records: [reference()], cursor: cursor('1') });
const page = (position: string, events: unknown[] = [], hasMore = false) => ({ ...scope, outcome: 'page', events, cursor: cursor(position), hasMore, snapshotRequired: false });
const fixture = (): ProjectionConsumerPort => ({ snapshot: async () => snapshot(), changes: async () => page('1') });

test('consumer replaces a complete snapshot and applies validated pages before advancing exact cursors', async () => {
  const port = fixture(); const consumer = createProjectionConsumer(scope, port);
  assert.equal(consumer.view().phase, 'idle'); assert.equal((await consumer.sync()).phase, 'ready');
  let calls = 0; port.changes = async (input) => {
    calls++; assert.equal(input.cursor?.position, calls === 1 ? '1' : '3');
    return calls === 1 ? page('3', [{ ...reference('a', 'b'), position: '2' }, { ...reference('b', 'c'), position: '3' }]) : page('3');
  };
  const updated = await consumer.sync(); assert.equal(updated.cursor?.position, '3');
  assert.deepEqual(updated.records, [reference('a', 'b'), reference('b', 'c')]);
  assert.deepEqual((await consumer.sync()).records, updated.records);
  assert.ok(Object.isFrozen(updated.records)); assert.ok(Object.isFrozen(updated.records[0])); assert.ok(Object.isFrozen(updated.cursor));
});
test('bounded catch-up never claims ready while more pages remain and exact bigint offsets survive', async () => {
  const port = fixture(); port.snapshot = async () => ({ ...snapshot(), cursor: cursor('9007199254740993') });
  let calls = 0; port.changes = async (input) => {
    calls++; const position = String(BigInt(input.cursor!.position) + 1n);
    return page(position, [{ ...reference('a', 'b'), position }], calls < 3);
  };
  const consumer = createProjectionConsumer(scope, port, { pageSize: 1, maxPagesPerSync: 2 });
  await consumer.sync(); const partial = await consumer.sync();
  assert.equal(calls, 2); assert.equal(partial.phase, 'catching-up'); assert.equal(partial.hasMore, true); assert.equal(partial.cursor?.position, '9007199254740995');
  assert.equal((await consumer.sync()).phase, 'ready'); assert.equal(calls, 3);
});
test('reset discards old references and requests a fresh replacement snapshot only on the next sync', async () => {
  const port = fixture(); let snapshots = 0; port.snapshot = async () => { snapshots++; return snapshot(); };
  const consumer = createProjectionConsumer(scope, port); await consumer.sync();
  port.changes = async () => ({ ...scope, outcome: 'reset-required' });
  const reset = await consumer.sync(); assert.equal(reset.phase, 'reset-required'); assert.equal(reset.cursor, null); assert.deepEqual(reset.records, []); assert.equal(snapshots, 1);
  port.snapshot = async () => ({ ...snapshot(), records: [reference('replacement')], cursor: cursor('2', '00000000-0000-4000-8000-000000000099') });
  assert.deepEqual((await consumer.sync()).records, [reference('replacement')]);
});
test('no-stream snapshots are repeated without inventing a cursor or polling a guessed generation', async () => {
  const port = fixture(); let changes = 0; port.snapshot = async () => ({ ...snapshot(), records: [], cursor: null });
  port.changes = async () => { changes++; throw new Error('must not request'); };
  const consumer = createProjectionConsumer(scope, port);
  for (let i = 0; i < 2; i++) assert.equal((await consumer.sync()).phase, 'waiting-for-stream');
  assert.equal(changes, 0); port.snapshot = async () => snapshot(); assert.equal((await consumer.sync()).phase, 'ready');
});
test('malformed pages, wrong scope, gaps, changed generations and source failures clear stale references', async () => {
  for (const output of [{ ...page('1'), organizationId: 'foreign' }, page('3', [{ ...reference(), position: '3' }]),
    { ...page('1'), cursor: cursor('1', '00000000-0000-4000-8000-000000000099') }, { ...page('1'), snapshotRequired: true },
    { ...page('1'), private: 'secret' }, page('1', [], true), null]) {
    const port = fixture(); const consumer = createProjectionConsumer(scope, port); await consumer.sync();
    port.changes = async () => { if (output === null) throw new Error('private failed authorization'); return output; };
    const failed = await consumer.sync(); assert.equal(failed.phase, 'failed'); assert.equal(failed.cursor, null); assert.deepEqual(failed.records, []); assert.equal(JSON.stringify(failed).includes('private'), false);
  }
});
test('overlap is rejected and close clears immediately, drains real work and ignores late responses', async () => {
  let release!: (value: unknown) => void; const port = fixture();
  port.snapshot = () => new Promise((resolve) => { release = resolve; });
  const consumer = createProjectionConsumer(scope, port); const pending = consumer.sync();
  assert.equal(consumer.view().phase, 'loading'); await assert.rejects(consumer.sync(), /already active/);
  let drained = false; const close = consumer.close().then(() => { drained = true; });
  assert.equal(consumer.view().phase, 'closed'); await Promise.resolve(); assert.equal(drained, false);
  release(snapshot()); assert.equal((await pending).phase, 'closed'); await close;
  assert.equal(drained, true); assert.deepEqual(consumer.view().records, []); assert.equal((await consumer.sync()).phase, 'closed');
});
test('duplicate snapshot keys, malformed options and record overflow fail without partial state', async () => {
  for (const options of [{ pageSize: 101 }, { pageSize: 0 }, { maxPagesPerSync: 0 }, { maxPagesPerSync: 11 }]) assert.throws(() => createProjectionConsumer(scope, fixture(), options));
  const port = fixture(); port.snapshot = async () => ({ ...snapshot(), records: [reference(), reference()] });
  assert.equal((await createProjectionConsumer(scope, port).sync()).phase, 'failed');
  port.snapshot = async () => ({ ...snapshot(), records: Array.from({ length: 1000 }, (_, index) => reference(String(index))) });
  const consumer = createProjectionConsumer(scope, port); await consumer.sync();
  port.changes = async () => page('2', [{ ...reference('new'), position: '2' }]);
  const result = await consumer.sync(); assert.equal(result.phase, 'failed'); assert.deepEqual(result.records, []);
});

test('close before dispatch prevents I/O and reentrant close cannot claim an undrained request is finished', async () => {
  let calls = 0; const port = fixture(); port.snapshot = async () => { calls++; return snapshot(); };
  const before = createProjectionConsumer(scope, port); const skipped = before.sync(); await before.close();
  assert.equal((await skipped).phase, 'closed'); assert.equal(calls, 0);
  const consumer = createProjectionConsumer(scope, port); let release!: (value: unknown) => void;
  let closed = false; let closing: Promise<void> | undefined;
  port.snapshot = () => { closing = consumer.close().then(() => { closed = true; }); return new Promise((resolve) => { release = resolve; }); };
  const pending = consumer.sync(); await Promise.resolve();
  assert.equal(consumer.view().phase, 'closed'); assert.equal(closed, false);
  release(snapshot()); await pending; await closing; assert.equal(closed, true);
});
