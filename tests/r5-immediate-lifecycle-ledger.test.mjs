import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0107/execution-fixtures.mjs';
import { immediateLifecycleExecutionHook } from '../intent/0115/execution-hooks.mjs';
import { createImmediateLifecycleReadinessVerifier } from '../intent/0115/lifecycle-immediate.candidate.mjs';
import { createLifecycleGraphVerifier, createLifecycleReadinessVerifier } from '../intent/0061/lifecycle-graph.candidate.mjs';
import { makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, zeroEffects, TRUST_REGISTRY, sha256 } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { exactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const source = JSON.parse(readFileSync(new URL('../intent/0115/SOURCE-MAP.json', import.meta.url))), make = fixtures.immediateLifecycleExecutionCase;
const deniedFlags = ['executionAuthorized', 'dispositionEvidenceVerified', 'quarantineVerified', 'deletionVerified', 'referenceClearanceVerified'];
const limits = (result) => { for (const flag of deniedFlags) assert.equal(result[flag], false); assert.deepEqual(result.effects, zeroEffects()); };

test('0115: exact source observations distinguish available pre-trigger history from observed immediate expiry', () => {
  for (const [point, clock] of Object.entries(source.observations)) {
    const old = JSON.parse(makeLifecycleGraph(source.classId, point)), value = make(point), head = value.head, result = value.verifier.verify(value.bytes, clock);
    assert.equal(old.evaluationAt, clock); assert.equal(value.evaluationTime, clock); assert.equal(JSON.parse(old.triggerBytes).occurredAt, source.sourceTriggerAt);
    assert.equal(result.state, point === 'before' ? 'waiting-for-trigger' : 'eligible-pending-disposition-evidence');
    assert.equal(result.retentionEligible, point !== 'before'); assert.equal(result.boundaryAt, point === 'before' ? null : source.sourceTriggerAt); limits(result);
    const records = [...head.historyBytes, head.eventBytes].map(JSON.parse);
    assert.ok(records.every((record) => exactInstant(record.occurredAt) <= exactInstant(clock)));
    if (point === 'before') { assert.ok(!records.some((r) => ['record-superseded', 'rebuild-requested'].includes(r.eventType))); assert.equal(result.requires[0], 'observed-trigger'); }
    else assert.equal(records.at(-1).occurredAt, source.sourceTriggerAt);
    assert.ok(exactInstant(JSON.parse(head.inventoryBytes).recordedAt) <= exactInstant(clock)); assert.ok(exactInstant(JSON.parse(head.stateBytes).recordedAt) <= exactInstant(clock));
    for (const field of ['copies', 'aggregateBytes', 'tombstone', 'rawPolicyBytes']) assert.equal(Object.hasOwn(head, field), false);
  }
});

test('0115: both observed trigger orderings choose the earliest event while exact future evidence cannot establish eligibility', () => {
  for (const point of ['at', 'after', 'complete']) for (const variant of ['earliest-superseded', 'earliest-rebuild']) {
    const value = make(point, variant), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.boundaryAt, '2026-09-04T11:59:40Z'); assert.equal(result.retentionEligible, true); limits(result);
  }
  const value = make('at'), first = value.verifier.verify(value.bytes, value.evaluationTime), second = value.verifier.verify(value.bytes, source.observations.after);
  assert.notEqual(first.inputDigest, second.inputDigest); assert.equal(first.inputDigest, sha256(jcs({ bytes: value.bytes, evaluatedAt: value.evaluationTime })));
  for (const point of Object.keys(source.observations)) {
    const future = make(point, 'future-trigger'); assert.equal(exactInstant(JSON.parse(future.head.eventBytes).occurredAt) - exactInstant(future.evaluationTime), 1n);
    const result = future.verifier.verify(future.bytes, future.evaluationTime); assert.equal(result.state, 'blocked'); limits(result);
  }
  for (const clock of [undefined, '', '2026-09-04T12:00:00.1Z', '2026-09-04T11:59:59.999999999Z']) assert.equal(value.verifier.verify(value.bytes, clock).state, 'blocked');
});

test('0115: signed stale future incomplete and unbound-provider head evidence fails along with missing or corrupt proofs', () => {
  const timed = createTimedRecordVerifier(jcs(TRUST_REGISTRY));
  for (const point of ['before', 'at']) for (const variant of ['missing-state', 'missing-inventory', 'bad-history', 'incomplete-history', 'stale-inventory', 'future-state', 'wrong-provider', 'wrong-target', 'wrong-policy', 'extra-field']) {
    const value = make(point, variant), result = value.verifier.verify(value.bytes, value.evaluationTime); assert.equal(result.state, 'blocked', variant); limits(result);
    if (['incomplete-history', 'future-state', 'stale-inventory', 'wrong-provider'].includes(variant)) {
      const inventory = ['stale-inventory', 'wrong-provider'].includes(variant), bytes = value.head[inventory ? 'inventoryBytes' : 'stateBytes'], record = JSON.parse(bytes);
      assert.equal(timed.verifyBytes(bytes, { domain: inventory ? 'provider' : 'authority', recordedAt: record.recordedAt, evaluatedAt: source.observations.complete }).record.recordDigest, record.recordDigest);
    }
  }
});

