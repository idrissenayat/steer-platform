import assert from 'node:assert/strict';
import test from 'node:test';
import { bracketRepositoryRead, repositoryReadCovers } from '../src/code-host/repository-read-authority.ts';

test('private repository-read proof covers only exact constructed function and current callback identities', async () => {
  const events: string[] = [], value = Object.freeze({ bytes: 'source' });
  const current = async () => { events.push('current'); };
  const work = async function (this: unknown, path: string, revision: string): Promise<typeof value> {
    assert.strictEqual(this, owner); assert.equal(path, 'path'); assert.equal(revision, 'revision');
    events.push('read'); return value;
  };
  const owner = { read: bracketRepositoryRead(current, work, () => { events.push('guard'); }) };
  assert.equal(repositoryReadCovers(owner.read, current), true);
  assert.equal(repositoryReadCovers(work, current), false);
  assert.equal(repositoryReadCovers(owner.read.bind(owner), current), false);
  assert.equal(repositoryReadCovers(Object.assign(async () => {}, owner.read), current), false);
  assert.equal(repositoryReadCovers(owner.read, async () => current()), false);
  assert.ok(Object.isFrozen(owner.read));
  assert.throws(() => Object.defineProperty(owner.read, 'call', { value: async () => 'forged' }));
  assert.throws(() => Object.defineProperty(owner.read, 'apply', { value: async () => 'forged' }));
  for (let i = 0; i < 2; i++) assert.strictEqual(await owner.read('path', 'revision'), value);
  assert.deepEqual(events, [...Array(2)].flatMap(() => ['guard', 'current', 'guard', 'read', 'guard', 'current', 'guard']));
});

test('pre-read denial, nonvoid policy and expired owner block read dispatch', async () => {
  for (const mode of ['deny', 'nonvoid', 'expired'] as const) {
    let calls = 0;
    const current = async () => { if (mode === 'deny') throw new Error('denied'); return mode === 'nonvoid' ? false as unknown as void : undefined; };
    const read = bracketRepositoryRead(current, async () => { calls++; }, () => { if (mode === 'expired') throw new Error('closed'); });
    await assert.rejects(read()); assert.equal(calls, 0);
  }
});

test('post-read revocation and owner expiry suppress values without caching authority', async () => {
  for (const mode of ['deny', 'nonvoid', 'expired'] as const) {
    let finished = false, calls = 0;
    const current = async () => {
      if (finished && mode === 'deny') throw new Error('revoked');
      return finished && mode === 'nonvoid' ? true as unknown as void : undefined;
    };
    const read = bracketRepositoryRead(current, async () => { calls++; finished = true; return 'PRIVATE'; },
      () => { if (finished && mode === 'expired') throw new Error('closed'); });
    await assert.rejects(read()); assert.equal(calls, 1);
    await assert.rejects(read()); assert.equal(calls, 1);
  }
});

test('a held read stays pending and cannot publish after its owner closes', async () => {
  let release!: () => void, entered!: () => void, closed = false, settled = false;
  const held = new Promise<void>(r => { release = r; }), begun = new Promise<void>(r => { entered = r; });
  const read = bracketRepositoryRead(async () => {}, async () => { entered(); await held; return 'PRIVATE'; },
    () => { if (closed) throw new Error('closed'); });
  const result = assert.rejects(read()).finally(() => { settled = true; });
  await begun; closed = true; await Promise.resolve(); assert.equal(settled, false);
  release(); await result;
});

test('a thrown read cannot be converted into success or trigger a second dispatch', async () => {
  let calls = 0, checks = 0;
  const error = new Error('source unavailable');
  const read = bracketRepositoryRead(async () => { checks++; }, async () => { calls++; throw error; }, () => {});
  await assert.rejects(read(), caught => caught === error); assert.equal(calls, 1); assert.equal(checks, 1);
});

test('read construction invokes the captured work, not an overridable apply property', async () => {
  let calls = 0;
  const work = Object.assign(async () => { calls++; return 'exact'; }, { apply: async () => 'forged' });
  assert.equal(await bracketRepositoryRead(async () => {}, work, () => {})(), 'exact'); assert.equal(calls, 1);
});
