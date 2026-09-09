import assert from 'node:assert/strict';
import test from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createIntentPerformanceProbe as probe, summarizeIntentPerformance as summarize } from './intent-performance-probe.ts';

test('synthetic probe enforces the combined provider-attempt budget without retaining private request data', async () => {
  const p = probe({ delayMs: 0, maxAttempts: 2 }); let calls = 0;
  const fetch = p.wrap(async () => { calls++; return Response.json({ private: 'PRIVATE response' }); });
  const run = await p.measure(async () => { for (let i = 0; i < 3; i++) await fetch('https://private.invalid/SECRET'); });
  assert.ok(run.error); assert.equal(calls, 2); assert.equal(run.sample.attempts, 3);
  assert.equal(run.sample.dispatched, 2); assert.equal(run.sample.limited, true);
  assert.doesNotMatch(JSON.stringify(run.sample), /PRIVATE|SECRET|invalid|Error/);
  await fetch('outside-measurement'); assert.equal(calls, 3);
});

test('concurrent samples have isolated counters, independent budgets and no cross-request result cache', async () => {
  const p = probe({ delayMs: 1, maxAttempts: 3 }); let calls = 0;
  const fetch = p.wrap(async () => { calls++; return new Response(); });
  const results = await Promise.all([1, 2, 3, 4].map(count => p.measure(async () => {
    for (let i = 0; i < count; i++) await fetch('https://synthetic.invalid');
  })));
  assert.deepEqual(results.map(r => r.sample.attempts), [1, 2, 3, 4]);
  assert.deepEqual(results.map(r => r.sample.dispatched), [1, 2, 3, 3]); assert.equal(calls, 9);
  assert.deepEqual(results.map(r => r.sample.limited), [false, false, false, true]);
});

test('caller abort, unawaited work and a retained closed context cannot dispatch after return', async () => {
  const p = probe({ delayMs: 20, maxAttempts: 2 }); let calls = 0, late!: () => Promise<Response>;
  const fetch = p.wrap(async () => { calls++; return new Response(); });
  const abort = new AbortController(); abort.abort();
  const denied = await p.measure(() => fetch('https://synthetic.invalid', { signal: abort.signal }));
  assert.ok(denied.error); assert.equal(calls, 0);
  let pending!: Promise<Response>;
  const early = await p.measure(async () => {
    pending = fetch('https://synthetic.invalid'); void pending.catch(() => {});
    late = AsyncLocalStorage.bind(() => fetch('https://synthetic.invalid'));
  });
  assert.equal(early.sample.outstandingAtReturn, 1); await assert.rejects(pending);
  await assert.rejects(late()); assert.equal(calls, 0);
});

test('underlying transport errors retain identity and malformed bounds are rejected', async () => {
  const error = new Error('PRIVATE transport failure'), p = probe({ delayMs: 0, maxAttempts: 2 });
  const result = await p.measure(() => p.wrap(async () => { throw error; })('synthetic'));
  assert.equal(result.error, error); assert.equal(result.sample.returned, false); assert.equal(result.sample.dispatched, 1);
  assert.equal((await p.measure(async () => { throw undefined; })).sample.returned, false);
  for (const value of [-1, 21, NaN, 0.5]) assert.throws(() => probe({ delayMs: value, maxAttempts: 2 }));
  for (const value of [0, 201, NaN, 0.5]) assert.throws(() => probe({ delayMs: 0, maxAttempts: value }));
});

test('p95 uses nearest rank and never drops failed, limited, incomplete or undrained samples', () => {
  const sample = { ms: 1, attempts: 32, dispatched: 32, peakPending: 1, outstandingAtReturn: 0,
    limited: false, delayMs: 20, maxAttempts: 200, returned: true };
  const samples = Array.from({ length: 20 }, (_, i) => ({ ...sample, ms: i + 1 })), successes = samples.map(() => true);
  assert.equal(summarize(samples, 20, successes).p95Ms, 19);
  assert.equal(summarize(samples, 20, successes).withinTarget, true);
  const detached = summarize([sample], 1, [true]); sample.ms = 5001;
  assert.equal(detached.samples[0]!.ms, 1); assert.ok(Object.isFrozen(detached.samples[0])); sample.ms = 1;
  assert.equal(summarize(samples.slice(1), 20, successes.slice(1)).p95Ms, null);
  for (const patch of [{ limited: true }, { returned: false }, { outstandingAtReturn: 1 }, { delayMs: 0 }, { maxAttempts: 2 }, { attempts: 201 }, { dispatched: 33 }, { attempts: NaN }]) {
    const result = summarize([{ ...sample, ...patch }], 1, [true]);
    assert.equal(result.healthy, false); assert.equal(result.p95Ms, null); assert.equal(result.withinTarget, false);
  }
  assert.equal(summarize([sample], 1, [false]).withinTarget, false);
  assert.equal(summarize([{ ...sample, ms: 5001 }], 1, [true]).withinTarget, false);
  assert.throws(() => summarize(samples, 19, successes));
});
