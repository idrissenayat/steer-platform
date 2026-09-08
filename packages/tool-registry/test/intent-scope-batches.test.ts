import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { planIntentScopeBatches, validateIntentScopeBatchResults } from '../src/intent-scope-batches.ts';

function fixture(count = 50, contentFor = (n: number) => `# Intent ${Math.floor(n / 2)}\r\n## Out of scope\r\nDo not send SMS to patients.\r\n- Email only فارسی ☕\r\n`) {
  const sources = Array.from({ length: count }, (_, n) => {
    const targetId = `intent/${String(Math.floor(n / 2) + 1).padStart(4, '0')}`, sourceId = `source-${n}`, content = contentFor(n);
    return { reference: { sourceId, targetId, path: `${targetId}/${n % 2 ? 'SPEC' : 'BRIEF'}.md`, status: 'canonical' as const,
      contentDigest: createHash('sha256').update(content).digest('hex'), blobOid: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') },
      document: { sourceId, content } };
  });
  return { organizationId: 'org', productId: 'product', repository: 'github:52', branch: 'codex/synthetic', head: 'a'.repeat(40), scopeInputDigest: 'b'.repeat(64),
    permissionsRevision: 'p1', retrievalConfigurationRevision: 'r1', inventoryComplete: true, accessGapCount: 0,
    inventory: sources.map(s => s.reference), documents: sources.map(s => s.document) };
}
function receipts(plan: Awaited<ReturnType<typeof planIntentScopeBatches>>) {
  return plan.batches.map(batch => ({ planDigest: plan.summary.planDigest, batchId: batch.metadata.batchId,
    assessment: { assessmentInputDigest: batch.envelope.assessmentInputDigest, configurationRevision: 'semantic-profile-r1',
      findings: batch.metadata.targetIds.map(targetId => {
        const sources = batch.envelope.evidence.filter(s => s.targetId === targetId);
        return { targetId, assessedSourceIds: sources.map(s => s.sourceId), relation: 'related-distinct',
          overlapExplanation: 'Synthetic structural fixture, not a model quality result.', missingScopeExplanation: 'Synthetic explanation.',
          citations: sources.map(s => ({ sourceId: s.sourceId, startByte: 0, endByte: s.endByte, quote: s.content })) };
      }) } }));
}
test('fifty sources become two exact whole-target batches without truncating Brief/Spec context or starting a model', async () => {
  const input = fixture(), plan = await planIntentScopeBatches(input);
  assert.equal(plan.envelope.coverage.complete, false); assert.equal(plan.summary.coverage.plannedComplete, true);
  assert.deepEqual(plan.summary.batches.map(b => b.sourceIds.length), [32, 18]); assert.equal(plan.summary.coverage.plannedCount, 50);
  const targets = new Set<string>();
  for (const batch of plan.batches) {
    for (const target of batch.metadata.targetIds) { assert.ok(!targets.has(target)); targets.add(target); }
    for (const source of batch.envelope.evidence) assert.equal(source.content, input.documents.find(d => d.sourceId === source.sourceId)!.content);
    assert.ok(batch.envelope.coverage.complete); assert.ok(batch.envelope.evidence.every(s => s.content.includes('## Out of scope\r\nDo not send SMS')));
  }
  assert.equal(plan.summary.modelCallsStarted, 0); assert.equal(plan.summary.semanticReviewComplete, false); assert.equal(plan.summary.authoritativeClearance, false);
  assert.ok(Object.isFrozen(plan.batches[0]!.envelope.evidence));
});
test('batch and plan identities are ordering-stable and change with every scope/source/permission boundary', async () => {
  const input = fixture(), a = await planIntentScopeBatches(input);
  assert.deepEqual((await planIntentScopeBatches({ ...input, inventory: [...input.inventory].reverse(), documents: [...input.documents].reverse() })).summary, a.summary);
  for (const patch of [{ head: 'c'.repeat(40) }, { scopeInputDigest: 'd'.repeat(64) }, { permissionsRevision: 'p2' }, { retrievalConfigurationRevision: 'r2' },
    { organizationId: 'other' }, { productId: 'other' }, { repository: 'github:99' }, { branch: 'other' }, { inventoryComplete: false }, { accessGapCount: 1 }]) {
    const next = await planIntentScopeBatches({ ...input, ...patch }); assert.notEqual(next.summary.planDigest, a.summary.planDigest);
    assert.notEqual(next.summary.batches[0]!.batchId, a.summary.batches[0]!.batchId);
  }
});
test('missing, blank or oversized target context withholds its siblings rather than treating isolated scope as assessed', async () => {
  for (const mode of ['missing', 'blank', 'large'] as const) {
    const input = fixture(4, n => n === 1 && mode !== 'missing' ? mode === 'blank' ? ' \n' : 'x'.repeat(32001) : '# Complete context');
    if (mode === 'missing') input.documents.splice(1, 1);
    const plan = await planIntentScopeBatches(input); assert.equal(plan.summary.coverage.plannedComplete, false);
    assert.equal(plan.summary.coverage.plannedCount, 2); assert.equal(plan.summary.coverage.gaps.length, 2);
    assert.equal(plan.summary.coverage.gaps.find(g => g.sourceId === 'source-0')!.reason, 'target-incomplete');
    assert.ok(plan.batches.every(b => !b.metadata.targetIds.includes('intent/0001')));
  }
});
test('canonical and amendment context stays together; oversized whole-target groups remain unplanned', async () => {
  const input = fixture(4), root = 'items/0001-example';
  input.inventory = input.inventory.map((s, i) => ({ ...s, targetId: root,
    path: i < 2 ? `${root}/${i ? 'SPEC' : 'BRIEF'}.md` : `${root}/candidates/57762718-d38a-4926-b96d-7a1c40fdd6f7/${i % 2 ? 'SPEC' : 'BRIEF'}.md`,
    status: i < 2 ? 'canonical' : 'amendment' } as typeof s));
  const plan = await planIntentScopeBatches(input); assert.equal(plan.batches.length, 1); assert.equal(plan.batches[0]!.metadata.targetIds.length, 1);
  assert.deepEqual(plan.batches[0]!.envelope.evidence.map(s => s.status).sort(), ['amendment', 'amendment', 'canonical', 'canonical']);
  const tooLarge = fixture(6, () => 'x'.repeat(32000));
  tooLarge.inventory = tooLarge.inventory.map((s, i) => ({ ...s, targetId: root,
    path: `${root}/candidates/${String(i).repeat(8)}-0000-4000-8000-000000000001/${i % 2 ? 'SPEC' : 'BRIEF'}.md` }));
  const held = await planIntentScopeBatches(tooLarge); assert.equal(held.batches.length, 0);
  assert.ok(held.summary.coverage.gaps.every(g => g.reason === 'target-context-limit'));
});
test('eight-batch cap is explicit, never a first-N completeness claim', async () => {
  const plan = await planIntentScopeBatches(fixture(50, () => 'x'.repeat(32000)));
  assert.equal(plan.batches.length, 8); assert.equal(plan.summary.coverage.plannedCount, 32); assert.equal(plan.summary.coverage.gaps.length, 18);
  assert.ok(plan.summary.coverage.gaps.every(g => g.reason === 'batch-count-limit')); assert.equal(plan.summary.coverage.plannedComplete, false);
});
test('all validated results aggregate deterministically but cannot assert semantic quality or action authority', async () => {
  const input = fixture(), plan = await planIntentScopeBatches(input), results = receipts(plan);
  const complete = await validateIntentScopeBatchResults(input, results, 'semantic-profile-r1');
  assert.equal(complete.state, 'assessed-declared-corpus'); assert.equal(complete.structuralAssessmentComplete, true);
  assert.equal(complete.semanticQualityVerified, false); assert.equal(complete.authoritativeClearance, false); assert.equal(complete.executionAuthorized, false); assert.equal(complete.savedToGit, false);
  assert.deepEqual(await validateIntentScopeBatchResults(input, [...results].reverse(), 'semantic-profile-r1'), complete);
  const partial = await validateIntentScopeBatchResults(input, results.slice(0, 1), 'semantic-profile-r1');
  assert.equal(partial.state, 'incomplete'); assert.deepEqual(partial.pendingBatchIds, [plan.batches[1]!.metadata.batchId]);
});
test('batch-local completion cannot conceal corpus gaps, abstentions, missing findings or an empty corpus', async () => {
  for (const patch of [{ inventoryComplete: false }, { accessGapCount: 1 }, { documents: fixture().documents.slice(2) }]) {
    const input = { ...fixture(), ...patch }, plan = await planIntentScopeBatches(input);
    assert.equal((await validateIntentScopeBatchResults(input, receipts(plan), 'semantic-profile-r1')).state, 'incomplete');
  }
  const input = fixture(), plan = await planIntentScopeBatches(input);
  for (const mode of ['abstain', 'omit'] as const) {
    const result = receipts(plan); if (mode === 'abstain') result[0]!.assessment.findings[0]!.relation = 'insufficient-evidence'; else result[0]!.assessment.findings.pop();
    assert.equal((await validateIntentScopeBatchResults(input, result, 'semantic-profile-r1')).structuralAssessmentComplete, false);
  }
  const empty = await validateIntentScopeBatchResults(fixture(0), [], 'semantic-profile-r1'); assert.equal(empty.state, 'no-sources'); assert.equal(empty.structuralAssessmentComplete, false);
});
test('duplicate, substituted, cross-plan, wrong-profile and fabricated citations cannot become recorded assessment results', async () => {
  const input = fixture(), plan = await planIntentScopeBatches(input), valid = receipts(plan);
  const check = (v: unknown) => validateIntentScopeBatchResults(input, v, 'semantic-profile-r1');
  await assert.rejects(check([valid[0], valid[0]]));
  for (const patch of [{ planDigest: 'f'.repeat(64) }, { batchId: 'e'.repeat(64) }, { executionAuthorized: true }]) await assert.rejects(check([{ ...valid[0], ...patch }]));
  const quote = receipts(plan); quote[0]!.assessment.findings[0]!.citations[0]!.quote += 'invented'; await assert.rejects(check(quote));
  await assert.rejects(validateIntentScopeBatchResults(input, valid, 'other-profile'));
  await assert.rejects(validateIntentScopeBatchResults({ ...input, permissionsRevision: 'new' }, valid, 'semantic-profile-r1'));
  const mutated = fixture(); mutated.documents[40]!.content += 'tampered unbatched text'; await assert.rejects(planIntentScopeBatches(mutated));
});
