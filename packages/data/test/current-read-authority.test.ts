import assert from 'node:assert/strict';
import test from 'node:test';
import { bracketCurrentReadAuthority as bracket, forwardCurrentReadAuthority as forward,
  currentReadAuthorityCovers as covers, bracketCurrentReadPolicyAuthority as metadata,
  currentReadPolicyQuery as query, registerCurrentReadPolicyOwner as register,
  combineCurrentReadPolicyQueries as combine } from '../src/current-read-authority.ts';
import { bracketHistoricalReadAuthority as historical, bracketHistoricalReadPolicyAuthority as historicalMetadata } from '../src/historical-read-authority.ts';
const track = <T>(pending: Promise<T>) => pending;
const guard = () => {};

test('combined exact-parent queries run both independent purposes then one fresh caller, without caching', async () => {
  const events: string[] = [], current = async () => { events.push('current'); };
  const ownerPolicy = async () => { events.push('owner'); };
  const owner = async () => { await current(); await ownerPolicy(); };
  register(owner, current, ownerPolicy, guard);
  const child = forward(metadata(current, async (value: string) => { events.push(value); }, track, guard), ['child'], track, guard);
  const combined = combine(owner, query(child, current)!)!;
  assert.equal(Object.isFrozen(combined), true); assert.equal(covers(owner, current), false);
  for (let n = 0; n < 2; n++) await combined();
  assert.deepEqual(events, ['owner', 'child', 'current', 'owner', 'child', 'current']);
  events.length = 0; await owner(); await child();
  assert.deepEqual(events, ['current', 'owner', 'current', 'child', 'current']);
  assert.throws(() => register(owner, current, ownerPolicy, guard));
  assert.throws(() => register(current, current, ownerPolicy, guard));
});

test('composition cannot infer policy or shared-parent identity from generic, copied, bound or historical callbacks', async () => {
  const current = async () => {}, owner = metadata(current, async () => {}, track, guard);
  for (const other of [current, async () => owner(), owner.bind(null), Object.assign(async () => {}, { current, policy: owner }),
    bracket(current, async () => {}, track, guard), historicalMetadata(current, async () => {}, track, guard),
    metadata(async () => current(), async () => {}, track, guard)]) {
    assert.equal(combine(owner, other), undefined); assert.equal(combine(other, owner), undefined);
    assert.equal(combine(owner, forward(other, [], track, guard)), undefined);
  }
  assert.equal(combine(undefined as never, owner), undefined);
});

test('combined permission denial, nonvoid results, parent revocation and late owner closure never release a value', async () => {
  for (const mode of ['owner-deny', 'owner-nonvoid', 'child-deny', 'child-nonvoid', 'parent-deny', 'parent-nonvoid', 'owner-close', 'child-close']) {
    let allowed = true, ownerClosed = false, childClosed = false, received = false, parents = 0;
    const current = async () => { parents++; if (!allowed) throw new Error('parent revoked');
      if (mode === 'parent-nonvoid') return true as never;
      if (mode === 'owner-close') ownerClosed = true; if (mode === 'child-close') childClosed = true; };
    const owner = metadata(current, async () => {
      if (mode === 'owner-deny') throw new Error('owner denied'); if (mode === 'owner-nonvoid') return true;
    }, track, () => { if (ownerClosed) throw new Error('owner closed'); });
    const child = metadata(current, async () => {
      if (mode === 'child-deny') throw new Error('child denied'); if (mode === 'child-nonvoid') return true;
      if (mode === 'parent-deny') allowed = false;
    }, track, () => { if (childClosed) throw new Error('child closed'); });
    await assert.rejects((async () => { await combine(owner, child)!(); received = true; })());
    assert.equal(received, false); assert.equal(parents, mode.startsWith('owner-') && mode !== 'owner-close'
      || mode.startsWith('child-') && mode !== 'child-close' ? 0 : 1);
  }
});

test('composed forwarding retains exact arguments, all guards and actual drainage despite premature bookkeeping', async () => {
  let release!: () => void, entered!: () => void, closed = false, completed = false, parents = 0;
  const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
  const current = async () => { parents++; }, premature = (async () => undefined) as typeof track;
  const first = metadata(current, async () => {}, track, guard);
  const args: [string] = ['exact'];
  const child = forward(metadata(current, async (value: string) => { assert.equal(value, 'exact'); entered(); await held; }, premature, guard),
    args, premature, () => { if (closed) throw new Error('closed'); }); args[0] = 'changed';
  const result = combine(first, query(child, current)!)!().then(() => { completed = true; }); void result.catch(() => {});
  await reached; await new Promise(resolve => setImmediate(resolve)); assert.equal(completed, false);
  closed = true; release(); await assert.rejects(result); assert.equal(parents, 0);
});

