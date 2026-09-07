import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindIntentDisposition } from '../src/intent-overlap-contracts.ts';

const target = { path: 'items/0201-booking/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const review = { organizationId: 'org', repository: 'github:1', kind: 'intent-overlap-candidates', method: 'lexical-candidates/v1',
  sourceDigest: 'c'.repeat(64), catalogFingerprint: 'd'.repeat(64), reviewFingerprint: 'e'.repeat(64),
  semanticReviewComplete: false, authoritativeClearance: false,
  coverage: { scope: 'configured-projections-only', catalogCount: 1, inspectedIntents: 1, inspectedDocuments: 1,
    candidateCount: 1, resultsTruncated: false, scanLimited: true, gaps: [] },
  candidates: [{ briefPath: target.path, briefContentDigest: target.contentDigest, path: 'items/0201-booking/SPEC.md',
    revision: target.revision, contentDigest: 'f'.repeat(64), document: 'SPEC', signal: 'shared-terms',
    queryTermCoverage: .6, matchedTerms: ['book'], excerpt: 'Book appointments' }] };

test('all explicit directions bind exact review and original reason, never clearance or persistence', () => {
  for (const action of ['extend-existing', 'new-linked', 'new-distinct'] as const) {
    const choice = { action, reason: '  Add reminders; keep original booking scope.  ', ...(action === 'new-distinct' ? {} : { target }) };
    const result = bindIntentDisposition(review, review, choice);
    assert.deepEqual(result.choice, choice); assert.equal(result.sourceDigest, review.sourceDigest);
    assert.equal(result.catalogFingerprint, review.catalogFingerprint); assert.equal(result.reviewFingerprint, review.reviewFingerprint);
    assert.equal(result.authoritativeClearance, false); assert.equal(result.semanticReviewComplete, false); assert.equal(result.persisted, false);
  }
});
test('changed source, catalog, reviewed evidence, tenant and repository invalidate the direction', () => {
  for (const field of ['sourceDigest', 'catalogFingerprint', 'reviewFingerprint', 'organizationId', 'repository']) {
    const changed = field === 'repository' ? 'github:other' : '0'.repeat(64);
    assert.throws(() => bindIntentDisposition(review, { ...review, [field]: changed }, { action: 'new-distinct', reason: 'Different users' }), /Scope changed/);
  }
});
test('target must be a currently reviewed Brief and its own digest, not the matching Spec digest', () => {
  for (const change of [{ contentDigest: 'f'.repeat(64) }, { revision: '0'.repeat(40) }, { path: 'items/9999-other/BRIEF.md' }]) {
    assert.throws(() => bindIntentDisposition(review, review, { action: 'new-linked', reason: 'Related but distinct', target: { ...target, ...change } }), /Choose an existing Brief/);
  }
  const empty = { ...review, candidates: [] };
  assert.throws(() => bindIntentDisposition(empty, empty, { action: 'extend-existing', reason: 'Missing scope', target }), /Choose an existing Brief/);
});
test('no inferred disposition, blank reason, extra authority or target on distinct choice', () => {
  for (const choice of [{ action: 'new-distinct', reason: ' ' }, { action: 'new-distinct', reason: 'x'.repeat(3001) },
    { action: 'extend-existing', reason: 'Missing scope' }, { action: 'new-distinct', reason: 'Distinct', target },
    { action: 'new-distinct', reason: 'Distinct', approved: true }, { action: 'merge', reason: 'Same' }]) {
    assert.throws(() => bindIntentDisposition(review, review, choice));
  }
});
