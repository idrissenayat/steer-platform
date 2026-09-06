import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0107/execution-fixtures.mjs';
import { releaseLifecycleExecutionHook } from '../intent/0116/execution-hooks.mjs';
import { createReleaseLifecycleVerifier, createReleaseLifecycleReadinessVerifier } from '../intent/0116/release-lifecycle.candidate.mjs';
import { createLifecycleRuntime } from '../intent/0080/lifecycle-runtime.candidate.mjs';
import { createCurrentLifecycleGraphVerifier } from '../intent/0061/lifecycle-graph.candidate.mjs';
import { correctedLifecycleEventDecision, correctionPolicyDigest } from '../intent/0059/lifecycle-events.candidate.mjs';
import { makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, zeroEffects, TRUST_REGISTRY, sha256 } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const source = JSON.parse(readFileSync(new URL('../intent/0116/SOURCE-MAP.json', import.meta.url))), make = fixtures.releaseLifecycleExecutionCase;
const limits = r => { for (const f of ['executionAuthorized', 'dispositionEvidenceVerified', 'quarantineVerified', 'deletionVerified', 'referenceClearanceVerified']) assert.equal(r[f], false); assert.deepEqual(r.effects, zeroEffects()); };

test('0116: exact seven-year source clocks bind a named retirement event while waiting and pending remain read-only', () => {
  for (const [point, clock] of Object.entries(source.observations)) {
    const old = JSON.parse(makeLifecycleGraph(source.classId, point)), value = make(point), result = value.verifier.verify(value.bytes, clock);
    assert.equal(old.evaluationAt, clock); assert.equal(value.evaluationTime, clock); assert.equal(JSON.parse(old.triggerBytes).occurredAt, source.retiredAt);
    const event = JSON.parse(value.head.eventBytes), runtime = JSON.parse(value.runtimeBytes), context = JSON.parse(runtime.retirementContextBytes);
    assert.equal(event.occurredAt, source.retiredAt); assert.equal(event.timestampAuthority, 'release-rails-commit'); assert.equal(event.actorAuthority, 'release-rails');
    assert.equal(event.environmentId, context.environmentId); assert.equal(event.releaseRailsRecordId, context.releaseRailsRecordId); assert.equal(event.trafficDisabled, true); assert.equal(event.credentialsRevoked, true);
    assert.equal(result.state, point === 'before' ? 'waiting-retention' : 'eligible-pending-disposition-evidence'); assert.equal(result.retentionEligible, point !== 'before'); limits(result);
    assert.equal(result.boundaryAt, source.expiryAt); assert.equal(result.retirementContextDigest, sha256(runtime.retirementContextBytes)); assert.equal(result.retirementEventDigest, event.recordDigest);
    assert.ok(exactInstant(JSON.parse(value.head.stateBytes).recordedAt) <= exactInstant(clock));
    for (const field of ['copies', 'aggregateBytes', 'tombstone']) assert.equal(Object.hasOwn(value.head, field), false);
  }
});

test('0116: authentic provider-bound but semantically wrong retirement records deny in the release profile', () => {
  for (const variant of ['wrong-clock-source', 'wrong-actor', 'wrong-rails-record', 'wrong-provider-record', 'wrong-retired-time']) {
    const value = make('at', variant), runtime = JSON.parse(value.runtimeBytes), history = JSON.parse(runtime.historicalContextBytes);
    assert.equal(correctedLifecycleEventDecision(jcs({ version: 'steer-r5-001-events/v1', policyDigest: correctionPolicyDigest, scope: history.scope,
      eventBytes: value.head.eventBytes, historyBytes: value.head.historyBytes, evaluationTime: history.observedAt })).state, 'validated-trigger');
    const result = value.verifier.verify(value.bytes, value.evaluationTime); assert.equal(result.state, 'blocked'); limits(result);
  }
  for (const point of Object.keys(source.observations)) for (const variant of ['traffic-active', 'credentials-active']) {
    const value = make(point, variant), result = value.verifier.verify(value.bytes, value.evaluationTime); assert.equal(result.state, 'blocked'); limits(result);
  }
});

