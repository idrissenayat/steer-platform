import assert from 'node:assert/strict';
import test from 'node:test';
import { bracketHistoricalReadAuthority as bracket, forwardHistoricalReadAuthority as forward,
  historicalReadAuthorityCovers as covers, bracketHistoricalReadPolicyAuthority as metadata,
  historicalReadPolicyQuery as query } from '../src/historical-read-authority.ts';

const track = <T>(pending: Promise<T>) => pending;
const guard = () => {};

test('private proof belongs to the exact caller function and survives only constructed forwarding', async () => {
  const events: string[] = [], current = async () => { events.push('current'); };
  const policy = bracket(current, async (value: string) => { events.push(value); }, track, guard);
  const args: [string] = ['source'];
  const first = forward(policy, args, track, guard), second = forward(first, [], track, guard);
  args[0] = 'replaced argument'; // Forwarding owns its argument list, not the caller's mutable array.
  assert.equal(covers(policy, current), true); assert.equal(covers(first, current), true); assert.equal(covers(second, current), true);
  assert.equal(covers(second, async () => current()), false);
  const copied = Object.assign(async () => second(), { current, covered: true });
  assert.equal(covers(copied, current), false); assert.equal(covers(forward(copied, [], track, guard), current), false);
  await second(); assert.deepEqual(events, ['current', 'source', 'current']);
  await second(); assert.deepEqual(events, ['current', 'source', 'current', 'current', 'source', 'current']);
  assert.deepEqual(Object.keys(policy), []); assert.deepEqual(Object.keys(second), []);
});

test('forwarding unrecognized authority never creates proof or skips its actual callback', async () => {
  const owner = { calls: 0 }, current = async () => {};
  async function source(this: typeof owner) { this.calls++; }
  const callback = forward(source, [], track, guard, owner);
  assert.equal(covers(callback, current), false); await callback(); assert.equal(owner.calls, 1);
  assert.equal(covers(callback, undefined as any), false);
});

test('nonvoid, failed and late revoked caller or policy outcomes cannot be proven successful', async () => {
  for (const failure of ['caller-first', 'caller-last', 'caller-nonvoid', 'policy-fails', 'policy-nonvoid']) {
    let checks = 0, calls = 0;
    const current = async () => {
      checks++;
      if ((failure === 'caller-first' && checks === 1) || (failure === 'caller-last' && checks === 2)) throw new Error('PRIVATE denied');
      if (failure === 'caller-nonvoid') return true as any;
    };
    const callback = bracket(current, async () => { calls++; if (failure === 'policy-fails') throw new Error('PRIVATE policy');
      if (failure === 'policy-nonvoid') return true; }, track, guard);
    await assert.rejects(forward(callback, [], track, guard)());
    assert.equal(calls, failure === 'caller-first' || failure === 'caller-nonvoid' ? 0 : 1);
  }
  await assert.rejects(forward(async () => true, [], track, guard)());
});

test('owner guards stop forwarded work before dispatch and after a delayed policy completes', async () => {
  let closed = true, calls = 0, finish!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  const ownerGuard = () => { if (closed) throw new Error('Owner closed'); };
  const callback = bracket(async () => {}, async () => { calls++; await held; }, track, ownerGuard);
  const bound = forward(callback, [], track, ownerGuard);
  await assert.rejects(bound()); assert.equal(calls, 0);
  closed = false; const pending = bound();
  for (let i = 0; i < 20 && calls === 0; i++) await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(calls, 1); closed = true; finish(); await assert.rejects(pending);
});

test('a prematurely resolving tracker cannot skip the actual pending policy or hide its nonvoid result', async () => {
  let finish!: () => void, done = false;
  const held = new Promise<void>(resolve => { finish = resolve; });
  const premature = (async () => undefined) as typeof track;
  const callback = bracket(async () => {}, async () => { await held; }, premature, guard);
  const pending = forward(callback, [], premature, guard)().then(() => { done = true; });
  await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(done, false);
  finish(); await pending; assert.equal(done, true);
  await assert.rejects(forward(bracket(async () => {}, async () => true, premature, guard), [], premature, guard)());
});

test('tracker failure remains a denial and observes the actual policy rejection after the owner returns', async () => {
  for (const construction of ['bracket', 'forward']) {
    let reject!: (reason: Error) => void;
    const held = new Promise<void>((_, fail) => { reject = fail; });
    const failedTracker = (() => { throw new Error('Owner expired'); }) as typeof track;
    const callback = construction === 'bracket'
      ? bracket(async () => {}, () => held, failedTracker, guard)
      : forward(() => held, [], failedTracker, guard);
    await assert.rejects(callback(), { message: 'Owner expired' });
    reject(new Error('Late policy rejection'));
    await new Promise<void>(resolve => setImmediate(resolve));
  }
});

