import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIntentDraftEditor } from '../app/intent-draft-editor.ts';
import type { IntentDraftTransport } from '../app/intent-draft-transport.ts';

const scope = { organizationId: 'org', productId: 'product', repository: 'github:52' };
const id = '00000000-0000-4000-8000-000000000001';
const content = { originalText: 'Exact فارسی\n  text', clarificationTurns: ['one', '', 'two'], documents: { brief: '# B', spec: '# S', exam: '# E' } };
const reference = { draftId: id, revision: 1, sourceRevision: 1, scopeInputDigest: 'b'.repeat(64), revisionDigest: 'a'.repeat(64), latestRevision: 1, savedToGit: false as const };
function setup(overrides: Partial<IntentDraftTransport> = {}) {
  const requests: { kind: string; input: unknown }[] = []; let next = 2;
  const transport: IntentDraftTransport = {
    close() { requests.push({ kind: 'close', input: null }); },
    async create(input) { requests.push({ kind: 'create', input }); return { outcome: 'created', draftId: id, requestId: input.requestId,
      createdAt: '2026-09-08T00:00:00.000Z', useUntil: '2026-09-09T00:00:00.000Z', retentionDeadline: '2026-09-10T00:00:00.000Z', contentPreserved: false, savedToGit: false }; },
    async append(input) { requests.push({ kind: 'append', input }); return { outcome: 'acknowledged', ...reference,
      mutationId: input.mutationId, revision: input.expectedRevision + 1, latestRevision: input.expectedRevision + 1 }; },
    async read(input) { requests.push({ kind: 'read', input }); return { ...reference, content }; }, ...overrides,
  };
  const editor = createIntentDraftEditor(scope, transport, () => {}, () => `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`);
  return { editor, requests, transport };
}

test('create is not content preservation; append is explicit exact snapshot; identical save does not write again', async () => {
  let resolve!: (value: Awaited<ReturnType<IntentDraftTransport['append']>>) => void;
  const { editor, requests } = setup({ async append(input) { requests.push({ kind: 'append', input }); return new Promise(r => { resolve = r; }); } });
  const saving = editor.save(content); await Promise.resolve();
  assert.equal(editor.snapshot().draftId, id); assert.equal(editor.snapshot().preservedContent, null);
  await editor.save({ ...content, originalText: 'newer while pending' }); assert.equal(requests.length, 2);
  const input = requests[1]!.input as { mutationId: string; content: unknown };
  assert.deepEqual(input.content, content);
  resolve({ outcome: 'acknowledged', mutationId: input.mutationId, ...reference }); await saving;
  assert.deepEqual(editor.snapshot().preservedContent, content);
  await editor.save(content); assert.equal(requests.length, 2);
});

test('unknown append retries same mutation and original bytes, not newer human edits', async () => {
  let attempts = 0;
  const { editor, requests } = setup({ async append(input) {
    requests.push({ kind: 'append', input }); if (++attempts === 1) throw new Error('Post-commit 403 PRIVATE');
    return { outcome: 'acknowledged', mutationId: input.mutationId, ...reference };
  } });
  await editor.save(content); assert.equal(editor.snapshot().status, 'unknown');
  assert.doesNotMatch(editor.snapshot().message, /PRIVATE/);
  await editor.save({ ...content, originalText: 'newer edits' }); assert.equal(attempts, 1);
  await editor.load(id); assert.equal(requests.length, 2);
  await editor.retry(); assert.deepEqual(requests[1], requests[2]);
  assert.deepEqual(editor.snapshot().preservedContent, content);
  await editor.save({ ...content, originalText: 'newer edits' });
  const last = requests.at(-1)!.input as { mutationId: string; expectedRevision: number; expectedDigest: string };
  assert.equal(last.expectedRevision, 1); assert.equal(last.expectedDigest, reference.revisionDigest);
  assert.notEqual(last.mutationId, (requests[1]!.input as { mutationId: string }).mutationId);
});

test('uncertain reference creation retries same request before appending any content', async () => {
  let count = 0;
  const { editor, transport } = setup(); const original = transport.create, seen: unknown[] = [];
  transport.create = async input => { seen.push(input); return ++count === 1 ? { outcome: 'unknown', savedToGit: false } : original(input); };
  await editor.save(content); assert.equal(editor.snapshot().draftId, null); assert.equal(editor.snapshot().retryAvailable, true);
  await editor.retry(); assert.deepEqual(seen[0], seen[1]); assert.equal(editor.snapshot().revision, 1);
});

