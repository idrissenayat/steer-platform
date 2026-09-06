import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0107/execution-fixtures.mjs';
import { lifecycleReadinessExecutionHook } from '../intent/0112/execution-hooks.mjs';
import { createLifecycleReadinessVerifier, createCurrentLifecycleReadinessVerifier } from '../intent/0112/lifecycle-readiness.candidate.mjs';
import { createLifecycleGraphVerifier, createCurrentLifecycleGraphVerifier } from '../intent/0061/lifecycle-graph.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, zeroEffects, TRUST_REGISTRY } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant, formatExactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const source = JSON.parse(readFileSync(new URL('../intent/0112/SOURCE-MAP.json', import.meta.url))), make = fixtures.lifecycleReadinessExecutionCase;
const limits = ['executionAuthorized', 'dispositionEvidenceVerified', 'quarantineVerified', 'deletionVerified', 'referenceClearanceVerified'];
const bounded = (result) => { for (const flag of limits) assert.equal(result[flag], false); assert.deepEqual(result.effects, zeroEffects()); };
const full = (classId, variant = 'positive') => (source.classes.indexOf(classId) < 4 ? fixtures.shortRetentionExecutionCase : fixtures.longRetentionExecutionCase)(classId, 'complete', variant);

test('0112: eighteen at/after coordinates execute full controls, readiness assertions and distinct signed semantic failures', () => {
  const rows = loadRequiredCases().cases.filter((row) => lifecycleReadinessExecutionHook(row)); assert.equal(rows.length, 18);
  for (const row of rows) {
    const outputs = [], hook = lifecycleReadinessExecutionHook(row);
    hook.run((input, invoke, expected) => { assert.equal(typeof input, 'string'); const actual = invoke();
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value); assert.deepEqual(actual.effects, zeroEffects()); outputs.push(actual); });
    assert.equal(outputs[0].state, 'validated-lifecycle-candidate'); assert.equal(outputs[1].replayCount, 3);
    assert.equal(outputs[2].state, 'waiting-retention'); assert.equal(outputs[3].state, 'eligible-pending-disposition-evidence');
    assert.equal(outputs.at(-1).state, 'blocked'); assert.equal(outputs.length, 16 + Number(['RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT'].includes(row.coordinate.classId)));
    assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
});

test('0112: source dates and parent caps are preserved with available head-only evidence and clock-bound observation seals', () => {
  for (const classId of source.classes) {
    const observed = [];
    for (const point of source.boundaries) {
      const value = make(classId, point), legacy = JSON.parse(makeLifecycleGraph(classId, point)), result = value.verifier.verify(value.bytes, value.evaluationTime);
      assert.equal(value.evaluationTime, legacy.evaluationAt); assert.equal(JSON.parse(value.head.stateBytes).parentExpiryAt, legacy.parentExpiryAt);
      const trigger = value.runtimeBytes ? JSON.parse(JSON.parse(value.head.historicalEvidenceBytes).eventBytes) : JSON.parse(value.head.eventBytes);
      assert.equal(trigger.occurredAt, JSON.parse(legacy.triggerBytes).occurredAt);
      for (const field of ['copies', 'aggregateBytes', 'tombstone', 'referenceRevocationBytes', 'actionBundleBytes']) assert.equal(Object.hasOwn(value.head, field), false);
      const state = JSON.parse(value.head.stateBytes), inventory = JSON.parse(value.head.inventoryBytes);
      assert.ok(exactInstant(inventory.recordedAt) <= exactInstant(state.recordedAt)); assert.ok(exactInstant(state.recordedAt) <= exactInstant(value.evaluationTime));
      assert.equal(state.inventoryDigest, inventory.recordDigest); bounded(result);
      assert.equal(result.inputDigest, sha256(jcs({ bytes: value.bytes, evaluatedAt: value.evaluationTime }))); observed.push(result.inputDigest);
    }
    assert.notEqual(observed[0], observed[1]);
  }
});

test('0112: readiness and disposition envelopes cannot be interchanged or enabled with extra complete-factory arguments', () => {
  for (const classId of source.classes) {
    const head = make(classId, 'at'), complete = full(classId);
    bounded(head.verifier.verify(complete.bytes, complete.evaluationTime)); assert.equal(head.verifier.verify(complete.bytes, complete.evaluationTime).state, 'blocked');
    assert.equal(complete.verifier.verify(head.bytes, head.evaluationTime).state, 'blocked');
    const extra = head.runtimeBytes ? createCurrentLifecycleGraphVerifier(head.configBytes, head.runtimeBytes, true) : createLifecycleGraphVerifier(head.configBytes, true);
    assert.equal(extra.verify(head.bytes, head.evaluationTime).state, 'blocked');
    const noReceipt = full(classId, 'missing-receipt'); assert.equal(noReceipt.verifier.verify(noReceipt.bytes, noReceipt.evaluationTime).state, 'blocked');
    const result = head.verifier.verify(head.bytes, head.evaluationTime); assert.notEqual(result.policyDigest, complete.verifier.policyDigest);
    assert.equal(result.dispositionPolicyDigest, complete.verifier.policyDigest); assert.equal(result.retentionEligible, true); bounded(result);
  }
});

