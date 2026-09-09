import assert from 'node:assert/strict';
import test from 'node:test';
import { withPreparationEvidence, type PreparationEvidenceWindow } from '../src/preparation-evidence-window.ts';

function owner() {
  let active = 0, closed = false;
  return { count: () => active, close: () => { closed = true; },
    guard: () => { if (closed) throw new Error('owner closed'); },
    track: async <T>(pending: Promise<T>) => { active++; try { return await pending; } finally { active--; } } };
}
const held = () => { let release!: () => void; const promise = new Promise<void>(r => { release = r; }); return { promise, release }; };

test('each validation window finishes before effects and the fallback remains unchanged', async () => {
  const o = owner(), events: string[] = []; let open = false;
  const window: PreparationEvidenceWindow = async work => {
    assert.equal(open, false); open = true; events.push('open');
    try { await work(async () => { assert.equal(open, true); events.push('read'); return 'exact'; }); }
    finally { open = false; events.push('close'); }
  };
  for (let i = 0; i < 2; i++) {
    await withPreparationEvidence(window, async () => assert.fail('fallback'), async read => {
      assert.equal(await read(), 'exact'); events.push('policy'); assert.equal(await read(), 'exact');
    }, o.track, o.guard);
    assert.equal(open, false); events.push('effect');
  }
  assert.deepEqual(events, Array.from({ length: 2 }, () => ['open', 'read', 'policy', 'read', 'close', 'effect']).flat());
  let reads = 0;
  await withPreparationEvidence(undefined, async () => ++reads, async read => { assert.equal(await read(), 1); assert.equal(await read(), 2); }, o.track, o.guard);
  assert.equal(o.count(), 0);
});

test('skipped, replayed and nonvoid window completion cannot authorize a following effect', async () => {
  const read = async () => 'exact';
  const windows: PreparationEvidenceWindow[] = [async () => {}, async work => { await work(read); await work(read).catch(() => {}); },
    async work => { await work(read); return true as unknown as void; }];
  for (const window of windows) {
    const o = owner(); let effects = 0;
    await assert.rejects((async () => { await withPreparationEvidence(window, read, async source => { await source(); }, o.track, o.guard); effects++; })());
    assert.equal(effects, 0); assert.equal(o.count(), 0);
  }
});

test('early wrapper completion rejects and retains actual work ownership until it drains', async () => {
  const o = owner(), gate = held(), started = held(); let escaped!: () => Promise<unknown>;
  const pending = withPreparationEvidence(async work => { void work(async () => 'exact'); await started.promise; }, async () => 'unused', async read => {
    escaped = read; started.release(); await gate.promise; await read();
  }, o.track, o.guard);
  await assert.rejects(pending); assert.ok(o.count() > 0);
  gate.release(); await new Promise(r => setImmediate(r)); assert.equal(o.count(), 0);
  await assert.rejects(escaped()); assert.equal(o.count(), 0);
});

test('swallowed read/work failures and overlapping reads remain poisoned', async () => {
  for (const mode of ['read', 'work', 'overlap', 'nonvoid'] as const) {
    const o = owner(), gate = held(), started = held();
    const window: PreparationEvidenceWindow = async work => { await work(async () => {
      if (mode === 'read') throw new Error('source failed');
      if (mode === 'overlap') { started.release(); await gate.promise; }
      return 'exact';
    }).catch(() => {}); };
    await assert.rejects(withPreparationEvidence(window, async () => 'unused', async read => {
      if (mode === 'work') throw new Error('failed');
      if (mode === 'nonvoid') return false as unknown as void;
      if (mode === 'overlap') {
        const first = read(); void first.catch(() => {}); await started.promise;
        await assert.rejects(read()); gate.release(); await assert.rejects(first);
      } else await read().catch(() => {});
    }, o.track, o.guard));
    assert.equal(o.count(), 0);
  }
});

test('unawaited reads withhold validation and keep pending ownership until the source settles', async () => {
  const o = owner(), gate = held(), started = held();
  await assert.rejects(withPreparationEvidence(async work => { await work(async () => { started.release(); await gate.promise; return 'exact'; }); },
    async () => 'unused', async read => { void read(); await started.promise; }, o.track, o.guard));
  assert.ok(o.count() > 0); gate.release(); await new Promise(r => setImmediate(r)); assert.equal(o.count(), 0);
});

test('late owner closure and escaped callbacks cannot read or publish after their window ends', async () => {
  const o = owner(); let escaped!: () => Promise<unknown>, callback!: Parameters<PreparationEvidenceWindow>[0], reads = 0;
  await withPreparationEvidence(async work => { callback = work; await work(async () => { reads++; return 'exact'; }); },
    async () => 'unused', async read => { escaped = read; await read(); }, o.track, o.guard);
  await assert.rejects(escaped()); await assert.rejects(callback(async () => { reads++; })); assert.equal(reads, 1);
  await assert.rejects(withPreparationEvidence(async work => { await work(async () => { o.close(); return 'exact'; }); },
    async () => 'unused', async read => { await read(); }, o.track, o.guard));
  assert.equal(o.count(), 0);
});

test('a source-conflict identity survives a sanitizing window without turning failure into permission', async () => {
  const o = owner(), conflict = new Error('owner conflict');
  await assert.rejects(withPreparationEvidence(async work => {
    try { await work(async () => 'exact'); } catch { throw new Error('sanitized window failure'); }
  }, async () => 'unused', async read => { await read(); throw conflict; }, o.track, o.guard), error => error === conflict);
  assert.equal(o.count(), 0);
});