test('0115: held and reference-active heads remain non-mutable with or without an observed trigger', () => {
  for (const point of Object.keys(source.observations)) for (const variant of ['active-hold', 'reference-active']) {
    const value = make(point, variant), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'retained-on-hold'); assert.equal(result.retentionEligible, false); limits(result);
    assert.equal(result.boundaryAt, point === 'before' ? null : source.sourceTriggerAt);
  }
});

test('0115: distinct profiles and complete envelopes cannot be interchanged or selected with extra full-factory arguments', () => {
  const immediate = make('at'), full = make('complete', 'full-positive'), ordinary = fixtures.lifecycleReadinessExecutionCase('RC-FAILED-RUN', 'at');
  assert.throws(() => createLifecycleReadinessVerifier(immediate.configBytes), /CONFIGURATION_INVALID/);
  for (const classId of ['RC-FAILED-RUN', 'RC-AUTHORITATIVE-ARTIFACT', 'RC-CORPUS-RAW-WORKING', 'RC-SECURITY-AUDIT'])
    assert.throws(() => createImmediateLifecycleReadinessVerifier(jcs({ ...JSON.parse(immediate.configBytes), recordClass: classId })), /CONFIGURATION_INVALID/);
  assert.equal(immediate.verifier.verify(full.bytes, full.evaluationTime).state, 'blocked');
  assert.equal(full.verifier.verify(immediate.bytes, full.evaluationTime).state, 'blocked');
  assert.equal(createLifecycleGraphVerifier(immediate.configBytes, 'immediate', true).verify(immediate.bytes, full.evaluationTime).state, 'blocked');
  assert.equal(immediate.verifier.verify(ordinary.bytes, full.evaluationTime).state, 'blocked'); assert.equal(ordinary.verifier.verify(immediate.bytes, full.evaluationTime).state, 'blocked');
  for (const version of ['steer-lifecycle-readiness/v1', 'steer-lifecycle-graph/v1']) assert.equal(immediate.verifier.verify(jcs({ ...immediate.head, version }), immediate.evaluationTime).state, 'blocked');
  const missingTrigger = make('before'), graph = { version: 'steer-lifecycle-graph/v1', policyDigest: missingTrigger.fullVerifier.policyDigest,
    ...Object.fromEntries(['configDigest', 'eventBytes', 'historyBytes', 'inventoryBytes', 'stateBytes'].map(k => [k, missingTrigger.head[k]])), referenceRevocationBytes: '', copies: [], aggregateBytes: '', tombstone: {} };
  assert.equal(missingTrigger.fullVerifier.verify(jcs(graph), missingTrigger.evaluationTime).state, 'blocked');
});

test('0115: original complete +6-second graph and replay still require all receipts and never become read-only evidence', () => {
  for (const variant of ['full-positive', 'full-replay', 'full-missing-receipt']) {
    const value = make('complete', variant), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(value.evaluationTime, source.observations.complete); assert.deepEqual(result.effects, zeroEffects());
    assert.equal(result.state, variant === 'full-missing-receipt' ? 'blocked' : 'validated-lifecycle-candidate');
    if (variant !== 'full-missing-receipt') { assert.equal(result.replayCount, variant === 'full-replay' ? 3 : 0); assert.equal(result.copyCount, 2); assert.equal(result.protectedActionCount, 3); }
  }
});

test('0115: closed four-coordinate hooks assert pinned fields, reject arbitrary selectors and propagate failures', () => {
  const rows = loadRequiredCases().cases.filter(r => immediateLifecycleExecutionHook(r)); assert.equal(rows.length, 4);
  for (const row of rows) { let count = 0; const hook = immediateLifecycleExecutionHook(row);
    hook.run((input, invoke, expected) => { assert.equal(typeof input, 'string'); const result = invoke(); for (const [key, value] of Object.entries(expected)) assert.deepEqual(result[key], value); assert.deepEqual(result.effects, zeroEffects()); count++; });
    assert.equal(count, row.coordinate.boundary === 'before' ? 19 : 21); assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
  for (const [point, variant] of [['bad', 'positive'], ['at', 'caller-mutation'], ['at', 'full-positive'], ['before', 'earliest-rebuild']]) assert.throws(() => make(point, variant), /UNKNOWN_IMMEDIATE_LIFECYCLE_CASE/);
  assert.deepEqual(Object.keys(fixtures).sort(), ['immediateLifecycleExecutionCase', 'immutableRetentionExecutionCase', 'lifecycleGraphExecutionCase', 'lifecycleGraphVariants', 'lifecycleNegativeExecutionCase', 'lifecycleReadinessExecutionCase', 'longRetentionExecutionCase', 'rawDeadlineExecutionCase', 'releaseLifecycleExecutionCase', 'shortRetentionExecutionCase', 'specialLifecycleExecutionCase']);
});

test('0115: existing complete and readiness observations stay unchanged while the four immediate coordinates map', () => {
  const report = runCorrectedCoverage(), prior = JSON.parse(readFileSync(new URL('../intent/0114/QUICK-EXECUTION-REPORT.json', import.meta.url)));
  const current = new Map(report.executions.map(r => [r.id, r])); for (const old of prior.executions) for (const field of ['observationsDigest', 'observationCount', 'status']) assert.equal(current.get(old.id)[field], old[field], `${old.id}:${field}`);
  assert.equal(report.executed, 393); assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH'], { required: 64, executed: 52, passed: 52, failed: 0, uncovered: 12 });
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0116/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
