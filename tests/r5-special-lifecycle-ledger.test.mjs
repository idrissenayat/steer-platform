import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0107/execution-fixtures.mjs';
import { specialLifecycleExecutionHook } from '../intent/0109/execution-hooks.mjs';
import { createReferenceLifecycleVerifier } from '../intent/0089/reference-lifecycle.candidate.mjs';
import { compilePreciseSchema } from '../intent/0070/precision-schemas.candidate.mjs';
import { makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { exactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const kinds = ['reference-missing', 'raw-grant-missing', 'malformed-raw-grant'], map = JSON.parse(readFileSync(new URL('../intent/0109/SOURCE-MAP.json', import.meta.url)));

test('0109: all three exact cases execute full positive and replay controls before the mapped safe outcome', () => {
  assert.deepEqual(map.rows.map((row) => row.kind), kinds);
  for (const kind of kinds) {
    const required = loadRequiredCases().cases.find((row) => row.id === `LIFECYCLE-GRAPH-NEGATIVE:${kind}`), hook = specialLifecycleExecutionHook(required), results = [];
    hook.run((input, invoke, expected) => { const actual = invoke(); results.push(actual); for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value); assert.deepEqual(actual.effects, zeroEffects()); });
    assert.equal(results.length, 3); assert.equal(results[0].state, 'validated-lifecycle-candidate'); assert.equal(results[1].state, 'validated-lifecycle-candidate');
    assert.equal(results[1].replayCount, results[1].protectedActionCount); assert.equal(results[2].state, map.rows.find((row) => row.kind === kind).expectedState);
    assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
});

test('0109: raw controls include preterminal grant, all three temporary copies, winning batch and separate tombstone', () => {
  const schema = compilePreciseSchema('RAW-POLICY-GRANT.schema.json');
  for (const kind of kinds.slice(1)) {
    const value = fixtures.specialLifecycleExecutionCase(kind, 'positive'), raw = JSON.parse(value.graph.rawPolicyBytes), grant = JSON.parse(raw.rawGrantBytes), terminal = JSON.parse(value.graph.eventBytes);
    const batch = JSON.parse(value.graph.rawBatchBytes), plan = JSON.parse(batch.planBytes), preparation = JSON.parse(raw.preparationBytes);
    assert.equal(value.graph.version, 'steer-lifecycle-graph/raw-v2'); assert.equal(terminal.eventType, 'corpus-sanitization-terminal'); assert.equal(terminal.occurredAt, '2026-09-04T12:00:00Z');
    assert.equal(schema(grant).length, 0); assert.ok(exactInstant(preparation.recordedAt) < exactInstant(grant.authority.decidedAt));
    assert.ok(exactInstant(grant.authority.decidedAt) < exactInstant(terminal.occurredAt)); assert.equal(preparation.copies.length, 3);
    assert.equal(value.graph.copies.length, 3); assert.equal(plan.entries.length, 3); assert.equal(JSON.parse(batch.reservationBytes).winner, true);
    assert.ok(value.graph.tombstone.humanBundleBytes.length > 0); assert.ok(value.graph.tombstone.actionBundleBytes.length > 0);
    const negative = fixtures.specialLifecycleExecutionCase(kind), changed = JSON.parse(negative.graph.rawPolicyBytes);
    assert.equal(negative.graph.rawBatchBytes, value.graph.rawBatchBytes); assert.deepEqual(negative.graph.copies, value.graph.copies);
    if (kind === 'raw-grant-missing') { assert.equal(changed.rawGrantBytes, ''); assert.equal(changed.humanBundleBytes, ''); }
    else { assert.ok(Array.isArray(JSON.parse(changed.rawGrantBytes))); assert.ok(schema(JSON.parse(changed.rawGrantBytes)).length > 0); }
    assert.equal(negative.verifier.verify(negative.bytes, negative.evaluationTime).state, 'blocked');
  }
});

test('0109: reference control preserves original keys and historical bytes while binding current removal and named tombstone', () => {
  const value = fixtures.specialLifecycleExecutionCase('reference-missing', 'positive'), runtime = JSON.parse(value.runtimeBytes), registry = JSON.parse(runtime.currentRegistryBytes);
  assert.equal(runtime.version, 'steer-lifecycle-runtime/v5'); assert.equal(value.graph.version, 'steer-lifecycle-graph/current-v5');
  for (const key of TRUST_REGISTRY.bindings) assert.deepEqual(registry.bindings.find((row) => row.keyId === key.keyId), key);
  const historical = JSON.parse(value.graph.historicalEvidenceBytes); assert.ok(historical.historyBytes.length > 0); assert.equal(JSON.parse(historical.eventBytes).occurredAt, '2026-09-04T12:00:00Z');
  const reference = JSON.parse(value.graph.referenceRevocationBytes); assert.equal(reference.referenceReceiptBytes.length, 2);
  assert.equal(JSON.parse(reference.completionBytes).tombstoneRecordId, 'tombstone-evidence-1');
  assert.equal(JSON.parse(reference.completionBytes).referenceState, 'cleared');
  const result = createReferenceLifecycleVerifier(value.configBytes, value.runtimeBytes).verify(value.bytes, value.evaluationTime);
  assert.equal(result.referenceEvidenceDigest, sha256(value.graph.referenceRevocationBytes)); assert.equal(result.referenceCount, 2); assert.equal(result.executionAuthorized, false);
  const negative = fixtures.specialLifecycleExecutionCase('reference-missing'); assert.equal(negative.graph.referenceRevocationBytes, '');
  assert.equal(negative.graph.stateBytes, value.graph.stateBytes); assert.equal(negative.verifier.verify(negative.bytes, negative.evaluationTime).state, 'retained-pending-safe-disposition');
  assert.throws(() => createReferenceLifecycleVerifier(value.configBytes, jcs({ ...runtime, version: 'steer-lifecycle-runtime/v1' })), /REFERENCE_LIFECYCLE_CONFIGURATION_INVALID/);
});

test('0109: malformed legacy placement is explicitly promoted into the real raw schema and fixtures stay closed', () => {
  const old = JSON.parse(makeLifecycleGraph('RC-FAILED-RUN', 'complete', 'malformed-raw-grant'));
  assert.equal(old.recordClass, 'RC-FAILED-RUN'); assert.ok(Array.isArray(JSON.parse(old.rawGrantBytes[0])));
  const entry = map.rows.find((row) => row.kind === 'malformed-raw-grant'); assert.equal(entry.legacyClass, 'RC-FAILED-RUN'); assert.equal(entry.correctedClass, 'RC-CORPUS-RAW-WORKING');
  assert.ok(entry.limitation.includes('semantic promotion'));
  assert.deepEqual(Object.keys(fixtures).sort(), ['immutableRetentionExecutionCase', 'lifecycleGraphExecutionCase', 'lifecycleGraphVariants', 'lifecycleNegativeExecutionCase', 'lifecycleReadinessExecutionCase', 'longRetentionExecutionCase', 'shortRetentionExecutionCase', 'specialLifecycleExecutionCase']);
  assert.throws(() => fixtures.specialLifecycleExecutionCase('arbitrary'), /UNKNOWN_SPECIAL_LIFECYCLE_CASE/);
  assert.throws(() => fixtures.specialLifecycleExecutionCase('reference-missing', 'arbitrary'), /UNKNOWN_SPECIAL_LIFECYCLE_CASE/);
  assert.equal(specialLifecycleExecutionHook({ family: 'unknown' }), null);
  for (const kind of kinds) assert.equal(fixtures.specialLifecycleExecutionCase(kind, 'positive').input, fixtures.specialLifecycleExecutionCase(kind, 'positive').input);
});

test('0109: all 30 lifecycle negatives have exact execution seals without claiming class boundaries or formal closure', () => {
  const report = runCorrectedCoverage(); assert.equal(report.executed, 381); assert.equal(report.passed, 381); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3655);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH-NEGATIVE'], { required: 30, executed: 30, passed: 30, failed: 0, uncovered: 0 });
  for (const kind of kinds) assert.equal(report.executions.find((row) => row.id === `LIFECYCLE-GRAPH-NEGATIVE:${kind}`).observationCount, 3);
  assert.equal(report.families['LIFECYCLE-GRAPH'].executed, 40); assert.equal(report.families.MIGRATION.executed, 0);
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0113/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
