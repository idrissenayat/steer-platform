import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentOriginalStore } from '../src/development-originals.ts';
import { readHistoricalOriginalWindow, withHistoricalOriginalReadWindow,
  type HistoricalOriginalReadWindow } from '../src/historical-original-read-window.ts';

const config = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52',
  branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
const target = { operationId: '00000000-0000-4000-8000-000000000219', inputDigest: 'a'.repeat(64) };
function fixture(authorizeHistoricalRead: () => Promise<void> = async () => { throw new Error('denied'); }) {
  let connections = 0;
  const pool = { connect: async () => { connections++; throw new Error('SQL must not run'); } };
  const store = createDevelopmentOriginalStore({ drafts: pool, execution: pool }, config, {
    authorize: async () => { throw new Error('ordinary denied'); }, authorizeHistoricalRead,
    authorizeOriginal: async () => {}, authorizeOperation: async () => {}, authorizeDraft: async () => {},
    keyForDraft: async () => { throw new Error('key must not run'); },
  });
  return { store, connections: () => connections };
}

test('only a constructed store and live opaque window can enter historical original reuse', async () => {
  await assert.rejects(withHistoricalOriginalReadWindow({}, target, async () => {}, async () => 'forged'));
  assert.throws(() => readHistoricalOriginalWindow({} as HistoricalOriginalReadWindow, config, target));
  const f = fixture(); let captured: HistoricalOriginalReadWindow | undefined;
  await assert.rejects(withHistoricalOriginalReadWindow(f.store, target, async () => {}, async window => {
    captured = window; assert.ok(Object.isFrozen(window));
    assert.throws(() => readHistoricalOriginalWindow({ ...window }, config, target));
    assert.throws(() => readHistoricalOriginalWindow(window, { ...config, subject: 'other' }, target));
    return readHistoricalOriginalWindow(window, config, target);
  }));
  assert.throws(() => readHistoricalOriginalWindow(captured!, config, target)); assert.equal(f.connections(), 0); f.store.close();
});

test('no-read, foreign-target, nonvoid-current and closed windows cannot publish or dispatch SQL', async () => {
  for (const mode of ['no-read', 'foreign', 'nonvoid', 'closed'] as const) {
    const f = fixture(); if (mode === 'closed') f.store.close();
    await assert.rejects(withHistoricalOriginalReadWindow(f.store, target, async () => {
      if (mode === 'nonvoid') return true as unknown as void;
    }, async window => mode === 'no-read' ? 'PRIVATE' : readHistoricalOriginalWindow(window, config,
      mode === 'foreign' ? { ...target, inputDigest: 'b'.repeat(64) } : target)));
    assert.equal(f.connections(), 0); f.store.close();
  }
});

test('a read window excludes ordinary access, writes, overlap and changed store methods', async () => {
  const f = fixture();
  await assert.rejects(withHistoricalOriginalReadWindow(f.store, target, async () => {}, async window => {
    await assert.rejects(f.store.readHistorical(target)); await assert.rejects(f.store.read(target));
    assert.deepEqual(await f.store.put({}), { outcome: 'unavailable' });
    await assert.rejects(withHistoricalOriginalReadWindow(f.store, target, async () => {}, async () => 'other'));
    f.store.readHistorical = async () => { throw new Error('replacement'); };
    return readHistoricalOriginalWindow(window, config, target);
  }));
  assert.equal(f.connections(), 0); f.store.close();
});

test('timed-out window retains actual dependency admission and rejects late continuation after closure', async () => {
  let release!: () => void, calls = 0;
  const held = new Promise<void>(r => { release = r; });
  const f = fixture(async () => { calls++; await held; });
  const run = () => withHistoricalOriginalReadWindow(f.store, target, async () => {}, window => readHistoricalOriginalWindow(window, config, target));
  await assert.rejects(run()); await assert.rejects(run()); assert.equal(calls, 1); assert.equal(f.connections(), 0);
  f.store.close(); release(); await new Promise<void>(r => setImmediate(r)); await assert.rejects(run()); assert.equal(f.connections(), 0);
});

test('swallowed and parallel read failures poison the whole computation', async () => {
  for (const mode of ['swallowed', 'parallel'] as const) {
    const f = fixture();
    await assert.rejects(withHistoricalOriginalReadWindow(f.store, target, async () => {}, async window => {
      const first = assert.rejects(readHistoricalOriginalWindow(window, config, target));
      if (mode === 'parallel') await assert.rejects(readHistoricalOriginalWindow(window, config, target));
      await first; return 'PRIVATE';
    }));
    assert.equal(f.connections(), 0); f.store.close();
  }
});

test('an unawaited read cannot publish or start late SQL when its held authorization completes', async () => {
  let release!: () => void, calls = 0;
  const held = new Promise<void>(r => { release = r; });
  const f = fixture(async () => { calls++; await held; });
  const result = assert.rejects(withHistoricalOriginalReadWindow(f.store, target, async () => {}, async window => {
    void readHistoricalOriginalWindow(window, config, target).catch(() => {});
    return 'PRIVATE';
  }));
  await new Promise<void>(r => setImmediate(r)); release(); await result;
  assert.equal(calls, 1); assert.equal(f.connections(), 0); f.store.close();
});
