import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0118/execution-fixtures.mjs';
import { createArchivedDerivedVerifier, policyDigest } from '../intent/0118/archived-derived.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { TRUST_REGISTRY, jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const make = fixtures.archivedDerivedExecutionCase;
const limits = r => { for (const field of ['executionAuthorized', 'deletionVerified', 'liveProviderUsed', 'parentCompletenessVerified']) assert.equal(r[field], false); assert.deepEqual(r.effects, zeroEffects()); };
const deny = (v, bytes = v.bytes, now = v.evaluationTime) => { const r = v.verifier.verify(bytes, now); assert.equal(r.state, 'blocked'); assert.equal(r.futureArchiveVerified, false); assert.equal(r.fullChildEvidenceVerified, false); limits(r); };
const witness = (v, field, domain) => { const bytes = v.envelope[field], raw = JSON.parse(bytes); return createTimedRecordVerifier(v.config.currentRegistryBytes).verifyBytes(bytes, { domain, recordedAt: raw.recordedAt, evaluatedAt: v.evaluationTime }); };

test('0118: one-, three- and seven-year audits verify complete retained child evidence with fresh independent keys only', () => {
  for (const variant of ['positive', 'replay', 'year-2027', 'year-2029']) {
    const v = make(variant), r = v.verifier.verify(v.bytes, v.evaluationTime);
    assert.equal(r.state, 'verified-archived-derived-evidence'); assert.equal(r.factOnly, true); assert.equal(r.futureArchiveVerified, true); assert.equal(r.fullChildEvidenceVerified, true); limits(r);
    assert.equal(r.currentActionAuthorityRequired, true); assert.equal(r.verifiedChildCount, 2); assert.equal(r.verifiedCopyCount, 4);
    assert.equal(r.policyDigest, policyDigest); assert.equal(r.originalConfigDigest, v.original.verifier.configDigest); assert.equal(r.originalBytesDigest, sha256(v.original.bytes));
    assert.equal(r.originalEvidenceDigest, v.original.verifier.verify(v.original.bytes, v.original.evaluationTime).evidenceDigest);
    assert.equal(r.inputDigest, sha256(jcs({ bytes: v.bytes, evaluatedAt: v.evaluationTime }))); assert.equal(r.observedAt, v.original.evaluationTime);
    assert.deepEqual(r.requires, ['verified-parent-manifest-and-history', 'complete-current-parent-disposition-authority']);
    assert.equal(v.original.verifier.verify(v.original.bytes, v.evaluationTime).state, 'blocked');
    const keys = JSON.parse(v.config.currentRegistryBytes).bindings;
    for (const old of TRUST_REGISTRY.bindings) assert.deepEqual(keys.find(k => k.domain === old.domain && k.keyId === old.keyId), old);
    assert.equal(new Set(keys.map(k => k.publicKeyHex)).size, keys.length);
    assert.notEqual(witness(v, 'attestationBytes', 'authority').anchorDigest, witness(v, 'retentionReceiptBytes', 'provider').anchorDigest);
  }
});

test('0118: fresh properly signed witnesses cannot cover missing, digest-only, wrong-copy or reordered original evidence', () => {
  for (const variant of ['digest-only', 'missing-child-proof', 'wrong-child-copy', 'reordered-children']) {
    const v = make(variant); witness(v, 'attestationBytes', 'authority'); witness(v, 'retentionReceiptBytes', 'provider');
    assert.equal(v.config.originalBytesDigest, sha256(v.envelope.originalBytes)); assert.equal(v.original.verifier.verify(v.original.bytes, v.original.evaluationTime).state, 'blocked'); deny(v);
  }
});

test('0118: valid signatures cannot bypass exact archive, original-result, count, source and receipt bindings', () => {
  for (const variant of ['wrong-config', 'wrong-original-digest', 'wrong-evidence', 'wrong-reference', 'wrong-count', 'wrong-observation', 'attestation-source', 'receipt-source',
    'receipt-incomplete', 'receipt-before-attestation', 'receipt-outlives-attestation', 'receipt-wrong-attestation', 'receipt-wrong-bytes']) {
    const v = make(variant); witness(v, 'attestationBytes', 'authority'); witness(v, 'retentionReceiptBytes', 'provider'); deny(v);
  }
});

