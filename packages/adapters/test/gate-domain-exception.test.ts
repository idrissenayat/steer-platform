import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { verifyNativeDomainException } from '../src/code-host/gate-domain-exception.ts';
import { nativeDomainReviewFixture } from './native-domain-review-fixture.ts';
import { nativeDomainExceptionFixture } from './native-domain-exception-fixture.ts';
import { hash } from './gate-signers-fixture.ts';

function fixture() {
  const privacy = nativeDomainReviewFixture(), security = nativeDomainReviewFixture(); security.domain = 'security';
  const records = [{ path: 'reviews/privacy.json', record: privacy }, { path: 'reviews/security.json', record: security }];
  const brief = nativeDomainExceptionFixture(records), sources = () => records.map(value => ({ path: value.path, content: JSON.stringify(value.record, null, 2) + '\n' }));
  const expected = () => ({ organization: 'synthetic', recordItem: 'synthetic-item', artifactRevision: 'c'.repeat(40),
    exam: { path: 'EXAM.md', sha256: 'a'.repeat(64) }, builderSubject: 'synthetic-builder', evaluatedAt: '2026-09-06T12:00:05Z',
    reportDigest: hash(JSON.stringify(brief, null, 2)), reviews: records.map((value, index) => ({ path: value.path, digest: hash(sources()[index]!.content), domain: value.record.domain })) });
  return { records, brief, sources, expected, evaluate: () => verifyNativeDomainException(JSON.stringify(brief, null, 2), expected(), sources()) };
}

test('all three original exception briefs reconstruct exactly from all 21 original domain records without rewriting or clearing holds', () => {
  for (const round of ['', 'round-2/', 'round-3/']) {
    const content = readFileSync(new URL(`../../../intent/0001/reviews/domain/${round}exception-brief.json`, import.meta.url), 'utf8'), record = JSON.parse(content);
    const sources = record.domainSummaries.map((value: { recordPath: string }) => ({ path: value.recordPath,
      content: readFileSync(new URL(`../../../${value.recordPath}`, import.meta.url), 'utf8') }));
    const result = verifyNativeDomainException(content, { organization: record.organization, recordItem: record.item, artifactRevision: record.targetRevision,
      exam: record.exam, reportDigest: hash(content), builderSubject: 'unverified-builder-binding', evaluatedAt: '2026-09-06T22:22:20Z',
      reviews: sources.map((value: { path: string; content: string }) => ({ path: value.path, digest: hash(value.content), domain: JSON.parse(value.content).domain })) }, sources);
    assert.ok(result, round); assert.deepEqual(result.record, record); assert.equal(result.record.status, 'hold-send-back');
    assert.equal(result.record.eligibleForGateTwoCritic, false); assert.equal(result.sourceConsolidationVerified, true);
    assert.equal(result.reviewerAuthenticityVerificationRequired, true); assert.equal(result.sourceVerificationRequired, true); assert.equal(result.gateVerified, false);
  }
});

test('native ready-for-Critic consolidation retains all findings and derives immutable review digest links without approval', () => {
  const f = fixture(), result = f.evaluate()!; assert.ok(result); assert.equal(result.record.eligibleForGateTwoCritic, true);
  assert.equal(result.record.findings.length, 2); assert.deepEqual(result.exceptionBrief.reviewDigests, f.expected().reviews.map(value => value.digest));
  for (const value of [result, result.record, result.record.findings, result.exceptionBrief.reviewDigests]) assert.ok(Object.isFrozen(value));
  assert.equal(result.writeAuthorized, false);
  assert.ok(verifyNativeDomainException(JSON.stringify(f.brief, null, 2), f.expected(), f.sources().reverse()));
});

