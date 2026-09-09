import assert from 'node:assert/strict';
import test from 'node:test';
import { bracketHistoricalReadAuthority as bracket, forwardHistoricalReadAuthority as forward,
  historicalReadAuthorityCovers as covers } from '../src/historical-read-authority.ts';

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