test('nested composition keeps every distinct policy and one parent, without granting a different current authority', async () => {
  const events: string[] = [], current = async () => { events.push('current'); };
  const make = (name: string) => metadata(current, async () => { events.push(name); }, track, guard);
  const joined = combine(make('a'), make('b'))!;
  await combine(forward(query(joined, current)!, [], track, guard), make('c'))!();
  assert.deepEqual(events, ['a', 'b', 'c', 'current']);
  assert.equal(query(joined, async () => current()), undefined);
});

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

test('only exact current permission construction and forwarding select metadata queries without caching decisions', async () => {
  const events: string[] = [], current = async () => { events.push('current'); };
  const callback = metadata(current, async (value: string) => { events.push(value); }, track, guard);
  const args: [string] = ['source'], first = forward(callback, args, track, guard), second = forward(first, [], track, guard);
  args[0] = 'changed';
  await second(); assert.deepEqual(events, ['current', 'source', 'current']); events.length = 0;
  const permitted = query(second, current)!;
  assert.equal(Object.isFrozen(permitted), true); await permitted(); await permitted();
  assert.deepEqual(events, ['source', 'current', 'source', 'current']);
  assert.equal(query(second, async () => current()), undefined);
  assert.equal(query(async () => {}, undefined as never), undefined);
  assert.equal(query(undefined as never, undefined as never), undefined);
  for (const other of [async () => second(), second.bind(null), Object.assign(async () => second(), { current, metadata: true }),
    bracket(current, async () => {}, track, guard), historicalMetadata(current, async () => {}, track, guard)]) {
    assert.equal(query(other, current), undefined); assert.equal(query(forward(other, [], track, guard), current), undefined);
  }
  assert.equal(covers(second, current), true); assert.deepEqual(Object.keys(second), []);
});

test('current metadata forwarding retains every owner guard and intrinsic invocation', async () => {
  let closed = false, calls = 0, currents = 0; const current = async () => { currents++; };
  const policy = async (value: string) => { assert.equal(value, 'exact'); calls++; };
  Object.assign(policy, { apply: async () => assert.fail('forged policy apply') });
  const made = metadata(current, policy, track, guard);
  assert.throws(() => Object.defineProperty(made, 'apply', { value: async () => {} }), TypeError);
  const wrapped = forward(forward(made, ['exact'], track, guard), [], track, () => { if (closed) throw new Error('closed'); });
  await query(wrapped, current)!(); assert.equal(calls, 1); assert.equal(currents, 1);
  closed = true; await assert.rejects(query(wrapped, current)!()); assert.equal(calls, 1);
});

test('current metadata queries reject failed/nonvoid policy or caller before any continuation', async () => {
  for (const failure of ['policy', 'policy-nonvoid', 'caller', 'caller-nonvoid']) {
    let allowed = true, currents = 0, effects = 0;
    const current = async () => { currents++; if (!allowed) throw new Error('revoked'); if (failure === 'caller-nonvoid') return true as never; };
    const made = metadata(current, async () => {
      if (failure === 'policy') throw new Error('denied');
      if (failure === 'policy-nonvoid') return true;
      if (failure === 'caller') allowed = false;
    }, track, guard);
    await assert.rejects((async () => { await query(forward(made, [], track, guard), current)!(); effects++; })());
    assert.equal(effects, 0); assert.equal(currents, failure.startsWith('policy') ? 0 : 1);
  }
});

test('current metadata keeps actual held work despite premature trackers and late closure', async () => {
  let entered!: () => void, release!: () => void, closed = false, returned = false, currents = 0;
  const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
  const premature = (async () => undefined) as typeof track, current = async () => { currents++; };
  const made = metadata(current, async () => { entered(); await held; }, premature, () => { if (closed) throw new Error('closed'); });
  const work = query(forward(made, [], premature, guard), current)!().then(() => { returned = true; }); void work.catch(() => {});
  await reached; assert.equal(returned, false); closed = true; release(); await assert.rejects(work); assert.equal(currents, 0);
});

test('current metadata observes late rejection after either owner tracker fails', async () => {
  for (const layer of ['policy', 'forward']) {
    let reject!: (error: Error) => void; const held = new Promise<void>((_, fail) => { reject = fail; });
    const failed = (() => { throw new Error('expired'); }) as typeof track, current = async () => {};
    const made = metadata(current, () => held, layer === 'policy' ? failed : track, guard);
    await assert.rejects(query(forward(made, [], layer === 'forward' ? failed : track, guard), current)!());
    reject(new Error('late failure')); await new Promise(resolve => setImmediate(resolve));
  }
});
