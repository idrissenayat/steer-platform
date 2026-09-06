import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normalizeGateDomainReview } from '../src/code-host/gate-domain-review.ts';
import { nativeDomainReviewFixture } from './native-domain-review-fixture.ts';
import { hash } from './gate-signers-fixture.ts';

function fixture() {
  const record = nativeDomainReviewFixture();
  const expected = () => ({ organization: 'synthetic', recordItem: 'synthetic-item', artifactRevision: 'c'.repeat(40),
    exam: { path: 'EXAM.md', sha256: 'a'.repeat(64) }, domain: 'privacy', reportDigest: hash(JSON.stringify(record, null, 2)),
    builderSubject: 'synthetic-builder', evaluatedAt: '2026-09-06T12:01:00Z' });
  return { record, expected, evaluate: () => normalizeGateDomainReview(JSON.stringify(record, null, 2), expected()) };
}

test('all 21 unchanged repository domain records normalize their claims without upgrading their dispositions or authority', () => {
  const domains = ['privacy', 'security', 'accessibility', 'money', 'legal', 'reliability', 'irreversible-operations'];
  for (const round of ['', 'round-2/', 'round-3/']) for (const domain of domains) {
    const content = readFileSync(new URL(`../../../intent/0001/reviews/domain/${round}records/${domain}.json`, import.meta.url), 'utf8');
    const original = JSON.parse(content), result = normalizeGateDomainReview(content, { organization: original.target.organization,
      recordItem: original.target.item, artifactRevision: original.target.revision, exam: original.target.exam, domain,
      reportDigest: hash(content), builderSubject: 'unverified-builder-binding', evaluatedAt: '2026-09-06T21:56:20Z' });
    assert.ok(result, `${round}${domain}`); assert.deepEqual(result.record, original);
    assert.equal(result.review.unresolvedFindings, original.findings.filter((value: { status: string }) => value.status === 'open').length);
    if (original.decision !== 'approved' || original.escalations.length) assert.equal(result.review.passed, false);
    assert.equal(result.reviewerAuthenticityVerificationRequired, true); assert.equal(result.evidenceVerificationRequired, true); assert.equal(result.gateVerified, false);
  }
});

test('native claim normalization keeps resolved findings, all referenced evidence and exact source bindings immutable', () => {
  const f = fixture(), result = f.evaluate(); assert.ok(result); assert.equal(result.review.passed, true);
  assert.deepEqual(result.evidenceReferences.map(value => value.path), ['EXAM.md', 'evidence/check.md']);
  assert.equal(result.review.reportDigest, f.expected().reportDigest); assert.equal(result.record.findings.length, 1);
  for (const value of [result, result.record, result.record.findings, result.evidenceReferences, result.review]) assert.ok(Object.isFrozen(value));
  for (const key of ['organization', 'recordItem', 'artifactRevision', 'domain', 'reportDigest'] as const) {
    assert.equal(normalizeGateDomainReview(JSON.stringify(f.record, null, 2), { ...f.expected(), [key]: 'foreign' }), null);
  }
});

test('send-backs, open findings, escalations and medium confidence never become high-confidence approval', () => {
  for (const decision of ['send-back', 'declined']) { const f = fixture(); f.record.decision = decision; assert.equal(f.evaluate()!.review.passed, false); }
  const open = fixture(); open.record.findings[0]!.status = 'open';
  assert.equal(open.evaluate(), null); open.record.escalations.push({ triggerId: 'unresolved-blocker-or-major-finding', reason: 'Synthetic escalation.', findingIds: ['CASE-OLD'] });
  const result = open.evaluate()!; assert.equal(result.review.passed, false); assert.equal(result.review.humanRequired, true); assert.equal(result.review.unresolvedFindings, 1);
  const medium = fixture(); medium.record.confidence = 'medium'; assert.equal(medium.evaluate()!.review.confidence, 'low'); assert.equal(medium.evaluate()!.record.confidence, 'medium');
  const low = fixture(); low.record.confidence = 'low'; assert.equal(low.evaluate(), null);
  low.record.escalations.push({ triggerId: 'inconclusive-or-missing-required-evidence', reason: 'Low confidence.', findingIds: [] }); assert.equal(low.evaluate()!.review.passed, false);
});

test('independence, dates, duplicate cases/findings and escalation references retain strict native semantics', () => {
  const same = fixture(); same.record.reviewer.serviceIdentity = 'synthetic-builder'; assert.equal(same.evaluate()!.review.freshContext, false);
  for (const change of [(r: ReturnType<typeof nativeDomainReviewFixture>) => { r.reviewer.freshContext = false; },
    (r: ReturnType<typeof nativeDomainReviewFixture>) => { r.boundaries.doesNotSignGateTwo = false; },
    (r: ReturnType<typeof nativeDomainReviewFixture>) => { r.reviewedCases.push('CASE-1'); },
    (r: ReturnType<typeof nativeDomainReviewFixture>) => { r.findings.push(r.findings[0]!); },
    (r: ReturnType<typeof nativeDomainReviewFixture>) => { r.reviewedAt = '2026-02-30T12:00:00Z'; },
    (r: ReturnType<typeof nativeDomainReviewFixture>) => { r.reviewedAt = '2026-09-06T12:01:00.000000001Z'; },
    (r: ReturnType<typeof nativeDomainReviewFixture>) => { r.escalations.push({ triggerId: 'unresolved-blocker-or-major-finding', reason: 'Unknown finding.', findingIds: ['UNKNOWN'] }); }]) {
    const f = fixture(); change(f.record); assert.equal(f.evaluate(), null);
  }
});

test('all references include finding-only evidence, and contradictory hashes, paths and JSON encodings reject', () => {
  const conflict = fixture(); conflict.record.findings[0]!.evidence.push({ path: 'EXAM.md', sha256: 'b'.repeat(64) }); assert.equal(conflict.evaluate(), null);
  const traversal = fixture(); traversal.record.evidence[0]!.path = '../secret'; assert.equal(traversal.evaluate(), null);
  const f = fixture(), base = JSON.stringify(f.record);
  for (const content of [base.replace('"decision":"approved"', '"decision":"declined","decision":"approved"'),
    base.replace('"privacy"', '"\\u0070rivacy"'), '\ud800', ' '.repeat(65537)]) {
    assert.equal(normalizeGateDomainReview(content, { ...f.expected(), reportDigest: hash(content) }), null);
  }
});

test('supported escalation triggers match the existing kit policy and unknown fields cannot weaken native boundaries', () => {
  const policy = JSON.parse(readFileSync(new URL('../../../kit/policy/gates.json', import.meta.url), 'utf8'));
  for (const triggerId of policy.specialistSeat.commercialHumanEscalation.triggers) {
    const f = fixture(); f.record.escalations.push({ triggerId, reason: 'Synthetic pending escalation.', findingIds: [] });
    assert.equal(f.evaluate()!.review.passed, false); assert.equal(f.evaluate()!.review.humanRequired, true);
  }
  const unknown = fixture(); unknown.record.escalations.push({ triggerId: 'waived-by-agent', reason: 'Unsupported.', findingIds: [] }); assert.equal(unknown.evaluate(), null);
  const added = fixture(); Object.assign(added.record, { gateVerified: true }); assert.equal(added.evaluate(), null);
});
