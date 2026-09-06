import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0120/execution-fixtures.mjs';
import { createRetirementDecisionVerifier, policyDigest } from '../intent/0120/retirement-decision.candidate.mjs';
import { validateRetirementDecision } from '../intent/0120/retirement-decision-schema.candidate.mjs';
import { createHumanAuthorityVerifier } from '../intent/0058/human-authority.candidate.mjs';
import { createLifecycleEventVerifier } from '../intent/0059/lifecycle-events.candidate.mjs';
import { TRUST_REGISTRY, jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const make = fixtures.retirementDecisionExecutionCase;
const proofFields = ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes', 'assignmentEvidenceBytes', 'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes'];
const limits = r => { for (const field of ['executionAuthorized', 'deletionVerified', 'liveProviderUsed', 'futureArchiveVerified', 'qualifiedPriorHistoryVerified']) assert.equal(r[field], false); assert.deepEqual(r.effects, zeroEffects()); };
const deny = (v, bytes = v.bytes, now = v.evaluationTime) => { const r = v.verifier.verify(bytes, now); assert.equal(r.state, 'blocked'); assert.equal(r.retirementAuthorityVerified, false); limits(r); };
const human = v => v.human.verify(jcs({ version: v.human.envelopeVersion, policyDigest: v.human.policyDigest, bundleBytes: v.envelope.humanBundleBytes }), v.evaluationTime);
const atClock = (v, now) => jcs({ ...v.envelope, humanBundleBytes: jcs({ ...v.bundle, evaluationTime: now }) });

test('0120: complete original/current retirement decisions verify nine proofs and truthful hold metadata without erasure or archive authority', () => {
  for (const variant of ['positive', 'future-2033', 'empty-prefix', 'held', 'released']) {
    const v = make(variant), r = v.verifier.verify(v.bytes, v.evaluationTime); assert.equal(r.state, 'verified-retirement-decision-evidence'); limits(r);
    assert.equal(r.retirementAuthorityVerified, true); assert.equal(r.factOnly, true); assert.equal(r.currentActionAuthorityRequired, true); assert.equal(r.consumedRecordIds.length, 9);
    assert.equal(r.holdState, variant === 'held' ? 'active' : variant === 'released' ? 'released' : 'none'); assert.equal(r.eventDigest, v.config.eventDigest);
    assert.equal(r.policyDigest, policyDigest); assert.equal(r.configDigest, sha256(v.configBytes)); assert.equal(r.eventBytesDigest, sha256(v.envelope.eventBytes));
    assert.equal(r.historyDigest, v.config.historyDigest); assert.equal(r.humanBundleDigest, sha256(v.envelope.humanBundleBytes)); assert.equal(r.inputDigest, sha256(jcs({ bytes: v.bytes, evaluatedAt: v.evaluationTime })));
    assert.ok(r.requires.includes('verified-qualified-parent-history')); assert.ok(r.requires.includes('fresh-retirement-archive-revalidation-for-later-audits'));
    for (const old of TRUST_REGISTRY.bindings) assert.deepEqual(JSON.parse(v.registryBytes).bindings.find(k => k.domain === old.domain && k.keyId === old.keyId), old);
    const a = JSON.parse(v.bundle.authorityBytes); for (const field of ['eraseMethod', 'copyInventoryDigest', 'referenceState', 'allowedCopyProviders', 'deadlineSeconds', 'terminalEventId']) assert.equal(Object.hasOwn(a, field), false);
  }
});

test('0120: full human proof and valid event signatures cannot bypass actor, corpus, selector, predecessor or exact event binding', () => {
  for (const variant of ['prior-retirement', 'wrong-source', 'wrong-actor', 'wrong-actor-role', 'wrong-event-id', 'wrong-event-binding', 'wrong-corpus', 'wrong-previous',
    'wrong-history-head', 'wrong-selector', 'wrong-conditions', 'wrong-safeguards', 'false-hold']) {
    const v = make(variant); assert.equal(human(v).decision, 'ALLOW', variant);
    const e = createLifecycleEventVerifier(v.registryBytes); assert.equal(e.verify(jcs({ version: 'steer-r5-001-events/v1', policyDigest: e.policyDigest, scope: v.config.scope,
      eventBytes: v.envelope.eventBytes, historyBytes: v.envelope.historyBytes, evaluationTime: v.evaluationTime }), v.evaluationTime).state, 'validated-trigger'); deny(v);
  }
});

test('0120: each of nine original supporting proofs is mandatory and cannot be forged or replaced by unqualified or replayed authority', () => {
  for (const field of proofFields) { deny(make(`missing-${field}`)); deny(make(`corrupt-${field}`)); }
  for (const variant of ['unqualified', 'disabled-identity', 'expired-assignment', 'cas-loser', 'replayed', 'old-key-revoked']) { const v = make(variant); assert.equal(human(v).decision, 'DENY'); deny(v); }
});

test('0120: history head is independently checked for signed policy, completeness, exact prefix and truthful state before decision', () => {
  for (const variant of ['head-incomplete', 'head-policy', 'head-source', 'head-history', 'head-previous', 'head-hold', 'head-after-decision', 'head-after-cas']) {
    const v = make(variant); assert.equal(human(v).decision, 'ALLOW'); deny(v);
  }
  deny(make('missing-history')); deny(make('missing-head'));
});

test('0120: reservations precede retirement commit and CAS/replay observations precede the decision with exact clock boundaries', () => {
  for (const variant of ['reservation-after-event', 'cas-after-decision', 'replay-after-decision']) { const v = make(variant); assert.equal(human(v).decision, 'ALLOW'); deny(v); }
  const v = make();
  for (const now of ['2026-09-04T11:59:58Z', '2026-09-04T12:00:59.999999999Z']) assert.equal(v.verifier.verify(atClock(v, now), now).state, 'verified-retirement-decision-evidence');
  for (const now of ['2026-09-04T11:59:57.999999999Z', '2026-09-04T12:01:00Z', '2033-09-04T12:00:02Z']) deny(v, atClock(v, now), now);
  const revoked = make('old-key-revoked'), before = '2026-09-04T12:00:01.999999999Z';
  assert.equal(revoked.verifier.verify(atClock(revoked, before), before).state, 'verified-retirement-decision-evidence'); deny(revoked);
  assert.equal(v.verifier.verify(v.bytes).state, 'blocked'); deny(v, v.bytes, 'invalid'); deny(v, v.bytes, '2026-09-04T12:00:03Z');
});

test('0120: retirement is a closed separate schema/profile and cannot become a hold, reference or disposition decision', () => {
  const v = make(), a = JSON.parse(v.bundle.authorityBytes); assert.deepEqual(validateRetirementDecision(a), []);
  for (const field of ['selectorInventoryDigest', 'eventId', 'eventBindingDigest', 'decisionKind', 'previousEventDigest', 'historyHeadDigest', 'corpusId', 'corpusVersion']) {
    const b = structuredClone(a); delete b[field]; assert.ok(validateRetirementDecision(b).length);
  }
  for (const [field, value] of [['eraseMethod', 'provider-delete'], ['previousHoldEventDigest', null], ['decisionKind', 'hold-released'], ['decisionKind', 'reference-revocation-authorized'], ['decidedAt', '2026-09-04T11:59:54.1Z']]) assert.ok(validateRetirementDecision({ ...a, [field]: value }).length);
  for (const profile of ['disposition', 'qualified-event', 'qualified-reference']) {
    const other = createHumanAuthorityVerifier(v.registryBytes, profile); assert.notEqual(other.policyDigest, v.human.policyDigest);
    assert.equal(other.verify(jcs({ version: other.envelopeVersion, policyDigest: other.policyDigest, bundleBytes: v.envelope.humanBundleBytes }), v.evaluationTime).decision, 'DENY');
  }
});

test('0120: exact trusted setup preserves original anchors and prevents scope drift, key aliasing or request-selected policy', () => {
  const v = make();
  for (const mutate of [c => { c.extra = true; }, c => { c.scope.organization = 'other'; }, c => { c.artifactRevision = 'main'; }, c => { c.eventId = 'bad'; },
    c => { c.historyDigest = 'bad'; }, c => { const r = JSON.parse(c.currentRegistryBytes); r.bindings[0].notAfter = '2040-01-01T00:00:00Z'; c.currentRegistryBytes = jcs(r); },
    c => { const r = JSON.parse(c.currentRegistryBytes); r.bindings[1].publicKeyHex = r.bindings[0].publicKeyHex; c.currentRegistryBytes = jcs(r); }]) {
    const c = structuredClone(v.config); mutate(c); assert.throws(() => createRetirementDecisionVerifier(jcs(c)), /CONFIGURATION_INVALID/);
  }
  for (const bytes of [null, '{}', ' '.repeat(131073), 'é'.repeat(65537)]) assert.throws(() => createRetirementDecisionVerifier(bytes), /CONFIGURATION_INVALID/);
  for (const mutate of [e => { e.policyDigest = 'f'.repeat(64); }, e => { e.configDigest = 'f'.repeat(64); }, e => { e.registryBytes = v.registryBytes; },
    e => { e.eventBytes += ' '; }, e => { e.historyBytes.push(e.eventBytes); }, e => { e.humanBundleBytes = '{}'; }]) { const e = structuredClone(v.envelope); mutate(e); deny(v, jcs(e)); }
  for (const bytes of [null, '{}', ' '.repeat(16777217), 'é'.repeat(8388609)]) deny(v, bytes); deny(make('extra-field'));
});

test('0120: fixtures are deterministic closed scenarios without an exported signer or arbitrary mutation hook', () => {
  assert.deepEqual(Object.keys(fixtures), ['retirementDecisionExecutionCase']); assert.throws(() => make('unknown'), /UNKNOWN_RETIREMENT_DECISION_CASE/); assert.equal(make().bytes, make().bytes);
});

test('0120: old mapped observation seals stay identical while source fingerprints refresh without new case credit', () => {
  const report = runCorrectedCoverage(), prior = JSON.parse(readFileSync(new URL('../intent/0117/QUICK-EXECUTION-REPORT.json', import.meta.url))), current = new Map(report.executions.map(r => [r.id, r]));
  for (const old of prior.executions) for (const field of ['observationsDigest', 'observationCount', 'status']) assert.equal(current.get(old.id)[field], old[field], `${old.id}:${field}`);
  assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0120/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
