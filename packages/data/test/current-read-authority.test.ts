import assert from 'node:assert/strict';
import test from 'node:test';
import { bracketCurrentReadAuthority as bracket, forwardCurrentReadAuthority as forward,
  currentReadAuthorityCovers as covers } from '../src/current-read-authority.ts';
import { bracketHistoricalReadAuthority as historical } from '../src/historical-read-authority.ts';
const track = <T>(pending: Promise<T>) => pending;
const guard = () => {};

test('exact current construction is immutable and only genuine forwarding preserves its barrier', async () => {
  const events: string[] = [], current = async () => { events.push('current'); };
  const policy = bracket(current, async (value: string) => { events.push(value); }, track, guard);
  const args: [string] = ['source'], first = forward(policy, args, track, guard), second = forward(first, [], track, guard);
  args[0] = 'changed';
  for (const callback of [policy, first, second]) {
    assert.equal(covers(callback, current), true); assert.equal(Object.isFrozen(callback), true);
    assert.throws(() => Object.defineProperty(callback, 'apply', { value: async () => {} }), TypeError);
  }
  assert.equal(covers(second, async () => current()), false);
  const copied = Object.assign(async () => second(), { current, covered: true });
  for (const callback of [copied, first.bind(null), historical(current, async () => {}, track, guard)]) {
    assert.equal(covers(callback, current), false); assert.equal(covers(forward(callback, [], track, guard), current), false);
  }
  await second(); await second();
  assert.deepEqual(events, ['current', 'source', 'current', 'current', 'source', 'current']);
});

test('intrinsic forwarding preserves the receiver and pinned arguments despite overridden invocation properties', async () => {
  const owner = { calls: 0 }, current = async () => {}; let received = '';
  async function policy(this: typeof owner, value: string) { this.calls++; received = value; }
  Object.defineProperty(policy, 'apply', { value: async () => assert.fail('overridden apply') });
  Object.defineProperty(policy, 'call', { value: async () => assert.fail('overridden call') });
  const callback = forward(policy, ['exact'], track, guard, owner);
  assert.equal(covers(callback, current), false); assert.equal(covers(callback, undefined as never), false);
  await callback(); assert.equal(owner.calls, 1); assert.equal(received, 'exact');
  let calls = 0; const work = async () => { calls++; };
  Object.defineProperty(work, 'apply', { value: async () => assert.fail('overridden policy apply') });
  await bracket(current, work, track, guard)(); assert.equal(calls, 1);
});

test('failed and nonvoid caller or independent policy results deny before another effect', async () => {
  for (const failure of ['first', 'last', 'caller-nonvoid', 'policy', 'policy-nonvoid']) {
    let checks = 0, policies = 0, effects = 0;
    const current = async () => {
      checks++; if ((failure === 'first' && checks === 1) || (failure === 'last' && checks === 2)) throw new Error('denied');
      if (failure === 'caller-nonvoid') return false as unknown as void;
    };
    const callback = bracket(current, async () => { policies++; if (failure === 'policy') throw new Error('denied');
      if (failure === 'policy-nonvoid') return true; }, track, guard);
    await assert.rejects((async () => { await forward(callback, [], track, guard)(); effects++; })());
    assert.equal(effects, 0); assert.equal(policies, failure === 'first' || failure === 'caller-nonvoid' ? 0 : 1);
  }
  await assert.rejects(forward(async () => true, [], track, guard)());
});

test('owner closure prevents forwarded work before dispatch and after held policy completion', async () => {
  let closed = true, calls = 0, release!: () => void, started!: () => void;
  const held = new Promise<void>(r => { release = r; }), reached = new Promise<void>(r => { started = r; });
  const ownerGuard = () => { if (closed) throw new Error('closed'); };
  const callback = forward(bracket(async () => {}, async () => { calls++; started(); await held; }, track, ownerGuard), [], track, ownerGuard);
  await assert.rejects(callback()); assert.equal(calls, 0);
  closed = false; const pending = callback(); await reached; closed = true; release();
  await assert.rejects(pending); assert.equal(calls, 1);
});

test('premature owner tracking cannot bypass actual policy completion or its nonvoid result', async () => {
  let release!: () => void, completed = false;
  const held = new Promise<void>(r => { release = r; }), premature = (async () => undefined) as typeof track;
  const pending = forward(bracket(async () => {}, () => held, premature, guard), [], premature, guard)().then(() => { completed = true; });
  await new Promise(r => setImmediate(r)); assert.equal(completed, false); release(); await pending; assert.equal(completed, true);
  await assert.rejects(forward(bracket(async () => {}, async () => true, premature, guard), [], premature, guard)());
});

test('owner tracker failure denies and observes the actual late policy rejection', async () => {
  for (const form of ['bracket', 'forward']) {
    let reject!: (reason: Error) => void;
    const held = new Promise<void>((_, r) => { reject = r; });
    const failed = (() => { throw new Error('owner expired'); }) as typeof track;
    const callback = form === 'bracket' ? bracket(async () => {}, () => held, failed, guard) : forward(() => held, [], failed, guard);
    await assert.rejects(callback(), { message: 'owner expired' }); reject(new Error('late failed policy'));
    await new Promise(r => setImmediate(r));
  }
});
