import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0119/execution-fixtures.mjs';
import { createProvenanceHistoryVerifier, policyDigest } from '../intent/0119/provenance-history.candidate.mjs';
import { createQualifiedHistoryVerifier } from '../intent/0083/qualified-history.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const make = fixtures.provenanceHistoryExecutionCase;
const limits = r => { for (const field of ['executionAuthorized', 'deletionVerified', 'liveProviderUsed', 'dispositionEvidenceVerified', 'retirementAuthorityVerified']) assert.equal(r[field], false); assert.deepEqual(r.effects, zeroEffects()); assert.equal(Object.hasOwn(r, 'retentionEligible'), false); };
const deny = (v, bytes = v.bytes, now = v.evaluationTime) => { const r = v.verifier.verify(bytes, now); assert.equal(r.state, 'blocked'); assert.equal(r.parentManifestHistoryVerified, false); limits(r); };
const proof = (v, field, domain) => { const bytes = v.envelope[field], record = JSON.parse(bytes), context = JSON.parse(v.config.historicalContextBytes);
  return createTimedRecordVerifier(context.currentRegistryBytes).verifyBytes(bytes, { domain, recordedAt: record.recordedAt, evaluatedAt: v.evaluationTime }); };

test('0119: complete child closure selects the later retirement or final deletion and never promotes item closure or retirement metadata to permission', () => {
  for (const [variant, type, at] of [['positive', 'derived-record-deleted', '12:00:00'], ['retired-last', 'corpus-retired', '12:00:01'], ['empty', 'corpus-retired', '12:00:00']]) {
    const v = make(variant), r = v.verifier.verify(v.bytes, v.evaluationTime); assert.equal(r.state, 'verified-provenance-history-evidence'); assert.equal(r.factOnly, true); limits(r);
    assert.equal(r.parentManifestHistoryVerified, true); assert.equal(r.currentActionAuthorityRequired, true); assert.equal(r.childCount, variant === 'empty' ? 0 : 2);
    assert.equal(r.selectedEventType, type); assert.equal(r.selectedAt, `2026-09-04T${at}Z`); assert.equal(r.boundaryCandidateAt, `2033-09-04T${at}Z`);
    assert.equal(JSON.parse(v.allBytes.at(-1)).eventType, 'item-closed'); assert.notEqual(r.selectedEventId, JSON.parse(v.allBytes.at(-1)).eventId);
    assert.equal(r.configDigest, sha256(v.configBytes)); assert.equal(r.policyDigest, policyDigest); assert.equal(r.historyDigest, sha256(jcs(v.allBytes)));
    assert.equal(r.archivedChildEvidenceDigest, sha256(v.envelope.derivedEvidenceBytes)); assert.equal(r.inputDigest, sha256(jcs({ bytes: v.bytes, evaluatedAt: v.evaluationTime })));
    assert.ok(r.requires.includes('qualified-retirement-decision-proof')); assert.ok(r.requires.includes('complete-current-parent-disposition-authority'));
    if (variant === 'empty') { assert.equal(r.derivedArchiveConfigDigest, null); assert.equal(v.envelope.derivedEvidenceBytes, ''); }
  }
});

test('0119: signature-valid complete-manifest claims cannot omit, duplicate, reorder, substitute or invent children', () => {
  for (const variant of ['manifest-incomplete', 'manifest-missing-child', 'manifest-duplicate-child', 'manifest-reordered', 'manifest-wrong-class', 'manifest-wrong-event',
    'manifest-wrong-corpus', 'manifest-wrong-id', 'manifest-extra-child', 'manifest-source', 'manifest-policy', 'manifest-before-retention']) {
    const v = make(variant); proof(v, 'manifestBytes', 'provider'); proof(v, 'headBytes', 'authority'); deny(v);
  }
});

test('0119: genuine qualified-history verification cannot substitute different child bytes or invalid retirement metadata', () => {
  for (const variant of ['wrong-child-event', 'orphan-child-event', 'missing-retirement', 'double-retirement', 'wrong-retirement-source', 'wrong-retirement-actor']) {
    const v = make(variant), history = createQualifiedHistoryVerifier(v.config.historicalContextBytes, v.config.archivedOwnerContextBytes);
    assert.equal(history.verify(v.envelope.qualifiedHistoryBytes, v.evaluationTime).state, 'verified-qualified-history', variant); deny(v);
  }
  deny(make('unproved-hold'));
});

