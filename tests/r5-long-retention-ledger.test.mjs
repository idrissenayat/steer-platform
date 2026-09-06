import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0107/execution-fixtures.mjs';
import { longRetentionExecutionHook } from '../intent/0111/execution-hooks.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { createLifecycleGraphVerifier } from '../intent/0061/lifecycle-graph.candidate.mjs';
import { createReferenceLifecycleVerifier } from '../intent/0089/reference-lifecycle.candidate.mjs';
import { makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, zeroEffects, TRUST_REGISTRY } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant } from '../intent/0069/exact-time.candidate.mjs';
const source = JSON.parse(readFileSync(new URL('../intent/0111/SOURCE-MAP.json', import.meta.url))), make = fixtures.longRetentionExecutionCase;

test('0111: ten exact source coordinates execute full current positive/replay controls and propagate failed assertions', () => {
  const mapped = loadRequiredCases().cases.filter((row) => longRetentionExecutionHook(row)); assert.equal(mapped.length, 10);
  for (const row of mapped) {
    const observations = [], hook = longRetentionExecutionHook(row);
    hook.run((input, invoke, expected) => { const actual = invoke(); assert.equal(typeof input, 'string');
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value);
      assert.deepEqual(actual.effects, zeroEffects()); assert.equal(actual.executionAuthorized, false); observations.push(actual); });
    assert.equal(observations[0].state, 'validated-lifecycle-candidate'); assert.equal(observations[1].replayCount, 3);
    assert.equal(observations.length, (row.coordinate.boundary === 'before' ? 7 : 5) + Number(row.coordinate.classId === 'RC-REFERENCED-EVIDENCE'));
    assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
});

test('0111: exact source instants and original per-domain key windows are preserved without treating old action authority as current', () => {
  for (const row of source.rows) for (const point of source.boundaries) {
    const value = make(row.classId, point), legacy = JSON.parse(makeLifecycleGraph(row.classId, point)), runtime = JSON.parse(value.runtimeBytes);
    const registry = JSON.parse(runtime.currentRegistryBytes), archived = JSON.parse(value.graph.historicalEvidenceBytes), event = JSON.parse(archived.eventBytes);
    assert.equal(event.occurredAt, JSON.parse(legacy.triggerBytes).occurredAt); assert.equal(event.eventType, row.eventType);
    assert.equal(value.evaluationTime, legacy.evaluationAt); assert.equal(value.boundaryAt, row.boundaryAt); assert.equal(JSON.parse(value.graph.stateBytes).parentExpiryAt, legacy.parentExpiryAt);
    for (const key of TRUST_REGISTRY.bindings) {
      assert.deepEqual(registry.bindings.find((entry) => entry.keyId === key.keyId), key);
      assert.ok(exactInstant(event.occurredAt) < exactInstant(key.notAfter));
      assert.equal(exactInstant(value.evaluationTime) > exactInstant(key.notAfter), !['provider-a', 'provider-b'].includes(key.domain));
    }
    assert.equal(new Set(registry.bindings.map((key) => key.publicKeyHex)).size, registry.bindings.length);
    assert.equal(runtime.version, row.classId === 'RC-REFERENCED-EVIDENCE' ? 'steer-lifecycle-runtime/v5' : 'steer-lifecycle-runtime/v4');
    assert.equal(createLifecycleGraphVerifier(value.configBytes).verify(value.bytes, value.evaluationTime).state, 'blocked');
    assert.equal(make(row.classId, point).input, value.input);
  }
});