test('missing or rewritten summaries, findings, statuses and reviewer metadata cannot hide source facts even after repinning', () => {
  for (const mutate of [(f: ReturnType<typeof fixture>) => { f.brief.findings.pop(); },
    (f: ReturnType<typeof fixture>) => { f.brief.findings[0]!.summary = 'Rewritten'; },
    (f: ReturnType<typeof fixture>) => { f.brief.findings[0]!.evidence[0]!.sha256 = 'd'.repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.brief.domainSummaries[0]!.openFindingCount = 1; },
    (f: ReturnType<typeof fixture>) => { f.brief.domainSummaries[0]!.reviewerServiceIdentity = 'replacement'; },
    (f: ReturnType<typeof fixture>) => { f.brief.domainSummaries[0]!.reviewerConfigurationRevision = 'replacement'; },
    (f: ReturnType<typeof fixture>) => { f.brief.domainSummaries[0]!.recordPath = 'other.json'; },
    (f: ReturnType<typeof fixture>) => { f.brief.domainSummaries.reverse(); },
    (f: ReturnType<typeof fixture>) => { f.brief.status = 'hold-send-back'; },
    (f: ReturnType<typeof fixture>) => { f.brief.eligibleForGateTwoCritic = false; }]) {
    const f = fixture();
    // Detach the declared consolidation from the original source graph.
    const original = structuredClone(f.brief); Object.assign(f.brief, original); mutate(f); assert.equal(f.evaluate(), null);
  }
});

test('whole pinned source sets, target, Exam, boundaries and exact generation chronology remain mandatory', () => {
  const f = fixture(), content = JSON.stringify(f.brief, null, 2);
  for (const sources of [[], f.sources().slice(1), [f.sources()[0], f.sources()[0]], [...f.sources(), { path: 'extra.json', content: '{}' }]]) assert.equal(verifyNativeDomainException(content, f.expected(), sources), null);
  for (const field of ['organization', 'recordItem', 'artifactRevision', 'reportDigest'] as const) assert.equal(verifyNativeDomainException(content, { ...f.expected(), [field]: 'foreign' }, f.sources()), null);
  const duplicate = f.expected(); duplicate.reviews[1]!.domain = duplicate.reviews[0]!.domain; assert.equal(verifyNativeDomainException(content, duplicate, f.sources()), null);
  for (const at of ['2026-09-06T11:59:59.999999999Z', '2026-09-06T12:00:05.000000001Z', '2026-02-30T12:00:01Z']) {
    const value = fixture(); value.brief.generatedAt = at; assert.equal(value.evaluate(), null);
  }
  const boundaries = fixture(); boundaries.brief.boundaries.doesNotSignGateTwo = false; assert.equal(boundaries.evaluate(), null);
});

test('pending escalations remain hold-send-back and native medium confidence is preserved rather than rewritten', () => {
  const f = fixture(); f.records[0]!.record.findings[0]!.status = 'open';
  f.records[0]!.record.escalations.push({ triggerId: 'unresolved-blocker-or-major-finding', reason: 'Pending.', findingIds: ['CASE-OLD'] });
  Object.assign(f.brief, nativeDomainExceptionFixture(f.records)); const result = f.evaluate()!; assert.ok(result);
  assert.equal(result.record.eligibleForGateTwoCritic, false); f.brief.escalations = []; assert.equal(f.evaluate(), null);
  const medium = fixture(); medium.records[0]!.record.confidence = 'medium'; Object.assign(medium.brief, nativeDomainExceptionFixture(medium.records));
  assert.equal(medium.evaluate()!.record.domainSummaries[0]!.confidence, 'medium'); assert.equal(medium.evaluate()!.record.eligibleForGateTwoCritic, true);
});

test('native exception bytes are bounded and duplicate or unsupported JSON fields cannot install stronger outcomes', () => {
  const f = fixture(), content = JSON.stringify(f.brief);
  for (const text of [' '.repeat(512 * 1024 + 1), '\ud800', content.replace('"eligibleForGateTwoCritic":true', '"eligibleForGateTwoCritic":false,"eligibleForGateTwoCritic":true'),
    JSON.stringify({ ...f.brief, gateVerified: true })]) {
    assert.equal(verifyNativeDomainException(text, { ...f.expected(), reportDigest: hash(text) }, f.sources()), null);
  }
});