test('0112: stale inventory, future state and unbound provider mutations have genuine signatures but cannot establish readiness', () => {
  for (const classId of source.classes) for (const variant of ['stale-inventory', 'future-state', 'wrong-provider']) {
    const value = make(classId, 'at', variant), registry = value.runtimeBytes ? JSON.parse(value.runtimeBytes).currentRegistryBytes : jcs(TRUST_REGISTRY);
    const timed = createTimedRecordVerifier(registry), state = JSON.parse(value.head.stateBytes), inventory = JSON.parse(value.head.inventoryBytes);
    const later = formatExactInstant(exactInstant(value.evaluationTime) + 3000000000n);
    assert.equal(timed.verifyBytes(value.head.inventoryBytes, { domain: 'provider', recordedAt: inventory.recordedAt, evaluatedAt: later }).record.recordDigest, inventory.recordDigest);
    assert.equal(timed.verifyBytes(value.head.stateBytes, { domain: 'authority', recordedAt: state.recordedAt, evaluatedAt: later }).record.recordDigest, state.recordDigest);
    assert.equal(state.inventoryDigest, inventory.recordDigest);
    const result = value.verifier.verify(value.bytes, value.evaluationTime); assert.equal(result.state, 'blocked'); bounded(result);
  }
});

test('0112: exact nanosecond expiry, unavailable state, stale observation and malformed clocks fail closed without clock substitution', () => {
  for (const classId of source.classes) {
    const value = make(classId, 'at'), expiry = exactInstant(value.boundaryAt), state = JSON.parse(value.head.stateBytes);
    assert.equal(value.verifier.verify(value.bytes, formatExactInstant(expiry - 1n)).state, 'waiting-retention');
    assert.equal(value.verifier.verify(value.bytes, formatExactInstant(expiry)).state, 'eligible-pending-disposition-evidence');
    for (const time of [formatExactInstant(exactInstant(state.recordedAt) - 1n), state.validThrough, '2026-02-29T12:00:00Z', '2026-09-04T12:00:00.1Z', null]) {
      const result = value.verifier.verify(value.bytes, time); assert.equal(result.state, 'blocked'); bounded(result);
    }
  }
});

test('0112: authoritative held/reference-active states retain conservatively and no result conveys clearance or a mutable capability', () => {
  for (const classId of source.classes) {
    for (const variant of ['active-hold', 'reference-active']) {
      const value = make(classId, 'after', variant), result = value.verifier.verify(value.bytes, value.evaluationTime);
      assert.equal(result.state, 'retained-on-hold'); assert.equal(result.retentionEligible, false); bounded(result);
    }
    const value = make(classId, 'after'), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.requires.includes('reference-clearance'), classId === 'RC-REFERENCED-EVIDENCE');
    assert.ok(result.requires.includes('human-disposition-authority')); assert.ok(result.requires.includes('tombstone'));
    result.executionAuthorized = true; result.effects.lifecycle = 1; bounded(value.verifier.verify(value.bytes, value.evaluationTime)); assert.ok(Object.isFrozen(value.verifier));
  }
});

test('0112: closed configuration rejects unsupported classes, old current profiles and request-supplied policy or effect fields', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), ['immediateLifecycleExecutionCase', 'immutableRetentionExecutionCase', 'lifecycleGraphExecutionCase', 'lifecycleGraphVariants', 'lifecycleNegativeExecutionCase', 'lifecycleReadinessExecutionCase', 'longRetentionExecutionCase', 'rawDeadlineExecutionCase', 'releaseLifecycleExecutionCase', 'shortRetentionExecutionCase', 'specialLifecycleExecutionCase']);
  const original = make('RC-FAILED-RUN', 'at'), current = make('RC-SECURITY-AUDIT', 'at');
  for (const classId of ['RC-AUTHORITATIVE-ARTIFACT', 'RC-CORPUS-RAW-WORKING', 'RC-REBUILDABLE'])
    assert.throws(() => createLifecycleReadinessVerifier(jcs({ ...JSON.parse(original.configBytes), recordClass: classId })), /CONFIGURATION_INVALID/);
  const oldRuntime = JSON.parse(current.runtimeBytes); oldRuntime.version = 'steer-lifecycle-runtime/v1'; delete oldRuntime.archivedOwnerContextBytes;
  assert.throws(() => createCurrentLifecycleReadinessVerifier(current.configBytes, jcs(oldRuntime)), /CONFIGURATION_INVALID/);
  for (const variant of ['extra-field', 'wrong-target', 'wrong-policy', 'wrong-config']) {
    const value = make('RC-FAILED-RUN', 'at', variant); assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, 'blocked');
  }
  assert.throws(() => make('RC-REBUILDABLE', 'at'), /UNKNOWN_LIFECYCLE_READINESS_CASE/);
  assert.throws(() => make('RC-FAILED-RUN', 'at', 'caller-code'), /UNKNOWN_LIFECYCLE_READINESS_CASE/);
});

test('0112: existing mapped observations remain byte-for-byte stable while eighteen new pending coordinates are credited', () => {
  const report = runCorrectedCoverage(), prior = JSON.parse(readFileSync(new URL('../intent/0111/QUICK-EXECUTION-REPORT.json', import.meta.url)));
  for (const old of prior.executions) { const row = report.executions.find((entry) => entry.id === old.id);
    assert.equal(row.observationsDigest, old.observationsDigest, old.id); assert.equal(row.observationCount, old.observationCount); assert.equal(row.status, old.status); }
  assert.equal(report.executed, 393); assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH'], { required: 64, executed: 52, passed: 52, failed: 0, uncovered: 12 });
  assert.equal(report.families.MIGRATION.executed, 0);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0116/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
