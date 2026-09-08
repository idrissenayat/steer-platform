import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { scopeReviewFixture } from './intent-scope-review.fixture.ts';
import { buildIntentDevelopmentContext } from '../src/intent-development-context.ts';
import { buildIntentEvidenceEnvelope } from '../src/intent-evidence-contracts.ts';
import { intentDevelopmentPrepareOutputSchema } from '../src/intent-development-prepare-contracts.ts';
import { developmentFixture } from './intent-development.fixture.ts';

function contentOf(e: Awaited<ReturnType<typeof scopeReviewFixture>>['evidence'], value: string) {
  return { ...e, documents: e.documents.map(d => ({ ...d, content: value })), inventory: e.inventory.map(s => ({ ...s,
    contentDigest: createHash('sha256').update(value).digest('hex'), blobOid: createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0${value}`).digest('hex') })) };
}
test('versioned drafting context includes every whole verified document across batches up to the unchanged 50-document input bound', async () => {
  for (const n of [32, 34, 50]) {
    const f = await scopeReviewFixture(n), c = await buildIntentDevelopmentContext(f.evidence), legacy = await buildIntentEvidenceEnvelope(f.evidence);
    assert.equal(c.coverage.complete, true); assert.equal(c.evidence.length, n); assert.equal(legacy.coverage.complete, n <= 32);
    assert.equal(c.sourceSnapshotDigest, legacy.sourceSnapshotDigest); assert.equal(c.contentBytes, f.evidence.documents.reduce((n, d) => n + Buffer.byteLength(d.content), 0));
    for (const d of f.evidence.documents) assert.equal(c.evidence.find(s => s.sourceId === d.sourceId)!.content, d.content);
    assert.deepEqual(await buildIntentDevelopmentContext({ ...f.evidence, inventory: [...f.evidence.inventory].reverse(), documents: [...f.evidence.documents].reverse() }), c);
    assert.equal(Object.isFrozen(c.evidence), true); assert.equal(c.authoritativeClearance, false);
  }
  const f = await scopeReviewFixture(50);
  await assert.rejects(buildIntentDevelopmentContext({ ...f.evidence, documents: [...f.evidence.documents, f.evidence.documents[0]] }));
});
test('aggregate and per-document byte limits, unavailable targets and access gaps cannot become complete context or excerpts', async () => {
  const f = await scopeReviewFixture(4), exact = contentOf(f.evidence, 'é'.repeat(16000));
  const full = await buildIntentDevelopmentContext(exact); assert.equal(full.contentBytes, 128000); assert.equal(full.coverage.complete, true);
  const big = await scopeReviewFixture(6), aggregate = await buildIntentDevelopmentContext(contentOf(big.evidence, 'é'.repeat(16000)));
  assert.equal(aggregate.coverage.complete, false); assert.equal(aggregate.contentBytes, 128000); assert.equal(aggregate.coverage.gaps.length, 2);
  assert.ok(aggregate.evidence.every(s => s.endByte === 32000 && s.content === 'é'.repeat(16000)));
  for (const e of [contentOf(f.evidence, 'é'.repeat(16001)), { ...exact, documents: exact.documents.slice(1) }, { ...exact, inventoryComplete: false },
    { ...exact, accessGapCount: 1 }, contentOf(f.evidence, '  ')]) assert.equal((await buildIntentDevelopmentContext(e)).coverage.complete, false);
  await assert.rejects(buildIntentDevelopmentContext({ ...exact, documents: exact.documents.map(d => ({ ...d, content: d.content + 'corruption' })) }));
  assert.notEqual((await buildIntentDevelopmentContext({ ...exact, permissionsRevision: 'changed' })).contextDigest, full.contextDigest);
});
test('large preparation coverage needs explicit scope and context bindings; legacy receipts cannot claim it', async () => {
  const f = await developmentFixture(), coverage = { inventoryComplete: true, inventoryCount: 34, includedCount: 34, gapCount: 0, accessGapCount: 0, complete: true };
  assert.equal(intentDevelopmentPrepareOutputSchema.safeParse({ ...f.prepared, coverage }).success, false);
  assert.equal(intentDevelopmentPrepareOutputSchema.safeParse({ ...f.prepared, coverage, draftingContextDigest: 'c'.repeat(64) }).success, false);
  assert.equal(intentDevelopmentPrepareOutputSchema.safeParse({ ...f.prepared, coverage, draftingContextDigest: 'c'.repeat(64),
    scopeReview: { kind: 'recorded', reviewId: f.prepared.reference!.operationId, preparationDigest: 'd'.repeat(64), resultsDigest: 'e'.repeat(64) } }).success, true);
});