test('0119: explicit empty mode still requires complete signed manifest/history and cannot hide existing deletions or missing archives', () => {
  const hidden = make('empty-with-deletions'); assert.equal(hidden.config.derivedArchiveContextBytes, null); assert.deepEqual(JSON.parse(hidden.envelope.manifestBytes).entries, []);
  proof(hidden, 'manifestBytes', 'provider'); proof(hidden, 'headBytes', 'authority'); deny(hidden);
  for (const variant of ['missing-child-proof', 'missing-history', 'missing-owner-archive', 'missing-child-archive', 'missing-manifest']) deny(make(variant));
  const empty = make('empty'); for (const field of ['qualifiedHistoryBytes', 'manifestBytes', 'headBytes']) deny(empty, jcs({ ...empty.envelope, [field]: '' }));
  deny(empty, jcs({ ...empty.envelope, derivedEvidenceBytes: make().envelope.derivedEvidenceBytes }));
});

test('0119: authoritative head must bind complete history, exact manifest/archive bytes and truthful holds after fresh retention', () => {
  for (const variant of ['head-incomplete', 'head-wrong-history', 'head-wrong-manifest', 'head-wrong-child', 'head-wrong-hold', 'head-source', 'head-policy', 'head-before-manifest']) {
    const v = make(variant); proof(v, 'headBytes', 'authority'); deny(v);
  }
  deny(make('head-future')); const v = make();
  assert.equal(v.verifier.verify(v.bytes, '2033-09-04T12:01:59.999999999Z').state, 'verified-provenance-history-evidence');
  for (const now of ['2033-09-04T12:02:00Z', '2033-09-04T12:00:32.999999999Z', '2033-09-04T12:10:00Z', 'invalid']) deny(v, v.bytes, now);
  assert.equal(v.verifier.verify(v.bytes).state, 'blocked');
});

test('0119: trusted parent scope, corpus and registry cannot be replaced or inferred from input', () => {
  const v = make();
  for (const mutate of [c => { c.extra = true; }, c => { c.manifestSelector.corpusId = 'other-corpus'; }, c => { c.archivedOwnerContextBytes = '{}'; },
    c => { c.derivedArchiveContextBytes = '{}'; }, c => { const h = JSON.parse(c.historicalContextBytes); h.recordClass = 'RC-RELEASE-MIGRATION'; c.historicalContextBytes = jcs(h); },
    c => { const h = JSON.parse(c.historicalContextBytes); h.recordId = 'other-parent'; c.historicalContextBytes = jcs(h); },
    c => { const d = JSON.parse(c.derivedArchiveContextBytes), r = JSON.parse(d.currentRegistryBytes); r.bindings.at(-1).notAfter = '2035-01-01T00:00:00Z'; d.currentRegistryBytes = jcs(r); c.derivedArchiveContextBytes = jcs(d); }]) {
    const c = structuredClone(v.config); mutate(c); assert.throws(() => createProvenanceHistoryVerifier(jcs(c)), /CONFIGURATION_INVALID/);
  }
  for (const bytes of [null, '{}', ' '.repeat(2097153), 'é'.repeat(1048577)]) assert.throws(() => createProvenanceHistoryVerifier(bytes), /CONFIGURATION_INVALID/);
});

test('0119: closed envelope, exact pins, UTF-8 limits and fixture API cannot grant request-selected authority', () => {
  const v = make();
  for (const mutate of [e => { e.configDigest = 'f'.repeat(64); }, e => { e.policyDigest = 'f'.repeat(64); }, e => { e.currentRegistryBytes = '{}'; },
    e => { e.manifestBytes += ' '; }, e => { e.derivedEvidenceBytes = sha256(e.derivedEvidenceBytes); }, e => { e.headBytes = '{}'; }]) {
    const e = structuredClone(v.envelope); mutate(e); deny(v, jcs(e));
  }
  for (const bytes of [null, '{}', ' '.repeat(67108865), 'é'.repeat(33554433)]) deny(v, bytes); deny(make('extra-field'));
  assert.deepEqual(Object.keys(fixtures), ['provenanceHistoryExecutionCase']); assert.throws(() => make('unknown'), /UNKNOWN_PROVENANCE_HISTORY_CASE/); assert.equal(make().bytes, make().bytes);
});

test('0119: fact-only composition adds no catalog credit and matches the current execution snapshot exactly', () => {
  const report = runCorrectedCoverage(), prior = JSON.parse(readFileSync(new URL('../intent/0120/QUICK-EXECUTION-REPORT.json', import.meta.url)));
  assert.deepEqual(report, prior); assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
});
