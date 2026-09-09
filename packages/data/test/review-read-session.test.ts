import assert from 'node:assert/strict';
import test from 'node:test';
import { registerReviewReadSession, withReviewReadSession } from '../src/review-read-session.ts';

const current = async () => {};
const track = <T>(pending: Promise<T>) => pending;
const guard = () => {};
const reader = () => ({ scope: { subject: 'human', repository: 'github:1' },
  review: async (_input: unknown, check: () => Promise<void>) => { await check(); return 'ordinary'; } });

test('unregistered or marker-bearing readers retain ordinary invocation and receiver', async () => {
  const port = reader(); let calls = 0;
  Object.assign(port, { readSession: true });
  port.review = async function (_input, check) { assert.equal(this, port); calls++; await check(); return 'ordinary'; };
  await withReviewReadSession(port, {}, current, async read => {
    assert.equal(await read(current), 'ordinary'); assert.equal(await read(current), 'ordinary');
  }, track, guard);
  assert.equal(calls, 2);
});
test('only the exact constructed method and scope can share a read-only session', async () => {
  const port = reader(); let windows = 0;
  registerReviewReadSession(port.review, port.scope, async (_input, check, work) => {
    windows++; await check(); await work(async present => { await present(); return 'shared'; }); await check();
  });
  const wrapper = { scope: port.scope, review: port.review };
  for (let i = 0; i < 2; i++) await withReviewReadSession(wrapper, {}, current, async read => {
    assert.equal(await read(current), 'shared'); assert.equal(await read(current), 'shared');
  }, track, guard);
  assert.equal(windows, 2, 'separate requests must not reuse the enclosing session');
  const copied = { ...port, review: port.review.bind(port) };
  await withReviewReadSession(copied, {}, current, async read => { assert.equal(await read(current), 'ordinary'); }, track, guard);
  assert.equal(windows, 2);
  await assert.rejects(withReviewReadSession({ ...port, scope: { ...port.scope, subject: 'other' } }, {}, current,
    async read => { await read(current); }, track, guard));
  assert.throws(() => registerReviewReadSession(port.review, port.scope, async () => {}));
});
test('changed scope, method, caller and owner state invalidate the whole session', async () => {
  for (const mode of ['scope', 'method', 'caller', 'owner', 'nonvoid-caller']) {
    const port = reader(); let valid = true;
    const check = async () => { if (!valid) throw new Error('revoked'); };
    await assert.rejects(withReviewReadSession(port, {}, check, async read => {
      await read(current);
      if (mode === 'scope') port.scope.subject = 'other';
      if (mode === 'method') port.review = async () => 'replacement';
      if (mode === 'caller' || mode === 'owner') valid = false;
      if (mode === 'nonvoid-caller') await read(async () => 'forged' as unknown as void);
    }, track, () => { if (mode === 'owner' && !valid) throw new Error('closed'); }));
  }
});
test('skipped, empty, replayed, premature and nonvoid constructed windows cannot release results', async () => {
  for (const mode of ['skip', 'empty', 'replay', 'early', 'nonvoid']) {
    const port = reader(); let later: Promise<void> | undefined;
    registerReviewReadSession(port.review, port.scope, async (_input, _check, work) => {
      if (mode === 'skip') return;
      if (mode === 'early') { later = work(async () => 'shared'); return; }
      await work(async () => 'shared');
      if (mode === 'replay') await work(async () => 'shared').catch(() => {});
      if (mode === 'nonvoid') return 'forged' as unknown as void;
    });
    await assert.rejects(withReviewReadSession(port, {}, current, async read => {
      if (mode !== 'empty') await read(current);
    }, track, guard));
    if (later) await later.catch(() => {});
  }
});
test('swallowed read errors, overlapping reads and unawaited reads poison the session', async () => {
  for (const mode of ['swallowed', 'overlap', 'unawaited', 'nonvoid-work']) {
    const port = reader(); let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let pending: Promise<unknown> | undefined;
    port.review = async (_input, check) => { await check(); if (mode === 'swallowed') throw new Error('denied'); await held; return 'ordinary'; };
    const result = withReviewReadSession(port, {}, current, async read => {
      pending = read(current);
      if (mode === 'swallowed') { await pending.catch(() => {}); return; }
      if (mode === 'overlap') { await read(current).catch(() => {}); release(); await pending.catch(() => {}); return; }
      if (mode === 'unawaited') return;
      release(); await pending; return 'forged' as unknown as void;
    }, track, guard);
    await assert.rejects(result); release(); if (pending) await pending.catch(() => {});
  }
});
test('early or forged trackers cannot substitute for actual dependency completion', async () => {
  const port = reader(); let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  port.review = async () => { entered(); await held; return 'real'; };
  let done = false;
  const result = withReviewReadSession(port, {}, current, async read => { assert.equal(await read(current), 'real'); },
    async <T>(_pending: Promise<T>) => undefined as T, guard).then(() => { done = true; });
  await started; await Promise.resolve(); assert.equal(done, false); release(); await result;
  await assert.rejects(withReviewReadSession(reader(), {}, current, async read => { await read(current); },
    async <T>(pending: Promise<T>) => { await pending; return 'forged' as T; }, guard));
});
test('tracker rejection closes the window while its owner retains the actual held task', async () => {
  const port = reader(); let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const owned = new Set<Promise<unknown>>(); let alive = true;
  port.review = async (_input, check) => { entered(); await held; await check(); return 'late'; };
  const result = withReviewReadSession(port, {}, current, async read => { await read(current); },
    async <T>(pending: Promise<T>) => {
      owned.add(pending); void pending.finally(() => owned.delete(pending)).catch(() => {});
      await started; if (!alive) throw new Error('closed'); alive = false; throw new Error('closed');
    }, guard);
  await assert.rejects(result); assert.ok(owned.size > 0);
  release(); await Promise.allSettled([...owned]); assert.equal(owned.size, 0);
});