test('0116: original keys and history stay unchanged while fresh separated current proof domains cover the future audit', () => {
  const before = make('before'), complete = make('complete', 'full-positive'), runtime = JSON.parse(complete.runtimeBytes), registry = JSON.parse(runtime.currentRegistryBytes);
  for (const old of TRUST_REGISTRY.bindings) assert.deepEqual(registry.bindings.find(k => k.domain === old.domain && k.keyId === old.keyId), old);
  assert.equal(new Set(registry.bindings.map(k => k.publicKeyHex)).size, registry.bindings.length);
  assert.equal(before.head.eventBytes, complete.graph.eventBytes); assert.deepEqual(before.head.historyBytes, complete.graph.historyBytes);
  assert.equal(JSON.parse(runtime.historicalContextBytes).observedAt, '2026-09-04T12:00:50Z');
  assert.ok(registry.bindings.some(k => k.keyId === 'provider-key-current' && k.notBefore === '2033-01-01T00:00:00Z'));
  for (const variant of ['missing-history', 'missing-owner-archive', 'missing-state', 'wrong-provider', 'future-state', 'wrong-target']) {
    const value = make('at', variant), result = value.verifier.verify(value.bytes, value.evaluationTime); assert.equal(result.state, 'blocked'); limits(result);
  }
});

test('0116: release-only trusted runtime requires non-null exact environment and cannot admit other classes or old profiles', () => {
  const value = make('at'), base = JSON.parse(value.runtimeBytes), context = JSON.parse(base.retirementContextBytes);
  assert.deepEqual(createLifecycleRuntime(value.runtimeBytes).supportedClasses, ['RC-RELEASE-MIGRATION']);
  for (const mutation of [c => { delete c.retirementContextBytes; }, c => { c.extra = true; }, c => { c.version = 'steer-lifecycle-runtime/v4'; },
    c => { c.retirementContextBytes = jcs({ ...context, environmentId: null }); }, c => { c.retirementContextBytes = jcs({ ...context, environmentId: 'other' }); },
    c => { c.retirementContextBytes = jcs({ ...context, retiredAt: '2033-09-04T12:00:00Z' }); }]) {
    const config = structuredClone(base); mutation(config); assert.throws(() => createLifecycleRuntime(jcs(config)), /CONFIGURATION_INVALID/);
  }
  const old = fixtures.longRetentionExecutionCase('RC-DECISION-PROOF', 'complete');
  for (const factory of [createReleaseLifecycleVerifier, createReleaseLifecycleReadinessVerifier]) assert.throws(() => factory(old.configBytes, old.runtimeBytes), /RELEASE_PROFILE_REQUIRED/);
  assert.throws(() => createCurrentLifecycleGraphVerifier(value.configBytes, old.runtimeBytes), /CONFIGURATION_INVALID/);
  for (const classId of ['RC-DELETION-EVIDENCE', 'RC-CORPUS-PROVENANCE', 'RC-CORPUS-SANITIZED', 'RC-DECISION-PROOF']) assert.throws(() => createReleaseLifecycleVerifier(jcs({ ...JSON.parse(value.configBytes), recordClass: classId }), value.runtimeBytes), /CONFIGURATION_INVALID/);
});

test('0116: full disposition/replay validates only complete current graphs and rejects signed retirement faults or missing receipts', () => {
  for (const variant of ['full-positive', 'full-replay', 'full-missing-receipt', 'full-wrong-clock-source', 'full-wrong-rails-record', 'full-traffic-active', 'full-credentials-active']) {
    const value = make('complete', variant), result = value.verifier.verify(value.bytes, value.evaluationTime), valid = ['full-positive', 'full-replay'].includes(variant);
    assert.equal(result.state, valid ? 'validated-lifecycle-candidate' : 'blocked', variant); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    if (valid) { assert.equal(result.copyCount, 2); assert.equal(result.protectedActionCount, 3); assert.equal(result.replayCount, variant === 'full-replay' ? 3 : 0); assert.equal(result.boundaryAt, source.expiryAt); }
  }
});

