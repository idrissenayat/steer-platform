import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  fingerprintIntentScope, intentScopeInputSchema, intentDocumentDraftsSchema,
  intentDocumentChanges, invalidateIntentReviews, intentSaveBindingSchema,
  assertIntentSaveBindingCurrent, intentSaveCompletionState,
} from '../src/intent-revision-contracts.ts';

const draftId = '60e8a4c1-cf84-477e-bd8b-04a26dfeaa1d';
const source = {
  organizationId: 'org', productId: 'product', repository: 'github:1', draftId,
  sourceRevision: 1, originalText: '  Please preserve فارسی and café.\n',
  clarificationTurns: ['For patients.', 'Not clinicians.'],
  documents: { brief: '# Brief\r\nBook a slot.\n', spec: '# Spec\nAC-01\n' },
};
const all = ['scope-assessment', 'human-direction', 'spec-conformance', 'exam-review', 'save-consent'];
const scopeOnly = ['scope-assessment', 'human-direction', 'save-consent'];
const binding = {
  kind: 'steer-intent-save-binding/v1', organizationId: 'org', productId: 'product', subject: 'human',
  draftId, draftRevision: 1, scopeInputDigest: 'a'.repeat(64), sourceSnapshotDigest: 'b'.repeat(64),
  assessmentDigest: 'c'.repeat(64), dispositionDigest: 'd'.repeat(64), bundleManifestDigest: 'e'.repeat(64),
  repository: 'github:1', branch: 'main', item: 'items/0007-booking', expectedHead: 'f'.repeat(40),
};

test('scope fingerprints hash exact document bytes and bind generated scope separately from raw intent', async () => {
  const result = await fingerprintIntentScope(source);
  assert.equal(result.briefDigest, createHash('sha256').update(source.documents.brief).digest('hex'));
  assert.equal(result.specDigest, createHash('sha256').update(source.documents.spec).digest('hex'));
  assert.deepEqual(await fingerprintIntentScope(structuredClone(source)), result);
  assert.ok(Object.isFrozen(result));
  const raw = await fingerprintIntentScope({ ...source, documents: null });
  assert.equal(raw.briefDigest, null); assert.equal(raw.specDigest, null);
  assert.notEqual(raw.scopeInputDigest, result.scopeInputDigest);
  assert.equal(intentScopeInputSchema.parse(source).originalText, source.originalText);
});

test('every source/home/revision/clarification/Brief/Spec byte change invalidates the scope fingerprint', async () => {
  const original = (await fingerprintIntentScope(source)).scopeInputDigest;
  for (const change of [
    { organizationId: 'other' }, { productId: 'other' }, { repository: 'github:2' },
    { draftId: '96aaac0f-cf36-4f08-ab5f-8c924aabfb53' }, { sourceRevision: 2 },
    { originalText: source.originalText.trim() }, { originalText: source.originalText.normalize('NFD') },
    { clarificationTurns: [...source.clarificationTurns].reverse() },
    { clarificationTurns: ['For patients.\nNot clinicians.'] },
    { documents: { ...source.documents, brief: source.documents.brief.replace('\r\n', '\n') } },
    { documents: { ...source.documents, spec: source.documents.spec + ' ' } },
  ]) assert.notEqual((await fingerprintIntentScope({ ...source, ...change })).scopeInputDigest, original);
});

test('schema rejects ambiguous Unicode, additional fields and invalid revisions without trimming drafts', async () => {
  for (const change of [{ originalText: '\ud800' }, { clarificationTurns: ['\udfff'] },
    { documents: { brief: '\ud800', spec: 'ok' } }, { sourceRevision: 0 }, { sourceRevision: 1.5 },
    { originalText: 'x'.repeat(10001) }, { clarificationTurns: Array(33).fill('x') }, { approved: true }]) {
    await assert.rejects(fingerprintIntentScope({ ...source, ...change }));
  }
  const empty = { brief: '', spec: '  \n', exam: ' فارسی\n' };
  assert.deepEqual(intentDocumentDraftsSchema.parse(empty), empty); // Editable != publishable.
  assert.equal(intentDocumentDraftsSchema.safeParse({ ...empty, exam: '\ud800' }).success, false);
});

