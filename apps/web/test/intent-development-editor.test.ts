import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntentDevelopmentEditor, type DevelopmentEditorSource } from '../app/intent-development-editor.ts';
import type { IntentDevelopmentTransport } from '../app/intent-development-transport.ts';
import { developmentFixture } from '../../../packages/tool-registry/test/intent-development.fixture.ts';
import { scopeEditorFixture } from './intent-scope.fixture.ts';
import { buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';
import { planIntentScopeBatches } from '@steer/tool-registry/intent-scope-batches';
import { buildIntentDevelopmentContext } from '@steer/tool-registry/intent-development-context';

test('assessed editor sends reference-only direction and retries exact bytes; pending, wrong-owner and changed findings send nothing', async () => {
  const f = await scopeEditorFixture(), base = await developmentFixture();
  const { configurationRevision, sourceSnapshotDigest, ...input } = f.input;
  const source = { input, content: { originalText: f.scope.originalText, clarificationTurns: f.scope.clarificationTurns,
    documents: { ...f.scope.documents!, exam: '# Prior human Exam' } } };
  const output = { ...base.review, ...input, configurationRevision, sourceSnapshotDigest, evidence: f.evidence, scopeBatchPlan: f.source.plan };
  for (const assessment of [null, f.pending, { ...f.ready, subject: 'other' }, { ...f.ready, preparationDigest: 'd'.repeat(64), review: null }]) {
    const calls: unknown[] = [];
    const controller = createIntentDevelopmentEditor({ close() {}, review: async () => ({ output, envelope: await buildIntentEvidenceEnvelope(f.evidence) }),
      prepare: async value => { calls.push(value); throw new Error('Lost'); }, start: async () => { throw new Error('Forbidden'); }, read: async () => { throw new Error('Forbidden'); } }, () => source, () => {});
    await controller.review(); await controller.develop(base.choice, assessment, 'human'); assert.equal(calls.length, 0); controller.close();
  }
  const calls: unknown[] = [];
  const controller = createIntentDevelopmentEditor({ close() {}, review: async () => ({ output, envelope: await buildIntentEvidenceEnvelope(f.evidence) }),
    prepare: async value => { calls.push(value); throw new Error('Lost'); }, start: async () => { throw new Error('Forbidden'); }, read: async () => { throw new Error('Forbidden'); } }, () => source, () => {});
  await controller.review(); await controller.develop(base.choice, f.ready, 'human');
  assert.deepEqual(calls, [{ ...input, configurationRevision, sourceSnapshotDigest, choice: base.choice,
    scopeReview: { kind: 'recorded', ...f.prepared.reference, resultsDigest: f.ready.review!.resultsDigest },
    draftingContextDigest: (await buildIntentDevelopmentContext(f.evidence)).contextDigest }]);
  await controller.retry(); assert.deepEqual(calls[1], calls[0]); assert.doesNotMatch(JSON.stringify(calls), /Synthetic finding|Prior human Exam/); controller.close();
});
test('assessed editor distinguishes complete empty inventory from unavailable assessment without sending a scope model request', async () => {
  const { f, editor, transport, calls } = await setup();
  const evidence = { ...f.evidence, inventory: [], documents: [] };
  const envelope = await buildIntentEvidenceEnvelope(evidence), plan = (await planIntentScopeBatches(evidence)).summary;
  transport.review = async () => ({ output: { ...f.review, evidence, sourceSnapshotDigest: envelope.sourceSnapshotDigest, scopeBatchPlan: plan }, envelope });
  transport.prepare = async input => { calls.push({ kind: 'prepare', input }); throw new Error('Lost'); };
  await editor.review(); await editor.develop(f.choice, null, 'human');
  assert.deepEqual((calls[0]!.input as any).scopeReview, { kind: 'empty-corpus', planDigest: plan.planDigest });
  assert.deepEqual(calls.map(c => c.kind), ['prepare']); editor.close();
});

async function setup() {
  const f = await developmentFixture(), calls: Array<{ kind: string; input: unknown }> = [];
  let source: DevelopmentEditorSource | null = { input: f.input, content: f.content };
  const transport: IntentDevelopmentTransport = {
    close() {},
    async review(input) { calls.push({ kind: 'review', input }); return { output: f.review, envelope: f.envelope }; },
    async prepare(input) { calls.push({ kind: 'prepare', input }); return f.prepared; },
    async start(input) { calls.push({ kind: 'start', input }); return f.started; },
    async read(input) { calls.push({ kind: 'read', input }); return f.pending; },
  };
  const editor = createIntentDevelopmentEditor(transport, () => source, () => {});
  return { f, editor, calls, transport, setSource: (value: DevelopmentEditorSource | null) => { source = value; } };
}
test('resuming an exact retained terminal run reads results without review, preparation or start', async () => {
  const { f, editor, transport, calls } = await setup();
  const read = transport.read; transport.read = async input => { await read(input); return f.ready; };
  await editor.resume(f.startInput);
  assert.deepEqual(calls, [{ kind: 'read', input: f.readInput }]); assert.deepEqual(editor.takeResult(), f.ready);
  assert.equal(editor.retryAvailable(), false); await editor.retry(); assert.equal(calls.length, 1);
});
test('pending retained-run resume never starts automatically; explicit recovery reuses its exact reference', async () => {
  const { f, editor, calls } = await setup(); await editor.resume(f.startInput);
  assert.deepEqual(calls.map(c => c.kind), ['read']); assert.equal(editor.retryAvailable(), true);
  await editor.review(); await editor.develop(f.choice); assert.equal(calls.length, 1);
  await editor.retry(); assert.deepEqual(calls.map(c => c.kind), ['read', 'start', 'read']); assert.deepEqual(calls[1]!.input, f.startInput);
});
test('resume rejects mismatched source and cannot replay after source edits or closure', async () => {
  const { f, editor, calls, setSource } = await setup();
  for (const patch of [{ draftId: '00000000-0000-4000-8000-000000000099' }, { revision: 2 }, { productId: 'other' }]) await editor.resume({ ...f.startInput, ...patch });
  assert.equal(calls.length, 0); await editor.resume(f.startInput);
  setSource(null); editor.sourceChanged(); await editor.retry(); assert.equal(calls.length, 1);
  editor.close(); await editor.resume(f.startInput); assert.equal(calls.length, 1);
});
test('current draft review is read-only; explicit direction prepares, starts and reads the exact recorded run', async () => {
  const { f, editor, calls, transport } = await setup();
  await editor.develop(f.choice); assert.equal(calls.length, 0);
  await editor.review(); assert.deepEqual(calls.map(c => c.kind), ['review']); assert.equal(editor.snapshot().status, 'reviewed');
  await editor.develop(f.choice); assert.deepEqual(calls.map(c => c.kind), ['review', 'prepare', 'start', 'read']);
  assert.deepEqual(calls[1]!.input, f.prepareInput); assert.deepEqual(calls[2]!.input, f.startInput);
  await editor.develop(f.choice); assert.equal(calls.length, 4);
  transport.read = async () => f.ready; await editor.read();
  assert.equal(editor.snapshot().status, 'candidates-ready'); assert.deepEqual(editor.takeResult(), f.ready);
});
test('lost preparation response retries identical bytes, configuration and direction without a new operation', async () => {
  const { f, editor, transport, calls } = await setup();
  const prepare = transport.prepare; let attempts = 0;
  transport.prepare = async input => { const output = await prepare(input); if (++attempts === 1) throw new Error('PRIVATE'); return output; };
  await editor.review(); await editor.develop(f.choice); assert.equal(editor.snapshot().status, 'preparation-unknown');
  assert.doesNotMatch(editor.snapshot().message, /PRIVATE/);
  await editor.review(); await editor.develop({ ...f.choice, reason: 'Replacement direction' }); assert.equal(calls.length, 2);
  await editor.retry(); assert.deepEqual(calls[1], calls[2]); assert.equal(calls.filter(c => c.kind === 'start').length, 1);
});
test('lost start response recovers the same workflow; pending status cannot authorize a replacement start', async () => {
  const { f, editor, transport, calls } = await setup(); const start = transport.start; let attempts = 0;
  transport.start = async input => { const output = await start(input); if (++attempts === 1) throw new Error(); return output; };
  await editor.review(); await editor.develop(f.choice); assert.equal(editor.snapshot().status, 'start-unknown');
  await editor.read(); assert.equal(editor.takeResult(), null);
  await editor.review(); assert.equal(calls.filter(c => c.kind === 'review').length, 1);
  transport.read = async () => f.ready;
  await editor.retry(); assert.deepEqual(calls.filter(c => c.kind === 'start').map(c => c.input), [f.startInput, f.startInput]);
  assert.equal(calls.filter(c => c.kind === 'prepare').length, 1); assert.deepEqual(editor.takeResult(), f.ready);
});
test('terminal readback recovers an uncertain start without another dispatch; edited-and-undone text still needs fresh review', async () => {
  const { f, editor, transport, calls, setSource } = await setup();
  transport.start = async () => { throw new Error(); };
  await editor.review(); await editor.develop(f.choice);
  setSource({ input: f.input, content: { ...f.content, originalText: 'changed' } }); editor.sourceChanged();
  setSource({ input: f.input, content: f.content });
  transport.read = async () => f.ready; await editor.read(); assert.equal(editor.retryAvailable(), false);
  assert.equal(editor.takeResult(), null); await editor.retry();
  assert.equal(calls.filter(c => c.kind === 'prepare').length, 1);
  await editor.review(); assert.equal(editor.snapshot().sourceInvalidated, false); assert.equal(editor.snapshot().status, 'reviewed');
});
test('incomplete sources, wrong linked targets and edits during review or generation do not overwrite or dispatch', async () => {
  const { f, editor, transport, calls, setSource } = await setup();
  transport.review = async () => ({ output: f.review, envelope: { ...f.envelope, coverage: { ...f.envelope.coverage, complete: false } } });
  await editor.review(); await editor.develop(f.choice); assert.equal(calls.length, 0);
  transport.review = async () => ({ output: f.review, envelope: f.envelope }); await editor.review();
  await editor.develop({ action: 'new-linked', reason: 'Missing', target: { path: 'intent/9999/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'f'.repeat(64) } }); assert.equal(calls.length, 0);
  transport.prepare = async () => { setSource(null); return f.prepared; };
  await editor.develop(f.choice); assert.equal(calls.filter(c => c.kind === 'start').length, 0);
  await editor.retry(); assert.equal(calls.filter(c => c.kind === 'start').length, 0);
  transport.read = async () => f.ready; await editor.read(); assert.equal(editor.takeResult(), null);
});
test('substituted source and terminal/uncertain results never become editable current candidates', async () => {
  const { f, editor, transport, setSource } = await setup();
  await editor.review(); await editor.develop(f.choice);
  transport.read = async () => ({ ...f.ready, source: { ...f.ready.source, revisionDigest: 'f'.repeat(64) } });
  await editor.read(); assert.equal(editor.snapshot().status, 'unavailable'); assert.equal(editor.takeResult(), null);
  for (const status of ['superseded', 'expired', 'attention-required'] as const) {
    transport.read = async () => ({ ...f.ready, status }); await editor.read(); assert.equal(editor.takeResult(), null);
  }
  transport.read = async () => f.ready; await editor.read();
  setSource({ input: f.input, content: { ...f.content, originalText: 'newer human text' } }); assert.equal(editor.takeResult(), null);
});
test('focused clarification preserves original turns and permits a newly reviewed revision, never an automatic paid continuation', async () => {
  const { f, editor, transport, calls } = await setup(); transport.read = async () => f.questions;
  await editor.review(); await editor.develop(f.choice); assert.deepEqual(editor.takeResult(), f.questions);
  const count = calls.length; assert.equal(editor.snapshot().source?.content.clarificationTurns.length, 1);
  await editor.read(); assert.equal(calls.length, count); // Stubbed query; no new prepare/start.
  await editor.review(); assert.equal(editor.snapshot().status, 'reviewed');
});
test('close and late replies cannot recreate private content or issue downstream calls', async () => {
  const { f, editor, transport, calls } = await setup();
  let release!: (value: typeof f.prepared) => void;
  transport.prepare = async () => new Promise(resolve => { release = resolve; });
  await editor.review(); const sending = editor.develop(f.choice); editor.close(); release(f.prepared); await sending;
  assert.equal(editor.snapshot().status, 'closed'); assert.equal(editor.snapshot().source, null);
  await editor.retry(); await editor.read(); assert.deepEqual(calls.map(c => c.kind), ['review']);
});