test('0116: held state, exact clocks and cross-format denial cannot provide mutation or clearance authority', () => {
  const head = make('at'), full = make('complete', 'full-positive');
  for (const point of Object.keys(source.observations)) { const value = make(point, 'held'), result = value.verifier.verify(value.bytes, value.evaluationTime); assert.equal(result.state, 'retained-on-hold'); assert.equal(result.retentionEligible, false); limits(result); }
  assert.equal(full.verifier.verify(head.bytes, full.evaluationTime).state, 'blocked'); assert.equal(head.verifier.verify(full.bytes, full.evaluationTime).state, 'blocked');
  assert.equal(head.verifier.verify(jcs({ ...head.head, version: 'steer-lifecycle-readiness/v1' }), head.evaluationTime).state, 'blocked');
  assert.equal(head.verifier.verify(jcs({ ...head.head, executionAuthorized: true }), head.evaluationTime).state, 'blocked');
  assert.equal(head.verifier.verify(head.bytes, '2033-09-04T11:59:59.999999999Z').state, 'waiting-retention');
  assert.equal(head.verifier.verify(head.bytes, '2033-09-04T12:00:00.000000001Z').state, 'eligible-pending-disposition-evidence');
  assert.notEqual(head.verifier.verify(head.bytes, head.evaluationTime).inputDigest, head.verifier.verify(head.bytes, source.observations.after).inputDigest);
});

test('0116: four closed source hooks execute all 23 observations and propagate assertion failure', () => {
  const rows = loadRequiredCases().cases.filter(r => releaseLifecycleExecutionHook(r)); assert.equal(rows.length, 4);
  for (const row of rows) { let count = 0; const hook = releaseLifecycleExecutionHook(row);
    hook.run((input, invoke, expected) => { assert.equal(typeof input, 'string'); const result = invoke(); for (const [k, v] of Object.entries(expected)) assert.deepEqual(result[k], v); assert.deepEqual(result.effects, zeroEffects()); count++; });
    assert.equal(count, 23); assert.throws(() => hook.run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
  assert.throws(() => make('unknown'), /UNKNOWN_RELEASE_LIFECYCLE_CASE/); assert.throws(() => make('at', 'full-positive'), /UNKNOWN_RELEASE_LIFECYCLE_CASE/);
  assert.deepEqual(Object.keys(fixtures).sort(), ['immediateLifecycleExecutionCase', 'immutableRetentionExecutionCase', 'lifecycleGraphExecutionCase', 'lifecycleGraphVariants', 'lifecycleNegativeExecutionCase', 'lifecycleReadinessExecutionCase', 'longRetentionExecutionCase', 'rawDeadlineExecutionCase', 'releaseLifecycleExecutionCase', 'shortRetentionExecutionCase', 'specialLifecycleExecutionCase']);
});

test('0116: prior mapped observations remain identical while four release lifecycle coordinates map', () => {
  const report = runCorrectedCoverage(), prior = JSON.parse(readFileSync(new URL('../intent/0115/QUICK-EXECUTION-REPORT.json', import.meta.url))), current = new Map(report.executions.map(r => [r.id, r]));
  for (const old of prior.executions) for (const field of ['observationsDigest', 'observationCount', 'status']) assert.equal(current.get(old.id)[field], old[field], `${old.id}:${field}`);
  assert.equal(report.executed, 393); assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH'], { required: 64, executed: 52, passed: 52, failed: 0, uncovered: 12 });
  for (const f of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[f], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0116/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