test('dependency table preserves scope for Exam edits but never preserves obsolete consent', () => {
  assert.deepEqual(invalidateIntentReviews([]), []);
  for (const change of ['source', 'brief', 'architect-configuration'] as const) assert.deepEqual(invalidateIntentReviews([change]), all);
  assert.deepEqual(invalidateIntentReviews(['spec']), all);
  for (const change of ['exam', 'exam-configuration'] as const) assert.deepEqual(invalidateIntentReviews([change]), ['exam-review', 'save-consent']);
  for (const change of ['source-snapshot', 'permissions', 'retrieval-configuration'] as const) assert.deepEqual(invalidateIntentReviews([change]), scopeOnly);
  assert.deepEqual(invalidateIntentReviews(['brief', 'spec', 'exam', 'brief']), all);
});

test('byte comparison and accumulated invalidations do not revive reviews after undo', () => {
  const original = { ...source.documents, exam: '# Exam\nNOT RUN' };
  const edited = { ...original, brief: original.brief + ' ' };
  assert.deepEqual(intentDocumentChanges(original, structuredClone(original)), []);
  const invalidated = invalidateIntentReviews(intentDocumentChanges(original, edited));
  assert.deepEqual(invalidated, all);
  assert.deepEqual(invalidateIntentReviews(intentDocumentChanges(edited, original), invalidated), all);
  assert.deepEqual(intentDocumentChanges(original, { ...original, exam: original.exam + '\n' }), ['exam']);
});

test('all save references and destination fields must match; matching bytes cannot substitute for a new revision', () => {
  assert.equal(assertIntentSaveBindingCurrent(binding, structuredClone(binding)), undefined);
  for (const key of Object.keys(binding).filter(key => key !== 'kind')) {
    const replacement = key === 'draftRevision' ? 2
      : key === 'draftId' ? '96aaac0f-cf36-4f08-ab5f-8c924aabfb53'
      : key.endsWith('Digest') ? '9'.repeat(64) : key === 'expectedHead' ? '9'.repeat(40)
      : key === 'item' ? 'items/0008-booking' : 'other';
    assert.throws(() => assertIntentSaveBindingCurrent(binding, { ...binding, [key]: replacement }), /binding changed/);
  }
  for (const change of [{ approved: true }, { item: 'items/0007-booking/../../EXAM.md' }, { expectedHead: 'main' },
    { item: binding.item + '\n' }, { expectedHead: binding.expectedHead + '\n' }, { draftId: binding.draftId + '\n' },
    { subject: '' }, { kind: 'steer-intent-save-binding/v2' }]) {
    assert.equal(intentSaveBindingSchema.safeParse({ ...binding, ...change }).success, false);
  }
});

test('late save completion distinguishes newer edits and never attaches a result to another workspace', () => {
  assert.equal(intentSaveCompletionState(binding, binding), 'current-revision-recorded');
  assert.equal(intentSaveCompletionState(binding, { ...binding, draftRevision: 2 }), 'previous-revision-recorded');
  assert.equal(intentSaveCompletionState(binding, { ...binding, bundleManifestDigest: '9'.repeat(64) }), 'previous-revision-recorded');
  for (const change of [{ organizationId: 'other' }, { subject: 'other' }, { productId: 'other' },
    { repository: 'github:2' }, { branch: 'other' }, { item: 'items/0008-booking' },
    { draftId: '96aaac0f-cf36-4f08-ab5f-8c924aabfb53' }]) {
    assert.equal(intentSaveCompletionState(binding, { ...binding, ...change }), 'different-workspace');
  }
});
