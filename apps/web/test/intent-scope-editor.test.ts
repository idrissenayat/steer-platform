import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntentScopeEditor, type ScopeEditorSource } from '../app/intent-scope-editor.ts';
import type { IntentScopeTransport } from '../app/intent-scope-transport.ts';
import { scopeEditorFixture } from './intent-scope.fixture.ts';

async function setup(count = 4) {
  const f = await scopeEditorFixture(count), calls: Array<{ kind: string; input: unknown }> = [];
  let source: ScopeEditorSource | null = f.source;
  const transport: IntentScopeTransport = { close() {},
    prepare: async input => { calls.push({ kind: 'prepare', input }); return f.prepared; },
    start: async input => { calls.push({ kind: 'start', input }); return f.started; },
    read: async input => { calls.push({ kind: 'read', input }); return f.pending; } };
  const editor = createIntentScopeEditor(transport, () => source, () => {});
  return { f, calls, transport, editor, setSource: (next: ScopeEditorSource | null) => { source = next; editor.sourceChanged(); } };
}
test('scope editor explicitly prepares, starts and reads one exact review; partial progress never becomes full assessment', async () => {
  const { f, calls, transport, editor } = await setup(34); assert.equal(calls.length, 0);
  await editor.assess(); assert.deepEqual(calls.map(c => c.kind), ['prepare', 'start', 'read']);
  assert.deepEqual(calls.map(c => c.input), [f.input, f.startInput, f.readInput]); assert.equal(editor.snapshot().locked, true);
  await editor.assess(); assert.equal(calls.length, 3);
  transport.read = async () => f.observation(1); await editor.read(); assert.equal(editor.snapshot().status, 'pending');
  assert.equal(editor.snapshot().observation?.review?.structuralAssessmentComplete, false);
  transport.read = async () => f.ready; await editor.read(); assert.equal(editor.snapshot().status, 'review-available');
  assert.equal(editor.snapshot().locked, false); assert.equal(editor.snapshot().observation?.semanticQualityVerified, false);
});
test('schema-normalized field order does not falsely invalidate an unchanged editor source', async () => {
  const { f, editor, calls, setSource } = await setup();
  setSource({ ...f.source, input: Object.fromEntries(Object.entries(f.input).reverse()) as typeof f.input });
  await editor.assess(); assert.deepEqual(calls.map(c => c.kind), ['prepare', 'start', 'read']); assert.equal(editor.snapshot().sourceInvalidated, false);
});
test('unknown preparation keeps the exact request and cannot create a replacement; explicit replay recovers it', async () => {
  const { f, calls, transport, editor } = await setup(); let n = 0; const prepare = transport.prepare;
  transport.prepare = async input => { const result = await prepare(input); if (++n === 1) throw new Error('PRIVATE'); return result; };
  await editor.assess(); assert.equal(editor.snapshot().status, 'preparation-unknown'); assert.equal(editor.snapshot().locked, true);
  await editor.assess(); assert.equal(calls.length, 1); await editor.retry(); assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(editor.snapshot().operation, f.startInput); assert.doesNotMatch(editor.snapshot().message, /PRIVATE/);
});
test('lost scope start recovers identical references; terminal readback clears retry without sending another start', async () => {
  const { f, calls, transport, editor } = await setup(); const start = transport.start; let n = 0;
  transport.start = async input => { const result = await start(input); return ++n === 1 ? { ...result, receipt: { outcome: 'unknown' } } : result; };
  await editor.assess(); assert.equal(editor.snapshot().status, 'start-unknown'); await editor.read(); assert.equal(editor.snapshot().retryAvailable, true);
  await editor.retry(); assert.deepEqual(calls.filter(c => c.kind === 'start').map(c => c.input), [f.startInput, f.startInput]);
  transport.read = async () => f.ready; await editor.read(); assert.equal(editor.snapshot().retryAvailable, false);
  const count = calls.length; await editor.retry(); assert.equal(calls.length, count);
});
test('editing during preservation blocks start; undo does not restore stale authority and read-only recovery remains possible', async () => {
  const { f, calls, transport, editor, setSource } = await setup(); const prepare = transport.prepare;
  transport.prepare = async input => { const result = await prepare(input); setSource(null); return result; };
  await editor.assess(); assert.equal(editor.snapshot().status, 'start-unknown'); assert.deepEqual(calls.map(c => c.kind), ['prepare']);
  setSource(f.source); await editor.retry(); assert.equal(calls.length, 1); assert.equal(editor.snapshot().sourceInvalidated, true);
  transport.read = async () => ({ ...f.ready, status: 'superseded', source: { ...f.ready.source, latestRevision: 2 } });
  await editor.read(); assert.equal(editor.snapshot().status, 'superseded'); assert.equal(editor.snapshot().locked, false);
});
test('scope findings are verified against actual reviewed source bytes and identity, not just their own digest', async () => {
  const { f, transport, editor } = await setup(); await editor.assess();
  for (const change of [(v: typeof f.ready) => { v.subject = 'other'; }, (v: typeof f.ready) => { v.source.scopeInputDigest = 'f'.repeat(64); },
    (v: typeof f.ready) => { v.review!.results[0]!.findings[0]!.citations[0]!.quote = 'fabricated citation'; },
    (v: typeof f.ready) => { v.review!.planDigest = 'f'.repeat(64); }]) {
    const bad = structuredClone(f.ready); change(bad); transport.read = async () => bad;
    await editor.read(); assert.equal(editor.snapshot().status, 'unavailable'); assert.equal(editor.snapshot().observation, null); assert.equal(editor.snapshot().locked, true);
  }
  transport.read = async () => f.ready; await editor.read(); assert.equal(editor.snapshot().status, 'review-available');
});
test('empty, unavailable and wholly incomplete preparation never start work or establish a new intent', async () => {
  for (const outcome of ['no-sources', 'scope-incomplete', 'conflict', 'unknown', 'unavailable'] as const) {
    const { f, calls, transport, editor } = await setup();
    transport.prepare = async () => ({ ...f.prepared, outcome, originalPreserved: false, readyToRequestStart: false, reference: null });
    await editor.assess(); assert.equal(calls.length, 0); assert.equal(editor.snapshot().operation, null);
    assert.equal(editor.snapshot().retryAvailable, ['unknown', 'unavailable'].includes(outcome));
  }
});
test('failed and expired observations do not grant retries and close prevents late content or downstream requests', async () => {
  const { f, calls, transport, editor } = await setup(); await editor.assess();
  transport.read = async () => ({ ...f.pending, status: 'attention-required' }); await editor.read();
  assert.equal(editor.snapshot().retryAvailable, false); assert.equal(editor.snapshot().locked, true);
  transport.read = async () => ({ ...f.ready, status: 'expired', batches: null, review: null }); await editor.read();
  assert.equal(editor.snapshot().status, 'expired'); assert.equal(editor.snapshot().locked, false);
  let release!: (v: typeof f.prepared) => void;
  transport.prepare = async () => new Promise(r => { release = r; });
  const pending = editor.assess(); editor.close(); release(f.prepared); await pending;
  assert.equal(editor.snapshot().status, 'closed'); assert.equal(editor.snapshot().source, null); assert.equal(editor.snapshot().observation, null);
  assert.deepEqual(calls.map(c => c.kind), ['prepare', 'start', 'read']);
});
