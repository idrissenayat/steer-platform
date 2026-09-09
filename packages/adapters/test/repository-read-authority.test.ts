import assert from 'node:assert/strict';
import test from 'node:test';
import { bracketRepositoryRead, repositoryReadCovers, retainRepositoryRead } from '../src/code-host/repository-read-authority.ts';

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

test('independent source policies run on both sides, with fresh caller checks immediately before IO and return', async () => {
  const events: string[] = [], current = async () => { events.push('caller'); };
  const policy = {
    async before(path: string) { assert.equal(path, 'source'); assert.strictEqual(this, policy); events.push('source-before'); },
    async after(path: string) { assert.equal(path, 'source'); assert.strictEqual(this, policy); events.push('source-after'); },
  };
  const read = bracketRepositoryRead(current, async (path: string) => { assert.equal(path, 'source'); events.push('IO'); return 'exact'; }, () => {}, policy);
  assert.equal(repositoryReadCovers(read, current), true);
  for (let i = 0; i < 2; i++) assert.equal(await read('source'), 'exact');
  assert.deepEqual(events, Array(2).fill(['source-before', 'caller', 'IO', 'source-after', 'caller']).flat());
});

test('caller revocation or owner closure during either independent policy never releases source bytes', async () => {
  for (const phase of ['before', 'after'] as const) for (const failure of ['caller', 'owner', 'nonvoid', 'denied'] as const) {
    let valid = true, closed = false, reads = 0;
    const query = async (at: string) => {
      if (at !== phase) return;
      if (failure === 'caller') valid = false;
      if (failure === 'owner') closed = true;
      if (failure === 'nonvoid') return false as unknown as void;
      if (failure === 'denied') throw new Error('PRIVATE');
    };
    const read = bracketRepositoryRead(async () => { if (!valid) throw new Error('revoked'); },
      async () => { reads++; return 'PRIVATE source'; }, () => { if (closed) throw new Error('closed'); },
      { before: () => query('before'), after: () => query('after') });
    await assert.rejects(read()); assert.equal(reads, phase === 'before' ? 0 : 1);
  }
});

test('held source policy keeps its read pending and cannot dispatch after owner closure', async () => {
  let release!: () => void, entered!: () => void, closed = false, reads = 0;
  const held = new Promise<void>(resolve => { release = resolve; }), begun = new Promise<void>(resolve => { entered = resolve; });
  const read = bracketRepositoryRead(async () => {}, async () => { reads++; return 'PRIVATE'; },
    () => { if (closed) throw new Error('closed'); }, { before: async () => { entered(); await held; }, after: async () => {} });
  const pending = assert.rejects(read()); await begun; closed = true; release(); await pending; assert.equal(reads, 0);
});

test('retained reads preserve exact authority, receiver, arguments and result without another policy pair', async () => {
  const receiver = {}, value = Object.freeze({ content: 'exact' }); let checks = 0, active = 0, reads = 0;
  const current = async () => { checks++; };
  const source = bracketRepositoryRead(current, async function (this: unknown, path: string, revision: string) {
    assert.strictEqual(this, receiver); assert.deepEqual([path, revision], ['path', 'revision']); reads++; return value;
  }, () => {});
  const owner = { guard() {}, start() { active++; }, settled() { active--; } };
  const retained = retainRepositoryRead(source, receiver, owner);
  assert.equal(repositoryReadCovers(retained, current), true); assert.ok(Object.isFrozen(retained));
  for (let i = 0; i < 2; i++) assert.strictEqual(await retained('path', 'revision'), value);
  assert.equal(checks, 4); assert.equal(reads, 2); assert.equal(active, 0);
  for (const unproven of [source.bind(receiver), async (...args: [string, string]) => source(...args)])
    assert.throws(() => retainRepositoryRead(unproven, receiver, owner));
});

test('retained reads reject revoked policy or closed owner and release admission exactly once', async () => {
  for (const phase of ['before', 'after'] as const) for (const mode of ['policy', 'owner'] as const) {
    let active = 0, starts = 0, stops = 0, reads = 0, valid = phase !== 'before', closed = phase === 'before' && mode === 'owner';
    const current = async () => { if (mode === 'policy' && !valid) throw new Error('revoked'); };
    const source = bracketRepositoryRead(current, async () => { reads++; valid = false; if (mode === 'owner') closed = true; return 'PRIVATE'; }, () => {});
    const retained = retainRepositoryRead(source, {}, { guard() { if (closed) throw new Error('closed'); },
      start() { active++; starts++; }, settled() { active--; stops++; } });
    await assert.rejects(retained()); assert.equal(active, 0); assert.equal(starts, stops); assert.equal(reads, phase === 'before' ? 0 : 1);
  }
});

test('retained held read keeps owner admission until actual drain and never returns bytes after closure', async () => {
  let release!: () => void, entered!: () => void, active = 0, closed = false;
  const held = new Promise<void>(r => { release = r; }), begun = new Promise<void>(r => { entered = r; });
  const source = bracketRepositoryRead(async () => {}, async () => { entered(); await held; return 'PRIVATE'; }, () => {});
  const retained = retainRepositoryRead(source, {}, { guard() { if (closed) throw new Error('closed'); },
    start() { active++; }, settled() { active--; } });
  const result = assert.rejects(retained()); await begun; closed = true; await Promise.resolve(); assert.equal(active, 1);
  release(); await result; assert.equal(active, 0); await assert.rejects(retained()); assert.equal(active, 0);
});