test('only explicitly constructed metadata policies permit one post-policy caller check', async () => {
  const events: string[] = [], current = async () => { events.push('current'); };
  const policy = metadata(current, async (value: string) => { events.push(value); }, track, guard);
  const first = forward(policy, ['source'], track, guard), second = forward(first, [], track, guard);
  await second(); assert.deepEqual(events, ['current', 'source', 'current']); events.length = 0;
  await query(second, current)!(); assert.deepEqual(events, ['source', 'current']);
  await query(second, current)!(); assert.deepEqual(events, ['source', 'current', 'source', 'current']);
  assert.equal(query(second, async () => current()), undefined);
  assert.equal(query(Object.assign(async () => second(), { current, metadata: true }), current), undefined);
  assert.equal(query(forward(bracket(current, async () => {}, track, guard), [], track, guard), current), undefined);
  assert.deepEqual(Object.keys(second), []);
});

test('metadata forwarding pins arguments and receiver and keeps every owner guard', async () => {
  let closed = false, checks = 0; const args: [string] = ['source'], seen: string[] = [];
  const current = async () => { checks++; };
  const callback = metadata(current, async value => { seen.push(value as string); }, track, guard);
  const source = forward(forward(callback, args, track, guard), [], track, () => { if (closed) throw new Error('closed'); });
  args[0] = 'changed'; await query(source, current)!(); assert.deepEqual(seen, ['source']); assert.equal(checks, 1);
  closed = true; await assert.rejects(query(source, current)!()); assert.deepEqual(seen, ['source']);
});

test('historical forwarding invokes the intrinsic callback despite overridden apply properties', async () => {
  const owner = { calls: 0 };
  async function source(this: typeof owner, value: number) { this.calls += value; }
  Object.assign(source, { apply: async () => { throw new Error('forged invocation'); } });
  await forward(source, [2], track, guard, owner)(); assert.equal(owner.calls, 2);
  const current = async () => {}, callback = metadata(current, async () => { owner.calls++; }, track, guard);
  Object.assign(callback, { apply: async () => { throw new Error('forged invocation'); } });
  const wrapped = forward(callback, [], track, guard);
  await wrapped(); await query(wrapped, current)!(); assert.equal(owner.calls, 4);
});

test('metadata query cannot publish after nonvoid or revoked policy/caller outcomes', async () => {
  for (const failure of ['policy', 'policy-nonvoid', 'caller', 'caller-nonvoid']) {
    let checks = 0, allowed = true;
    const current = async () => { checks++; if (!allowed) throw new Error('revoked'); if (failure === 'caller-nonvoid') return true as never; };
    const callback = metadata(current, async () => {
      if (failure === 'policy') throw new Error('denied');
      if (failure === 'policy-nonvoid') return true;
      if (failure === 'caller') allowed = false;
    }, track, guard);
    await assert.rejects(query(forward(callback, [], track, guard), current)!());
    assert.equal(checks, failure.startsWith('policy') ? 0 : 1);
  }
});

test('metadata query tracks actual held policy work and rejects after owner closure', async () => {
  let finish!: () => void, entered!: () => void, closed = false, done = false, checks = 0;
  const held = new Promise<void>(resolve => { finish = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const premature = (async () => undefined) as typeof track;
  const current = async () => { checks++; };
  const callback = metadata(current, async () => { entered(); await held; }, premature, () => { if (closed) throw new Error('closed'); });
  const pending = query(forward(callback, [], premature, guard), current)!().then(() => { done = true; });
  void pending.catch(() => {}); await started; assert.equal(done, false); closed = true; finish();
  await assert.rejects(pending); assert.equal(done, false); assert.equal(checks, 0);
});

test('metadata query observes late policy failure after a tracker rejects', async () => {
  for (const layer of ['policy', 'forward']) {
    let reject!: (error: Error) => void;
    const held = new Promise<void>((_, fail) => { reject = fail; });
    const failed = (() => { throw new Error('expired'); }) as typeof track, current = async () => {};
    const callback = metadata(current, () => held, layer === 'policy' ? failed : track, guard);
    await assert.rejects(query(forward(callback, [], layer === 'forward' ? failed : track, guard), current)!());
    reject(new Error('late policy failure')); await new Promise<void>(resolve => setImmediate(resolve));
  }
});