test('0111: fresh archive witnesses and state are available before observation while original retained event bytes stay identical', () => {
  for (const row of source.rows) {
    const before = make(row.classId, 'before'), complete = make(row.classId, 'complete');
    const history = JSON.parse(before.graph.historicalEvidenceBytes), later = JSON.parse(complete.graph.historicalEvidenceBytes);
    assert.equal(history.eventBytes, later.eventBytes); assert.deepEqual(history.historyBytes, later.historyBytes);
    assert.notEqual(history.retentionReceiptBytes, later.retentionReceiptBytes);
    const state = JSON.parse(before.graph.stateBytes), inventory = JSON.parse(before.graph.inventoryBytes), receipt = JSON.parse(history.retentionReceiptBytes), now = exactInstant(before.evaluationTime);
    assert.ok(exactInstant(receipt.recordedAt) <= exactInstant(state.recordedAt)); assert.ok(exactInstant(inventory.recordedAt) <= exactInstant(state.recordedAt));
    assert.ok(exactInstant(state.recordedAt) <= now); assert.ok(now < exactInstant(state.validThrough));
    assert.equal(state.historyDigest, sha256(jcs([...before.graph.historyBytes, before.graph.eventBytes])));
    for (const variant of ['missing-history', 'missing-state']) {
      const invalid = make(row.classId, 'before', variant); assert.equal(invalid.verifier.verify(invalid.bytes, invalid.evaluationTime).state, 'blocked');
    }
    const noReceipt = make(row.classId, 'before', 'missing-receipt'); assert.equal(noReceipt.verifier.verify(noReceipt.bytes, noReceipt.evaluationTime).state, 'scheduled');
  }
});

test('0111: complete current copy and reference paths bind post-boundary receipts and the exact named tombstone', () => {
  for (const row of source.rows) {
    const value = make(row.classId, 'complete'), now = exactInstant(value.evaluationTime), expiry = exactInstant(row.boundaryAt);
    for (const entry of [...value.graph.copies, value.graph.tombstone]) {
      const receipt = JSON.parse(entry.receiptBytes), authority = JSON.parse(JSON.parse(entry.humanBundleBytes).authorityBytes);
      assert.ok(exactInstant(receipt.recordedAt) >= expiry); assert.ok(exactInstant(receipt.recordedAt) <= now);
      assert.equal(receipt.signature.keyId.endsWith('-current'), true); assert.equal(authority.signature.keyId, 'authority-key-current');
    }
    if (row.classId === 'RC-REFERENCED-EVIDENCE') {
      const reference = JSON.parse(value.graph.referenceRevocationBytes); assert.equal(reference.referenceReceiptBytes.length, 2);
      assert.equal(JSON.parse(reference.completionBytes).tombstoneRecordId, 'tombstone-evidence-1');
      for (const point of source.boundaries) { const missing = make(row.classId, point, 'missing-reference');
        assert.equal(missing.verifier.verify(missing.bytes, missing.evaluationTime).state, point === 'before' ? 'scheduled' : 'retained-pending-safe-disposition'); }
      assert.throws(() => createReferenceLifecycleVerifier(value.configBytes, jcs({ ...JSON.parse(value.runtimeBytes), version: 'steer-lifecycle-runtime/v4' })), /REFERENCE_LIFECYCLE_CONFIGURATION_INVALID/);
    }
  }
});

test('0111: closed adapters do not admit unsupported classes, arbitrary mutation or pending-state coordinates', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), ['lifecycleGraphExecutionCase', 'lifecycleGraphVariants', 'lifecycleNegativeExecutionCase', 'lifecycleReadinessExecutionCase', 'longRetentionExecutionCase', 'shortRetentionExecutionCase', 'specialLifecycleExecutionCase']);
  for (const args of [['RC-SECURITY-AUDIT', 'at'], ['RC-SECURITY-AUDIT', 'after'], ['RC-CORPUS-SANITIZED', 'complete'], ['RC-LEGAL-SIGNED-LOG', 'complete', 'missing-reference'], ['RC-REFERENCED-EVIDENCE', 'complete', 'arbitrary']])
    assert.throws(() => make(...args), /UNKNOWN_LONG_RETENTION_CASE/);
  for (const row of loadRequiredCases().cases.filter((row) => row.family === 'LIFECYCLE-GRAPH' && ['at', 'after'].includes(row.coordinate.boundary))) assert.equal(longRetentionExecutionHook(row), null);
});

test('0111: fresh report maps eighteen boundary coordinates but preserves remaining normative and independent gaps', () => {
  const report = runCorrectedCoverage(); assert.equal(report.passed, 377); assert.equal(report.executed, 377); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3659);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH'], { required: 64, executed: 36, passed: 36, failed: 0, uncovered: 28 });
  assert.equal(report.families.MIGRATION.executed, 0); assert.equal(report.families['LIFECYCLE-GRAPH-NEGATIVE'].passed, 30);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0112/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