test('conflict does not replace local text or retry; read stages a preview until explicit replacement', async () => {
  const { editor, requests } = setup({ async append() { return { outcome: 'conflict', savedToGit: false }; } });
  await editor.save({ ...content, originalText: 'my local text' }); assert.equal(editor.snapshot().status, 'conflict');
  const before = requests.length; await editor.save(content); await editor.retry(); assert.equal(requests.length, before);
  await editor.load(id); assert.equal(editor.snapshot().status, 'restore-ready'); assert.equal(editor.snapshot().preservedContent, null);
  assert.deepEqual(editor.snapshot().restored?.content.clarificationTurns, ['one', '', 'two']);
  editor.cancelRestore(); assert.equal(editor.snapshot().status, 'conflict'); assert.equal(editor.snapshot().restored, null);
  await editor.load(id);
  assert.deepEqual(editor.acceptRestore(), content); assert.equal(editor.snapshot().status, 'preserved');
});

test('dismissing an ordinary read restores editing/save state, without adopting the remote base', async () => {
  const { editor, requests } = setup(); await editor.save(content); await editor.load(id);
  editor.cancelRestore(); assert.equal(editor.snapshot().status, 'preserved');
  await editor.save({ ...content, originalText: 'new local text' });
  assert.equal((requests.at(-1)!.input as { expectedRevision: number }).expectedRevision, 1);
});

test('old exact ACK with later remote revision cannot authorize appending from stale base', async () => {
  const { editor, requests } = setup({ async append(input) { requests.push({ kind: 'append', input }); return { outcome: 'acknowledged', ...reference, mutationId: input.mutationId, latestRevision: 2 }; } });
  await editor.save(content); assert.equal(editor.snapshot().status, 'conflict'); assert.equal(editor.snapshot().revision, 1);
  await editor.save({ ...content, originalText: 'changed' }); assert.equal(requests.length, 2);
});

test('concurrent latest read and access failure never stage stale or inaccessible content', async () => {
  const { editor, transport } = setup({ async read() { return { ...reference, latestRevision: 2, content }; } });
  await editor.load(id); assert.equal(editor.snapshot().restored, null); assert.match(editor.snapshot().message, /changed during/);
  transport.read = async () => { throw new Error('PRIVATE'); };
  await editor.load(id); assert.equal(editor.snapshot().restored, null); assert.doesNotMatch(editor.snapshot().message, /PRIVATE/);
});

test('close clears private recovery/content references and ignores late read/ACK completion', async () => {
  let resolve!: (value: Awaited<ReturnType<IntentDraftTransport['read']>>) => void;
  const { editor, requests } = setup({ async read() { return new Promise(r => { resolve = r; }); } });
  const loading = editor.load(id); editor.close(); resolve({ ...reference, content }); await loading;
  assert.equal(editor.snapshot().status, 'closed'); assert.equal(editor.snapshot().restored, null);
  await editor.retry(); await editor.save(content); assert.deepEqual(requests.map(r => r.kind), ['close']);
  let acknowledge!: () => void;
  const second = setup({ async append(input) { return new Promise(r => { acknowledge = () => r({ outcome: 'acknowledged', ...reference, mutationId: input.mutationId }); }); } });
  const saving = second.editor.save(content); await Promise.resolve();
  second.editor.close(); acknowledge(); await saving;
  assert.equal(second.editor.snapshot().status, 'closed'); assert.equal(second.editor.snapshot().preservedContent, null);
});

test('invalid and oversized text fail before creating even an empty server reference', async () => {
  const { editor, requests } = setup();
  await editor.save({ ...content, originalText: '\ud800' }); assert.match(editor.snapshot().message, /invalid text/);
  await editor.save({ ...content, documents: { brief: '\u0000'.repeat(30000), spec: '\u0000'.repeat(30000), exam: '\u0000'.repeat(30000) } });
  assert.match(editor.snapshot().message, /size limit/); assert.equal(requests.length, 0);
});
