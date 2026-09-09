import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadPolicyAuthority } from '../src/read-policy-authority.ts';
import { historicalReadAuthorityCovers } from '../src/historical-read-authority.ts';
import { currentReadAuthorityCovers } from '../src/current-read-authority.ts';

const track = async <T>(work: Promise<T>) => work;
const guard = () => {};
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('metadata queries each run before fresh caller validation, with no grant or bracket-proof reuse', async () => {
  const events: string[] = [], current = async () => { events.push('current'); };
  const authority = createReadPolicyAuthority(current, track, guard);
  const policy = async () => { events.push('policy'); };
  await current(); // owner authenticates before its work, not inside the metadata helper
  await authority('read', policy); await authority('read', policy);
  assert.deepEqual(events, ['current', 'policy', 'current', 'policy', 'current']);
  assert.equal(historicalReadAuthorityCovers(authority, current), false);
  assert.equal(currentReadAuthorityCovers(authority, current), false);
});

test('rejects non-read actions and closed work before policy dispatch', async () => {
  let calls = 0;
  const policy = async () => { calls++; };
  const authority = createReadPolicyAuthority(async () => { calls++; }, track, guard);
  for (const action of ['put', 'write', '', 'READ']) await assert.rejects(authority(action, policy));
  await assert.rejects(createReadPolicyAuthority(async () => {}, track, () => { throw new Error('closed'); })('read', policy));
  let closed = false;
  const pending = createReadPolicyAuthority(async () => {}, track, () => { if (closed) throw new Error('closed'); })('read', policy);
  closed = true; await assert.rejects(pending); assert.equal(calls, 0);
});

test('policy rejection or nonvoid denies before caller continuation; current rejection or nonvoid denies release', async () => {
  let checks = 0;
  const authority = createReadPolicyAuthority(async () => { checks++; }, track, guard);
  await assert.rejects(authority('read', async () => { throw new Error('policy denied'); }), /policy denied/);
  await assert.rejects(authority('read', async () => true as never)); assert.equal(checks, 0);
  await assert.rejects(createReadPolicyAuthority(async () => true as never, track, guard)('read', async () => {}));
  await assert.rejects(createReadPolicyAuthority(async () => { throw new Error('revoked'); }, track, guard)('read', async () => {}), /revoked/);
});

test('early tracker completion still waits for actual policy; closing or late policy failure cannot grant', async () => {
  for (const mode of ['allow', 'close', 'reject'] as const) {
    let release!: () => void, reject!: (error: Error) => void, checks = 0, settled = false, closed = false;
    const held = new Promise<void>((a, b) => { release = a; reject = b; });
    const authority = createReadPolicyAuthority(async () => { checks++; }, async <T>() => undefined as T,
      () => { if (closed) throw new Error('closed'); });
    const result = authority('read', () => held);
    const observed = result.then(() => { settled = true; }, () => { settled = true; });
    await turn(); assert.equal(settled, false); assert.equal(checks, 0);
    if (mode === 'close') closed = true;
    if (mode === 'reject') reject(new Error('late denial')); else release();
    if (mode === 'allow') await result; else await assert.rejects(result);
    await observed; assert.equal(checks, mode === 'allow' ? 1 : 0);
  }
});

test('early tracker rejection observes late work and never invokes current afterward', async () => {
  let reject!: (error: Error) => void, checks = 0;
  const held = new Promise<void>((_, r) => { reject = r; });
  const authority = createReadPolicyAuthority(async () => { checks++; }, async () => { throw new Error('tracker closed'); }, guard);
  await assert.rejects(authority('read', () => held), /tracker closed/);
  reject(new Error('late policy failure')); await turn(); assert.equal(checks, 0);
});

test('closing during fresh caller validation suppresses success', async () => {
  let release!: () => void, closed = false;
  const held = new Promise<void>(resolve => { release = resolve; });
  const authority = createReadPolicyAuthority(() => held, track, () => { if (closed) throw new Error('closed'); });
  const result = authority('read', async () => {}); await turn(); closed = true; release();
  await assert.rejects(result, /closed/);
});
