import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0107/execution-fixtures.mjs';
import { shortRetentionExecutionHook } from '../intent/0110/execution-hooks.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, zeroEffects, TRUST_REGISTRY } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant } from '../intent/0069/exact-time.candidate.mjs';
const source = JSON.parse(readFileSync(new URL('../intent/0110/SOURCE-MAP.json', import.meta.url)));
const make = fixtures.shortRetentionExecutionCase;

test('0110: exactly eight source coordinates map, with full positive/replay controls and propagating assertions', () => {
  const mapped = loadRequiredCases().cases.filter((row) => shortRetentionExecutionHook(row));
  assert.equal(mapped.length, 8);
  for (const row of mapped) {
    const observations = [], hook = shortRetentionExecutionHook(row);
    hook.run((input, invoke, expected) => { assert.equal(typeof input, 'string'); const actual = invoke();
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value);
      assert.deepEqual(actual.effects, zeroEffects()); observations.push(actual); });
    assert.equal(observations[0].state, 'validated-lifecycle-candidate'); assert.equal(observations[1].replayCount, 3);
    assert.equal(observations[2].state, 'blocked');
    assert.equal(observations.length, (row.coordinate.boundary === 'before' ? 6 : 4) + Number(row.coordinate.classId.startsWith('RC-CORPUS-')));
    assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
});

test('0110: trigger, parent cap and exact source observation instants are preserved for all eight cases', () => {
  for (const row of source.rows) for (const point of source.boundaries) {
    const legacy = JSON.parse(makeLifecycleGraph(row.classId, point)), value = make(row.classId, point);
    const trigger = JSON.parse(value.graph.eventBytes), state = JSON.parse(value.graph.stateBytes);
    assert.equal(trigger.eventType, row.eventType); assert.equal(trigger.occurredAt, JSON.parse(legacy.triggerBytes).occurredAt);
    assert.equal(value.evaluationTime, legacy.evaluationAt); assert.equal(state.parentExpiryAt, legacy.parentExpiryAt);
    assert.equal(value.boundaryAt, row.boundaryAt); assert.equal(state.parentExpiryAt, row.parentExpiryAt);
    assert.equal(value.config.recordClass, legacy.recordClass); assert.equal(value.runtimeBytes, undefined);
    assert.ok(exactInstant(value.evaluationTime) < exactInstant(TRUST_REGISTRY.bindings[0].notAfter));
    assert.equal(value.input, make(row.classId, point).input);
  }
});

test('0110: before-expiry evidence is fresh and already available, while scheduling does not validate disposition receipts', () => {
  for (const row of source.rows) {
    const before = make(row.classId, 'before'), complete = make(row.classId, 'complete');
    const state = JSON.parse(before.graph.stateBytes), inventory = JSON.parse(before.graph.inventoryBytes), now = exactInstant(before.evaluationTime);
    assert.ok(exactInstant(inventory.recordedAt) <= exactInstant(state.recordedAt)); assert.ok(exactInstant(state.recordedAt) <= now);
    assert.ok(now - exactInstant(inventory.recordedAt) < 300000000000n); assert.ok(exactInstant(state.validThrough) > now);
    assert.equal(state.inventoryDigest, inventory.recordDigest);
    assert.equal(state.historyDigest, sha256(jcs([...before.graph.historyBytes, before.graph.eventBytes])));
    assert.notEqual(before.graph.stateBytes, complete.graph.stateBytes); assert.equal(before.graph.eventBytes, complete.graph.eventBytes);
    const missing = make(row.classId, 'before', 'missing-receipt');
    assert.equal(missing.verifier.verify(missing.bytes, missing.evaluationTime).state, 'scheduled');
    const invalid = make(row.classId, 'before', 'missing-state');
    assert.equal(invalid.verifier.verify(invalid.bytes, invalid.evaluationTime).state, 'blocked');
  }
});

test('0110: completed paths bind both copies and tombstone with receipts after expiry and before exact plus-six-second observation', () => {
  for (const row of source.rows) {
    const value = make(row.classId, 'complete'), expiry = exactInstant(row.boundaryAt), now = exactInstant(value.evaluationTime);
    for (const entry of [...value.graph.copies, value.graph.tombstone]) {
      const receipt = JSON.parse(entry.receiptBytes), action = JSON.parse(entry.actionBundleBytes), request = JSON.parse(action.requestBytes);
      assert.ok(exactInstant(request.operation.requestedAt) >= expiry); assert.ok(exactInstant(receipt.recordedAt) <= now);
      assert.ok(exactInstant(receipt.recordedAt) >= exactInstant(request.operation.requestedAt));
      assert.ok(entry.humanBundleBytes.length > 0);
    }
    assert.ok(exactInstant(JSON.parse(value.graph.aggregateBytes).recordedAt) < exactInstant(JSON.parse(value.graph.tombstone.receiptBytes).recordedAt));
    for (const variant of ['missing-receipt', 'missing-state', ...(row.parentExpiryAt ? ['wrong-parent'] : [])]) {
      const invalid = make(row.classId, 'complete', variant); assert.equal(invalid.verifier.verify(invalid.bytes, invalid.evaluationTime).state, 'blocked');
    }
  }
});

test('0110: no arbitrary mutation or unmapped class/pending boundary is admitted by the closed adapter', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), ['immediateLifecycleExecutionCase', 'immutableRetentionExecutionCase', 'lifecycleGraphExecutionCase', 'lifecycleGraphVariants', 'lifecycleNegativeExecutionCase', 'lifecycleReadinessExecutionCase', 'longRetentionExecutionCase', 'rawDeadlineExecutionCase', 'releaseLifecycleExecutionCase', 'shortRetentionExecutionCase', 'specialLifecycleExecutionCase']);
  for (const args of [['RC-FAILED-RUN', 'at'], ['RC-FAILED-RUN', 'after'], ['RC-SECURITY-AUDIT', 'complete'], ['RC-FAILED-RUN', 'before', 'wrong-parent'], ['RC-CORPUS-EXPORT', 'complete', 'arbitrary']])
    assert.throws(() => make(...args), /UNKNOWN_SHORT_RETENTION_CASE/);
  for (const row of loadRequiredCases().cases.filter((row) => row.family === 'LIFECYCLE-GRAPH' && ['at', 'after'].includes(row.coordinate.boundary))) assert.equal(shortRetentionExecutionHook(row), null);
});

test('0110: fresh execution credits eight boundaries only and retains all independent and live limitations', () => {
  const report = runCorrectedCoverage(); assert.equal(report.passed, 393); assert.equal(report.executed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH'], { required: 64, executed: 52, passed: 52, failed: 0, uncovered: 12 });
  assert.equal(report.families.MIGRATION.executed, 0); assert.equal(report.families['LIFECYCLE-GRAPH-NEGATIVE'].passed, 30);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0116/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
