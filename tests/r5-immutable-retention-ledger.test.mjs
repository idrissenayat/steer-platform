import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0107/execution-fixtures.mjs';
import { immutableRetentionExecutionHook } from '../intent/0113/execution-hooks.mjs';
import { makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, zeroEffects, TRUST_REGISTRY } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { createLifecycleReadinessVerifier } from '../intent/0112/lifecycle-readiness.candidate.mjs';
import { exactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const source = JSON.parse(readFileSync(new URL('../intent/0113/SOURCE-MAP.json', import.meta.url))), make = fixtures.immutableRetentionExecutionCase;

test('0113: four source labels explicitly alias one immutable observation rather than four distinct expiry instants', () => {
  const oldInputs = [], inputs = [];
  for (const label of source.labels) {
    const old = makeLifecycleGraph(source.classId, label), legacy = JSON.parse(old), value = make(label);
    assert.equal(legacy.evaluationAt, source.observedAt); assert.equal(value.evaluationTime, legacy.evaluationAt);
    assert.equal(JSON.parse(value.graph.eventBytes).occurredAt, JSON.parse(legacy.triggerBytes).occurredAt);
    assert.equal(JSON.parse(value.graph.eventBytes).eventType, 'record-committed'); assert.equal(JSON.parse(value.graph.stateBytes).parentExpiryAt, null);
    oldInputs.push(old); inputs.push(value.input);
  }
  assert.equal(new Set(oldInputs).size, 1); assert.equal(new Set(inputs).size, source.uniquePositiveInputs); assert.equal(source.uniquePositiveInputs, 1);
});

test('0113: immutable controls use available commit-time event/inventory/state with no future effect evidence', () => {
  const value = make('at'), state = JSON.parse(value.graph.stateBytes), inventory = JSON.parse(value.graph.inventoryBytes), now = exactInstant(value.evaluationTime);
  assert.equal(exactInstant(state.recordedAt), now); assert.equal(exactInstant(inventory.recordedAt), now); assert.ok(now < exactInstant(state.validThrough));
  assert.equal(state.inventoryDigest, inventory.recordDigest); assert.deepEqual(value.graph.copies, []); assert.equal(value.graph.aggregateBytes, ''); assert.deepEqual(value.graph.tombstone, {});
  const result = value.verifier.verify(value.bytes, value.evaluationTime);
  assert.deepEqual(result, { state: 'retained-immutable', firstError: null, effects: zeroEffects(), boundaryAt: null });
  assert.throws(() => createLifecycleReadinessVerifier(value.configBytes), /CONFIGURATION_INVALID/);
});

test('0113: indefinite policy does not become deletion or effect acceptance under held state or injected disposition records', () => {
  for (const variant of ['active-hold', 'effects-injected']) {
    const value = make('complete', variant), before = value.bytes, result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'retained-immutable'); assert.equal(result.boundaryAt, null); assert.deepEqual(result.effects, zeroEffects()); assert.equal(value.bytes, before);
    if (variant === 'effects-injected') {
      assert.equal(value.graph.copies.length, 2); assert.ok(exactInstant(JSON.parse(value.graph.copies[0].receiptBytes).recordedAt) > exactInstant(value.evaluationTime));
      assert.equal(Object.hasOwn(result, 'copyCount'), false); assert.equal(Object.hasOwn(result, 'evidenceDigest'), false);
    }
  }
});

test('0113: real signed semantic failures and an outer-signed event with invalid provider proof remain blocked', () => {
  const timed = createTimedRecordVerifier(jcs(TRUST_REGISTRY));
  for (const variant of ['missing-state', 'missing-inventory', 'wrong-parent', 'future-state', 'wrong-history', 'wrong-trigger', 'proposed-expiry', 'bad-event-proof']) {
    const value = make('at', variant), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'blocked', variant); assert.equal(result.firstError, 'LIFECYCLE_GRAPH_INVALID'); assert.deepEqual(result.effects, zeroEffects());
    if (['wrong-parent', 'future-state', 'wrong-history'].includes(variant)) {
      const state = JSON.parse(value.graph.stateBytes); assert.equal(timed.verifyBytes(value.graph.stateBytes, { domain: 'authority', recordedAt: state.recordedAt, evaluatedAt: '2026-09-04T12:00:01Z' }).record.recordDigest, state.recordDigest);
    }
    if (variant === 'bad-event-proof') {
      const event = JSON.parse(value.graph.eventBytes); assert.equal(timed.verifyBytes(value.graph.eventBytes, { domain: 'record', recordedAt: event.occurredAt, evaluatedAt: value.evaluationTime }).record.recordDigest, event.recordDigest);
    }
  }
});

test('0113: exact selector maps four IDs with eleven observations each and never swallows an assertion failure', () => {
  const mapped = loadRequiredCases().cases.filter((row) => immutableRetentionExecutionHook(row)); assert.equal(mapped.length, 4);
  for (const row of mapped) {
    const observations = [], hook = immutableRetentionExecutionHook(row);
    hook.run((input, invoke, expected) => { const result = invoke(); for (const [key, value] of Object.entries(expected)) assert.deepEqual(result[key], value); assert.deepEqual(result.effects, zeroEffects()); observations.push(input); });
    assert.equal(observations.length, 11); assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
  assert.throws(() => make('unknown'), /UNKNOWN_IMMUTABLE_RETENTION_CASE/); assert.throws(() => make('at', 'caller-mutation'), /UNKNOWN_IMMUTABLE_RETENTION_CASE/);
  assert.deepEqual(Object.keys(fixtures).sort(), ['immediateLifecycleExecutionCase', 'immutableRetentionExecutionCase', 'lifecycleGraphExecutionCase', 'lifecycleGraphVariants', 'lifecycleNegativeExecutionCase', 'lifecycleReadinessExecutionCase', 'longRetentionExecutionCase', 'provenanceChildDispositionExecutionCase', 'rawDeadlineExecutionCase', 'releaseLifecycleExecutionCase', 'shortRetentionExecutionCase', 'specialLifecycleExecutionCase']);
});

test('0113: fresh report credits the four declared immutable aliases without claiming unique time boundaries or formal closure', () => {
  const report = runCorrectedCoverage(); assert.equal(report.executed, 393); assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH'], { required: 64, executed: 52, passed: 52, failed: 0, uncovered: 12 });
  const rows = report.executions.filter((row) => row.id.startsWith('LIFECYCLE-GRAPH:RC-AUTHORITATIVE-ARTIFACT:'));
  assert.equal(rows.length, 4); assert.equal(new Set(rows.map((row) => row.observationsDigest)).size, 1);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.equal(report.families.MIGRATION.executed, 0);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0117/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
