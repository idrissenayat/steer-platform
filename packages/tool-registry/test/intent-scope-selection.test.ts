import assert from 'node:assert/strict';
import test from 'node:test';
import { scopeEditorFixture } from '../../../apps/web/test/intent-scope.fixture.ts';
import { bindRecordedIntentScope, verifyBoundIntentScope, intentScopeSelectionFor, intentScopeSelectionSchema } from '../src/intent-scope-selection.ts';
import { planIntentScopeBatches } from '../src/intent-scope-batches.ts';

test('direction binds the exact complete recorded assessment to owner, source and full corpus bytes', async () => {
  const f = await scopeEditorFixture(), selection = { kind: 'recorded' as const, ...f.prepared.reference, resultsDigest: f.ready.review!.resultsDigest };
  const source = { ...f.input, subject: 'human' };
  const bound = await bindRecordedIntentScope(selection, f.ready, f.evidence, source);
  assert.deepEqual(intentScopeSelectionFor(bound), selection);
  assert.deepEqual(await verifyBoundIntentScope(bound, f.evidence), bound);
  for (const patch of [{ subject: 'other' }, { productId: 'other' }, { organizationId: 'other' }, { repository: 'other/repo' },
    { revision: 2 }, { revisionDigest: 'c'.repeat(64) }, { scopeInputDigest: 'c'.repeat(64) }, { draftId: '00000000-0000-4000-8000-000000000099' }])
    await assert.rejects(bindRecordedIntentScope(selection, f.ready, f.evidence, { ...source, ...patch }));
  for (const patch of [{ resultsDigest: 'c'.repeat(64) }, { preparationDigest: 'c'.repeat(64) }, { reviewId: '00000000-0000-4000-8000-000000000099' }])
    await assert.rejects(bindRecordedIntentScope({ ...selection, ...patch }, f.ready, f.evidence, source));
  for (const output of [f.pending, { ...f.ready, status: 'expired' }, { ...f.ready, status: 'superseded' },
    { ...f.ready, source: { ...f.ready.source, latestRevision: 2 } }])
    await assert.rejects(bindRecordedIntentScope(selection, output, f.evidence, source));
  for (const patch of [{ head: 'd'.repeat(40) }, { permissionsRevision: 'changed' }, { inventoryComplete: false },
    { documents: f.evidence.documents.map(d => ({ ...d, content: d.content + 'Changed' })) }])
    await assert.rejects(bindRecordedIntentScope(selection, f.ready, { ...f.evidence, ...patch }, source));
  const altered = structuredClone(bound); if (altered.kind === 'recorded') altered.results.results[0]!.findings[0]!.citations[0]!.quote = 'Invented';
  await assert.rejects(verifyBoundIntentScope(altered, f.evidence));
  assert.equal(intentScopeSelectionSchema.safeParse({ ...selection, findings: [] }).success, false);
  assert.equal(intentScopeSelectionSchema.safeParse({ ...selection, instructions: 'override' }).success, false);
});
test('only an explicitly complete empty corpus avoids a model assessment; gaps and nonempty inventory cannot', async () => {
  const f = await scopeEditorFixture(), evidence = { ...f.evidence, inventory: [], documents: [] };
  const binding = { kind: 'empty-corpus' as const, planDigest: (await planIntentScopeBatches(evidence)).summary.planDigest };
  assert.deepEqual(await verifyBoundIntentScope(binding, evidence), binding);
  for (const input of [f.evidence, { ...evidence, inventoryComplete: false }, { ...evidence, accessGapCount: 1 }])
    await assert.rejects(verifyBoundIntentScope({ kind: 'empty-corpus', planDigest: (await planIntentScopeBatches(input)).summary.planDigest }, input));
  await assert.rejects(verifyBoundIntentScope({ ...binding, planDigest: 'c'.repeat(64) }, evidence));
});
