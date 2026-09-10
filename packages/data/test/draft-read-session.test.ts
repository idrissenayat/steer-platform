import assert from 'node:assert/strict';
import test from 'node:test';
import { registerDraftReadSession, withDraftReadSession } from '../src/draft-read-session.ts';

const current = async () => {};
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
test('draft sharing selects only an exact registered method/scope and retains ordinary reader receiver', async () => {
  let calls = 0, opened = 0; const scope = { organizationId: 'synthetic' }, expected = { exact: ' 🌸\r\n ' };
  const reader = { scope, async read() { assert.equal(this, reader); calls++; return expected; } };
  await withDraftReadSession(reader, {}, current, async read => { assert.equal(await read(), expected); assert.equal(await read(), expected); });
  assert.equal(calls, 2);
  registerDraftReadSession(reader.read, scope, async (_input, check, work) => { opened++; await check(); await work(async () => expected); await check(); });
  await withDraftReadSession(reader, {}, current, async read => { assert.equal(await read(), expected); assert.equal(await read(), expected); });
  assert.equal(opened, 1); assert.equal(calls, 2);
  const wrapped = { scope, read: reader.read.bind(reader) };
  await withDraftReadSession(wrapped, {}, current, async read => { assert.equal(await read(), expected); }); assert.equal(calls, 3);
  await assert.rejects(withDraftReadSession({ scope: { organizationId: 'foreign' }, read: reader.read }, {}, current, async read => { await read(); }));
});
test('draft session rejects empty consumption, changed ports/scope and swallowed read failure', async () => {
  for (const mode of ['empty', 'method', 'scope', 'failure', 'nonvoid']) {
    const reader = { scope: { revision: 'one' }, read: async () => { if (mode === 'failure') throw new Error(); return 1; } };
    await assert.rejects(withDraftReadSession(reader, {}, current, async read => {
      if (mode === 'empty') return;
      if (mode === 'failure') { await assert.rejects(read()); return; }
      await read(); if (mode === 'method') reader.read = async () => 1;
      if (mode === 'scope') reader.scope.revision = 'two';
      if (mode === 'nonvoid') return true as never;
    }));
  }
});
test('forgotten and overlapping draft consumption poison the phase and retain actual read drainage', async () => {
  for (const overlap of [false, true]) {
    let release!: () => void, entered!: () => void, settled = false;
    const held = new Promise<void>(r => { release = r; }), reached = new Promise<void>(r => { entered = r; });
    const reader = { scope: {}, read: async () => { entered(); await held; return 1; } };
    const result = assert.rejects(withDraftReadSession(reader, {}, current, async read => {
      void read().catch(() => {}); await reached;
      if (overlap) await assert.rejects(read());
    })).then(() => { settled = true; });
    await reached; await turn(); assert.equal(settled, false); release(); await result;
  }
});
test('an unawaited producer callback cannot finish early or leave escaped consumption open', async () => {
  let release!: () => void, entered!: () => void, settled = false, escaped: (() => Promise<unknown>) | undefined;
  const held = new Promise<void>(r => { release = r; }), reached = new Promise<void>(r => { entered = r; });
  const reader = { scope: {}, read: async () => 1 };
  registerDraftReadSession(reader.read, reader.scope, async (_input, _check, work) => { void work(async () => 1); });
  const result = assert.rejects(withDraftReadSession(reader, {}, current, async read => { escaped = read; entered(); await held; await read(); }))
    .then(() => { settled = true; });
  await reached; await turn(); assert.equal(settled, false); release(); await result; await assert.rejects(escaped!());
});
