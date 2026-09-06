import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normalizeGateCritic } from '../src/code-host/gate-critic.ts';
import { criticSource, criticSourceNames } from './native-critic-fixture.ts';
import { hash } from './gate-signers-fixture.ts';

function fixture(name: typeof criticSourceNames[number] = 'a43b32a') {
  const content = criticSource(name), record = JSON.parse(content);
  const expected = (source = JSON.stringify(record)) => ({ recordItem: record.item, artifactRevision: record.targetRevision,
    reportDigest: hash(source), evaluatedAt: '2026-09-06T22:30:00Z', reviewerProvider: record.reviewer.provider,
    reviewerTask: record.reviewer.task, builderTask: '/synthetic/builder' });
  return { content, record, expected, evaluate: () => normalizeGateCritic(JSON.stringify(record), expected()) };
}

test('both unchanged native Critic records retain complete findings, historical validation claims and HOLD without authority', () => {
  for (const name of criticSourceNames) {
    const f = fixture(name), result = normalizeGateCritic(f.content, f.expected(f.content)); assert.ok(result);
    assert.deepEqual(result.record, f.record); assert.equal(result.critic.unresolvedFindings, name === 'a43b32a' ? 6 : 2);
    assert.equal(result.critic.passed, false); assert.equal(result.critic.reportDigest, hash(f.content));
    for (const key of ['reviewerAuthenticityVerificationRequired', 'evidenceVerificationRequired', 'findingHistoryVerificationRequired', 'sourceVerificationRequired'] as const) assert.equal(result[key], true);
    assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
    for (const value of [result, result.record, result.record.reviewer, result.critic]) assert.ok(Object.isFrozen(value));
  }
});

test('native finding totals are reconstructed from complete current entries, including unresolved followups and new findings', () => {
  for (const name of criticSourceNames) for (const mode of ['counter', 'remove', 'rank', 'duplicate', 'status', 'resolution']) {
    const f = fixture(name);
    if (mode === 'counter') f.record.unresolved.major++;
    if (name === 'a43b32a') {
      if (mode === 'remove') f.record.findings.pop();
      if (mode === 'rank') f.record.findings[0].rank = 'minor';
      if (mode === 'duplicate') f.record.findings[1].id = f.record.findings[0].id;
      if (mode === 'status') f.record.findings[0].status = 'resolved';
      if (mode === 'resolution') delete f.record.findings[0].requiredResolution;
    } else {
      if (mode === 'remove') f.record.originalFindingStatus.splice(2, 1);
      if (mode === 'rank') f.record.originalFindingStatus[2].status = 'partially-resolved-major';
      if (mode === 'duplicate') f.record.newFindings.push({ id: f.record.originalFindingStatus[0].id, rank: 'minor', summary: 'Synthetic', evidence: ['EXAM.md:1'], requiredResolution: 'Resolve' });
      if (mode === 'status') f.record.originalFindingStatus[2].status = 'resolved';
      if (mode === 'resolution') delete f.record.originalFindingStatus[2].requiredResolution;
    }
    assert.equal(f.evaluate(), null, `${name}:${mode}`);
  }
  const f = fixture('ab1d036');
  f.record.newFindings.push({ id: 'NEW-001', rank: 'minor', summary: 'Synthetic new finding', evidence: ['EXAM.md:1'], requiredResolution: 'Resolve' });
  f.record.unresolved.total++; f.record.unresolved.minor++;
  assert.equal(f.evaluate()!.critic.unresolvedFindings, 3);
});

test('fresh-context metadata can only reduce claimed independence and never prove task provenance', () => {
  for (const name of criticSourceNames) for (const mode of ['inherited', 'prior', 'builder']) {
    const f = fixture(name), expected = f.expected();
    if (mode === 'inherited') f.record.reviewer.inheritedConversation = true;
    if (mode === 'prior') f.record.reviewer[name === 'a43b32a' ? 'priorStatusTreatedAsEvidence' : 'priorConclusionsTreatedAsAuthority'] = true;
    if (mode === 'builder') expected.builderTask = f.record.reviewer.task;
    const source = JSON.stringify(f.record); expected.reportDigest = hash(source);
    const result = normalizeGateCritic(source, expected); assert.ok(result); assert.equal(result.critic.freshContext, false);
    assert.equal(result.critic.passed, false); assert.equal(result.reviewerAuthenticityVerificationRequired, true);
  }
});

test('exact source scope, explicit task bindings and nanosecond review chronology cannot be substituted', () => {
  for (const key of ['recordItem', 'artifactRevision', 'reportDigest', 'reviewerProvider', 'reviewerTask'] as const) {
    const f = fixture(), expected = f.expected(f.content); expected[key] = key === 'artifactRevision' ? 'd'.repeat(40) : key === 'reportDigest' ? 'd'.repeat(64) : 'foreign';
    assert.equal(normalizeGateCritic(f.content, expected), null, key);
  }
  const f = fixture(); f.record.reviewedAt = '2026-09-06T22:30:00.000000001Z'; assert.equal(f.evaluate(), null);
  f.record.reviewedAt = '2026-09-06T22:30:00Z'; assert.ok(f.evaluate());
  f.record.reviewedAt = '2026-02-30T00:00:00Z'; assert.equal(f.evaluate(), null);
});

test('unknown PASS and preflight layouts, malformed bytes and extra authority fields never become canonical Critic evidence', () => {
  for (const mode of ['pass', 'disposition', 'extra', 'gate', 'profile', 'mixed']) {
    const f = fixture();
    if (mode === 'pass') f.record.pass = true;
    if (mode === 'disposition') f.record.disposition = 'approved';
    if (mode === 'extra') f.record.writeAuthorized = true;
    if (mode === 'gate') f.record.gate = 3;
    if (mode === 'profile') f.record.version = 'steer-local-preflight/v1';
    if (mode === 'mixed') f.record.originalFindingStatus = [];
    assert.equal(f.evaluate(), null, mode);
  }
  const f = fixture();
  for (const content of [' '.repeat(512 * 1024 + 1), '\ud800', f.content.replace('"pass": false', '"pass": true, "pass": false')]) {
    assert.equal(normalizeGateCritic(content, f.expected(content)), null);
  }
  const preflight = readFileSync(new URL('../../../intent/0001/reviews/domain/round-3/remediation/preflight-critic-r5.json', import.meta.url), 'utf8');
  assert.equal(normalizeGateCritic(preflight, f.expected(preflight)), null);
});
