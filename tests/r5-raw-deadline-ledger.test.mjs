import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0107/execution-fixtures.mjs';
import { rawDeadlineExecutionHook } from '../intent/0114/execution-hooks.mjs';
import { makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, zeroEffects, TRUST_REGISTRY } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { exactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const source = JSON.parse(readFileSync(new URL('../intent/0114/SOURCE-MAP.json', import.meta.url))), make = fixtures.rawDeadlineExecutionCase;
const timed = createTimedRecordVerifier(jcs(TRUST_REGISTRY));
const signed = (bytes, domain, evaluationTime) => { const record = JSON.parse(bytes); assert.equal(timed.verifyBytes(bytes, { domain, recordedAt: record.recordedAt, evaluatedAt: evaluationTime }).record.recordDigest, record.recordDigest); return record; };

test('0114: source terminal and all four distinct observation instants are preserved without treating the deadline as a minimum wait', () => {
  const inputs = [];
  for (const [point, time] of Object.entries(source.observations)) {
    const legacy = JSON.parse(makeLifecycleGraph(source.classId, point)), value = make(point), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(legacy.evaluationAt, time); assert.equal(value.evaluationTime, time);
    assert.equal(JSON.parse(value.graph.eventBytes).occurredAt, JSON.parse(legacy.triggerBytes).occurredAt);
    assert.equal(JSON.parse(value.graph.eventBytes).occurredAt, source.terminalAt); assert.equal(result.boundaryAt, source.deadlineAt);
    assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.copyCount, 3); assert.equal(result.protectedActionCount, 4);
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects()); inputs.push(value.input);
    for (const entry of value.graph.copies) assert.ok(exactInstant(JSON.parse(entry.receiptBytes).recordedAt) < exactInstant(source.deadlineAt));
  }
  assert.equal(new Set(inputs).size, 4);
});

test('0114: inclusive deadline succeeds while genuine signed receipts one nanosecond and one second late fail with otherwise valid lineage', () => {
  const positive = make('complete', 'deadline-receipt'), base = positive.graph;
  assert.equal(positive.verifier.verify(positive.bytes, positive.evaluationTime).state, 'validated-lifecycle-candidate');
  assert.equal(exactInstant(signed(base.copies[2].receiptBytes, 'provider-a', positive.evaluationTime).recordedAt), exactInstant(source.deadlineAt));
  for (const [variant, late] of [['late-receipt', 1n], ['late-second', 1000000000n]]) {
    const value = make('complete', variant), graph = value.graph, result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(exactInstant(signed(graph.copies[2].receiptBytes, 'provider-a', value.evaluationTime).recordedAt) - exactInstant(source.deadlineAt), late);
    for (const field of ['eventBytes', 'historyBytes', 'inventoryBytes', 'stateBytes', 'rawPolicyBytes', 'rawBatchBytes']) assert.deepEqual(graph[field], base[field]);
    assert.deepEqual(graph.copies.slice(0, 2), base.copies.slice(0, 2)); assert.equal(graph.copies[2].actionBundleBytes, base.copies[2].actionBundleBytes);
    const aggregate = signed(graph.aggregateBytes, 'provider', value.evaluationTime), tombstone = signed(graph.tombstone.receiptBytes, 'provider-a', value.evaluationTime);
    assert.deepEqual(aggregate.receiptDigests, graph.copies.map((entry) => JSON.parse(entry.receiptBytes).recordDigest));
    assert.ok(exactInstant(aggregate.recordedAt) > exactInstant(JSON.parse(graph.copies[2].receiptBytes).recordedAt));
    assert.ok(exactInstant(tombstone.recordedAt) > exactInstant(aggregate.recordedAt));
    assert.equal(result.state, 'blocked'); assert.equal(result.firstError, 'LIFECYCLE_GRAPH_INVALID'); assert.deepEqual(result.effects, zeroEffects());
  }
});

test('0114: earlier observations cannot consume future aggregate and tombstone evidence, and grant or completion omissions never become success', () => {
  for (const point of Object.keys(source.observations)) {
    for (const variant of ['missing-grant', 'expired-grant', 'missing-state', 'missing-receipt', 'missing-batch', 'missing-tombstone']) {
      const value = make(point, variant), result = value.verifier.verify(value.bytes, value.evaluationTime);
      assert.equal(result.state, 'blocked', `${point}:${variant}`); assert.deepEqual(result.effects, zeroEffects());
    }
    if (point !== 'complete') {
      const value = make(point, 'deadline-receipt'); assert.ok(exactInstant(JSON.parse(value.graph.aggregateBytes).recordedAt) > exactInstant(value.evaluationTime));
      assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, 'blocked');
    }
  }
});

test('0114: exact committed replay has four no-op reconciliations and held/reference-active state cannot permit erasure', () => {
  for (const point of Object.keys(source.observations)) {
    const value = make(point, 'replay'), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.replayCount, 4); assert.equal(result.rawBatchMode, 'replay');
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    for (const variant of ['held', 'reference-active']) {
      const held = make(point, variant); signed(held.graph.stateBytes, 'authority', held.evaluationTime);
      const retained = held.verifier.verify(held.bytes, held.evaluationTime); assert.equal(retained.state, 'retained-on-hold'); assert.deepEqual(retained.effects, zeroEffects());
    }
  }
});

test('0114: closed selectors execute four source coordinates with paired deadline controls and propagate assertion failures', () => {
  const rows = loadRequiredCases().cases.filter((row) => rawDeadlineExecutionHook(row)); assert.equal(rows.length, 4);
  for (const row of rows) {
    const hook = rawDeadlineExecutionHook(row); let count = 0;
    hook.run((input, invoke, expected) => { assert.equal(typeof input, 'string'); const result = invoke(); for (const [key, value] of Object.entries(expected)) assert.deepEqual(result[key], value); assert.deepEqual(result.effects, zeroEffects()); count++; });
    assert.equal(count, row.coordinate.boundary === 'complete' ? 13 : 16); assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
  assert.throws(() => make('terminal'), /UNKNOWN_RAW_DEADLINE_CASE/); assert.throws(() => make('at', 'caller-mutation'), /UNKNOWN_RAW_DEADLINE_CASE/);
  assert.deepEqual(Object.keys(fixtures).sort(), ['immutableRetentionExecutionCase', 'lifecycleGraphExecutionCase', 'lifecycleGraphVariants', 'lifecycleNegativeExecutionCase', 'lifecycleReadinessExecutionCase', 'longRetentionExecutionCase', 'rawDeadlineExecutionCase', 'shortRetentionExecutionCase', 'specialLifecycleExecutionCase']);
});

test('0114: fresh report maps four raw deadline coordinates while preserving all previous observation seals and formal boundaries', () => {
  const report = runCorrectedCoverage(), prior = JSON.parse(readFileSync(new URL('../intent/0113/QUICK-EXECUTION-REPORT.json', import.meta.url)));
  assert.equal(report.executed, 385); assert.equal(report.passed, 385); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3651);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH'], { required: 64, executed: 44, passed: 44, failed: 0, uncovered: 20 });
  const current = new Map(report.executions.map((row) => [row.id, row]));
  for (const old of prior.executions) { const row = current.get(old.id); for (const field of ['observationsDigest', 'observationCount', 'status']) assert.equal(row[field], old[field], `${old.id}:${field}`); }
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.equal(report.families.MIGRATION.executed, 0);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0114/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