test('0118: trusted current registry preserves every original anchor and forbids cross-role or cross-era key aliases', () => {
  const v = make();
  for (const mutate of [r => { r.bindings.shift(); }, r => { r.bindings.push(r.bindings[0]); }, r => { r.bindings[0].notBefore = '2000-01-01T00:00:00Z'; },
    r => { r.bindings[0].notAfter = '2040-01-01T00:00:00Z'; }, r => { r.bindings[0].publicKeyHex = 'a'.repeat(64); },
    r => { r.bindings.at(-1).publicKeyHex = r.bindings.at(-2).publicKeyHex; }, r => { r.bindings.at(-1).publicKeyHex = r.bindings[0].publicKeyHex; }]) {
    const r = JSON.parse(v.config.currentRegistryBytes); mutate(r);
    assert.throws(() => createArchivedDerivedVerifier(jcs({ ...v.config, currentRegistryBytes: jcs(r) })), /CONFIGURATION_INVALID/);
  }
});

test('0118: every known original revocation denies conservatively, including unused domains, at the exact nanosecond', () => {
  for (const old of TRUST_REGISTRY.bindings) {
    const v = make(`revoked-${old.domain}`); witness(v, 'attestationBytes', 'authority'); witness(v, 'retentionReceiptBytes', 'provider');
    assert.equal(v.original.verifier.verify(v.original.bytes, v.original.evaluationTime).state, 'verified-derived-disposition-evidence'); deny(v);
  }
  const v = make('old-revocation-next-nanosecond'); assert.equal(v.verifier.verify(v.bytes, v.evaluationTime).state, 'verified-archived-derived-evidence');
  deny(v, v.bytes, '2033-09-04T12:00:50.000000001Z'); deny(make('current-key-revoked'));
});

test('0118: stale, future, expired, forged, wrong-domain and original-era witness authority cannot become fresh independent evidence', () => {
  for (const variant of ['stale-attestation', 'expired-receipt', 'future-attestation', 'wrong-domain', 'forged', 'missing-attestation', 'missing-retention']) deny(make(variant));
  const old = make('original-era-witness'); witness(old, 'attestationBytes', 'authority'); witness(old, 'retentionReceiptBytes', 'provider'); deny(old);
  const v = make(); assert.equal(v.verifier.verify(v.bytes, '2033-09-04T12:01:59.999999999Z').state, 'verified-archived-derived-evidence');
  for (const now of ['2033-09-04T12:02:00Z', '2033-09-04T12:05:50.000000001Z', '2026-09-04T12:00:01Z', 'invalid']) deny(v, v.bytes, now);
  assert.equal(v.verifier.verify(v.bytes).state, 'blocked');
  assert.notEqual(v.verifier.verify(v.bytes, v.evaluationTime).inputDigest, v.verifier.verify(v.bytes, '2033-09-04T12:00:51Z').inputDigest);
});

test('0118: trusted context and retained input are closed, bounded, byte-pinned and cannot install request authority', () => {
  const v = make();
  for (const mutate of [c => { c.extra = true; }, c => { c.originalBytesDigest = 'bad'; }, c => { c.originalContextBytes = '{}'; },
    c => { c.archiveReference.path = '../outside'; }, c => { c.archiveReference.path = '/absolute'; }, c => { c.archiveReference.path = 'a\\b'; },
    c => { c.archiveReference.path = 'a//b'; }, c => { c.archiveReference.revision = 'main'; }]) {
    const c = structuredClone(v.config); mutate(c); assert.throws(() => createArchivedDerivedVerifier(jcs(c)), /CONFIGURATION_INVALID/);
  }
  for (const bytes of [null, '{}', ' '.repeat(524289), 'é'.repeat(262145)]) assert.throws(() => createArchivedDerivedVerifier(bytes), /CONFIGURATION_INVALID/);
  for (const mutate of [e => { e.policyDigest = 'f'.repeat(64); }, e => { e.originalBytes += ' '; }, e => { e.originalBytes = v.config.originalBytesDigest; },
    e => { e.currentRegistryBytes = v.config.currentRegistryBytes; }, e => { e.observedAt = v.original.evaluationTime; }, e => { e.version = 'steer-derived-disposition/v1'; }]) {
    const e = structuredClone(v.envelope); mutate(e); deny(v, jcs(e));
  }
  for (const bytes of [null, '{}', ' '.repeat(33554433), 'é'.repeat(16777217)]) deny(v, bytes); deny(make('extra-field'));
});

test('0118: fixture surface remains deterministic and closed without signing or mutation exports', () => {
  assert.deepEqual(Object.keys(fixtures), ['archivedDerivedExecutionCase']); assert.throws(() => make('unknown'), /UNKNOWN_ARCHIVED_DERIVED_CASE/); assert.equal(make().bytes, make().bytes);
});

test('0118: archive prerequisite adds no case credit and matches the current mapped execution snapshot', () => {
  const report = runCorrectedCoverage(), prior = JSON.parse(readFileSync(new URL('../intent/0120/QUICK-EXECUTION-REPORT.json', import.meta.url)));
  assert.deepEqual(report, prior); assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
});
