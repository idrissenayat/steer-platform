import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyNativeCriticHistory } from '../src/code-host/gate-critic-history.ts';
import { normalizeGateCritic } from '../src/code-host/gate-critic.ts';
import { criticSource, criticSourceNames } from './native-critic-fixture.ts';
import { hash } from './gate-signers-fixture.ts';

function fixture() {
  const records = criticSourceNames.map(name => JSON.parse(criticSource(name)));
  const sources = () => records.map((record, index) => ({ path: `reviews/critic-${index}.json`, content: JSON.stringify(record, null, 2) }));
  const expected = () => ({ recordItem: records[0].item, evaluatedAt: '2026-09-06T23:00:00Z',
    reviews: sources().map((source, index) => ({ path: source.path, digest: hash(source.content), artifactRevision: records[index].targetRevision,
      reviewerProvider: records[index].reviewer.provider, reviewerTask: records[index].reviewer.task, builderTask: '/synthetic/builder' })) });
  return { records, sources, expected, evaluate: () => verifyNativeCriticHistory(sources(), expected()) };
}

test('both original Critic records retain every finding and HOLD across the complete selected predecessor link', () => {
  const f = fixture(), sources = criticSourceNames.map((name, index) => ({ path: `reviews/critic-${index}.json`, content: criticSource(name) }));
  const expected = f.expected(); sources.forEach((source, index) => { expected.reviews[index]!.digest = hash(source.content); });
  const result = verifyNativeCriticHistory(sources, expected); assert.ok(result);
  assert.deepEqual(result.records.map(value => value.record), f.records); assert.equal(result.findingIds.length, 6);
  assert.equal(result.records[1]!.critic.unresolvedFindings, 2); assert.equal(result.records[1]!.critic.passed, false);
  assert.equal(result.selectedLinksVerified, true);
  for (const key of ['selectedHistoryVerificationRequired', 'resolutionEvidenceVerificationRequired', 'targetAncestryVerificationRequired', 'reviewerAuthenticityVerificationRequired'] as const) assert.equal(result[key], true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.records)); assert.ok(Object.isFrozen(result.findingIds));
});

test('a followup that silently drops a resolved predecessor finding passes internal counters but fails linked continuity', () => {
  const f = fixture(); f.records[1].originalFindingStatus.shift();
  const selected = f.expected().reviews[1]!, source = f.sources()[1]!;
  assert.ok(normalizeGateCritic(source.content, { recordItem: f.expected().recordItem, artifactRevision: selected.artifactRevision,
    reportDigest: selected.digest, reviewerProvider: selected.reviewerProvider, reviewerTask: selected.reviewerTask,
    builderTask: selected.builderTask, evaluatedAt: f.expected().evaluatedAt }));
  assert.equal(f.evaluate(), null);
});

test('repaired local counts cannot conceal missing, invented, reused or silently reranked inherited findings', () => {
  for (const mode of ['open-missing', 'invented', 'reuse', 'rerank']) {
    const f = fixture(), record = f.records[1];
    if (mode === 'open-missing') { record.originalFindingStatus.splice(2, 1); record.unresolved.total--; record.unresolved.blocker--; }
    if (mode === 'invented') record.originalFindingStatus[0].id = 'INVENTED-001';
    if (mode === 'reuse') record.newFindings.push({ id: 'G2C-001', rank: 'minor', summary: 'Reused', evidence: ['EXAM.md:1'], requiredResolution: 'Resolve' });
    if (mode === 'rerank') { record.originalFindingStatus[2].status = 'partially-resolved-major'; record.unresolved.blocker--; record.unresolved.major++; }
    assert.equal(f.evaluate(), null, mode);
  }
});

test('new findings remain mandatory in every later followup while array presentation order is immaterial', () => {
  const f = fixture(), second = f.records[1];
  second.newFindings.push({ id: 'NEW-001', rank: 'minor', summary: 'New', evidence: ['EXAM.md:1'], requiredResolution: 'Resolve' });
  second.unresolved.total++; second.unresolved.minor++;
  const third = structuredClone(second); third.reviewedAt = '2026-09-02T20:45:33Z'; third.newFindings = [];
  third.originalFindingStatus.push({ id: 'NEW-001', status: 'resolved', summary: 'Claimed resolved', evidence: ['EXAM.md:2'] });
  third.originalFindingStatus.reverse(); third.unresolved.total--; third.unresolved.minor--; f.records.push(third);
  assert.equal(f.evaluate()!.findingIds.length, 7);
  assert.equal(verifyNativeCriticHistory(f.sources().reverse(), f.expected())!.records.length, 3);
  third.originalFindingStatus = third.originalFindingStatus.filter((value: {id: string}) => value.id !== 'NEW-001');
  assert.equal(f.evaluate(), null);
});

test('complete ordered source selection, exact chronology and original digests are mandatory', () => {
  const f = fixture();
  for (const sources of [f.sources().slice(1), [...f.sources(), f.sources()[0]], [f.sources()[0], f.sources()[0]],
    f.sources().map((value, index) => index ? { ...value, content: value.content + ' ' } : value)]) assert.equal(verifyNativeCriticHistory(sources, f.expected()), null);
  for (const mode of ['path', 'digest', 'item', 'target', 'task', 'order', 'empty']) {
    const expected = f.expected();
    if (mode === 'path') expected.reviews[1]!.path = expected.reviews[0]!.path;
    if (mode === 'digest') expected.reviews[1]!.digest = expected.reviews[0]!.digest;
    if (mode === 'item') expected.recordItem = 'foreign';
    if (mode === 'target') expected.reviews[0]!.artifactRevision = 'c'.repeat(40);
    if (mode === 'task') expected.reviews[0]!.reviewerTask = '/foreign/task';
    if (mode === 'order') expected.reviews.reverse();
    if (mode === 'empty') expected.reviews = [];
    assert.equal(verifyNativeCriticHistory(f.sources(), expected), null, mode);
  }
  f.records[1].reviewedAt = '2026-09-02T19:38:14.999999999Z'; assert.equal(f.evaluate(), null);
  f.records[1].reviewedAt = f.records[0].reviewedAt; assert.ok(f.evaluate());
});

test('bounded closed history rejects unsupported sources and cannot infer passing authority from complete resolved statuses', () => {
  const f = fixture();
  for (const value of f.records[1].originalFindingStatus) value.status = 'resolved';
  f.records[1].unresolved = { total: 0, blocker: 0, major: 0, minor: 0, nit: 0 };
  assert.equal(f.evaluate()!.records[1]!.critic.passed, false);
  assert.equal(verifyNativeCriticHistory(f.sources(), { ...f.expected(), gateVerified: true }), null);
  assert.equal(verifyNativeCriticHistory(f.sources().map(value => ({ ...value, extra: true })), f.expected()), null);
  assert.equal(verifyNativeCriticHistory([{ ...f.sources()[0], content: 'x'.repeat(512 * 1024 + 1) }, f.sources()[1]], f.expected()), null);
  assert.equal(verifyNativeCriticHistory(Array(17).fill(f.sources()[0]), { ...f.expected(), reviews: Array(17).fill(f.expected().reviews[0]) }), null);
});
