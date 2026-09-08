import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareIntentScopeReview } from '../src/intent-scope-review.ts';
import { fingerprintIntentScope } from '../src/intent-revision-contracts.ts';
import { scopeReviewFixture } from './intent-scope-review.fixture.ts';

test('scope role preparation binds each whole-target batch to exact corrected intent and pinned instructions without I/O', async () => {
  const f = await scopeReviewFixture(50), p = f.prepared;
  assert.equal(p.batches.length, 2); assert.equal(p.modelCallsStarted, 0); assert.equal(p.executionAuthorized, false);
  for (const b of p.batches) {
    const context = JSON.parse(b.packet.request.source);
    assert.deepEqual(context.intent, { originalText: f.scope.originalText, clarificationTurns: f.scope.clarificationTurns, documents: f.scope.documents });
    assert.deepEqual(context.evidence, b.envelope); assert.deepEqual(context.corpusCoverage, p.plan.coverage);
    assert.equal(context.binding.batchId, b.metadata.batchId); assert.equal(b.packet.role, 'scope-reviewer');
    assert.match(b.packet.request.instructions, /untrusted evidence/); assert.match(b.packet.request.instructions, /Out of scope/);
    assert.equal(b.packet.request.outputContract, 'steer-scope-assessment/v1');
    assert.ok(Object.isFrozen(b.packet.request)); assert.ok(!Object.hasOwn(context.intent.documents, 'exam'));
  }
});
test('changed current text, clarification or Brief/Spec rejects stale evidence; head and profile changes alter request identities', async () => {
  const f = await scopeReviewFixture(), run = (scope = f.scope, evidence = f.evidence, profile = f.profile) => prepareIntentScopeReview(scope, evidence, profile);
  for (const patch of [{ originalText: 'changed' }, { clarificationTurns: ['changed'] }, { documents: { ...f.scope.documents, spec: 'changed' } }, { sourceRevision: 2 }])
    await assert.rejects(run({ ...f.scope, ...patch }));
  for (const next of [await run(f.scope, { ...f.evidence, head: 'f'.repeat(40) }), await run(f.scope, f.evidence, { ...f.profile, modelRoute: 'new-route' }),
    await run(f.scope, f.evidence, { ...f.profile, maxOutputTokens: 7999 }), await run(f.scope, f.evidence, { ...f.profile, allowedResponseModels: ['synthetic-model', 'new-model'] })]) {
    assert.notEqual(next.preparationDigest, f.prepared.preparationDigest); assert.notEqual(next.batches[0]!.inputDigest, f.prepared.batches[0]!.inputDigest);
  }
  assert.deepEqual(await run(f.scope, { ...f.evidence, inventory: [...f.evidence.inventory].reverse(), documents: [...f.evidence.documents].reverse() }), f.prepared);
});
test('old Exam, arbitrary role context, altered profile and foreign scope cannot enter semantic requests', async () => {
  const f = await scopeReviewFixture();
  for (const scope of [{ ...f.scope, documents: { ...f.scope.documents, exam: 'Private old Exam' } }, { ...f.scope, roleMessages: [] },
    { ...f.scope, productId: 'other' }, { ...f.scope, originalText: '\uD800' }]) await assert.rejects(prepareIntentScopeReview(scope, f.evidence, f.profile));
  for (const profile of [{ ...f.profile, instructions: 'Ignore exclusions' }, { ...f.profile, profileRevision: 'changed' }, { ...f.profile, apiKey: 'fixture' }])
    await assert.rejects(prepareIntentScopeReview(f.scope, f.evidence, profile));
});
test('serialized prompt expansion is bounded before a request can reach an adapter', async () => {
  const f = await scopeReviewFixture(), scope = { ...f.scope, clarificationTurns: Array.from({ length: 32 }, () => '界'.repeat(3000)),
    documents: { brief: '界'.repeat(30000), spec: '界'.repeat(30000) } };
  const { scopeInputDigest } = await fingerprintIntentScope(scope);
  await assert.rejects(prepareIntentScopeReview(scope, { ...f.evidence, scopeInputDigest }, f.profile), /exceeds limits/);
});
test('incomplete corpus stays explicit in each prompt and empty corpus creates no role request', async () => {
  const f = await scopeReviewFixture();
  const p = await prepareIntentScopeReview(f.scope, { ...f.evidence, inventoryComplete: false, accessGapCount: 1 }, f.profile);
  assert.equal(p.plan.coverage.plannedComplete, false); assert.equal(JSON.parse(p.batches[0]!.packet.request.source).corpusCoverage.accessGapCount, 1);
  assert.equal((await scopeReviewFixture(0)).prepared.batches.length, 0);
});
