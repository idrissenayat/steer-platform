import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { recoveryExecutionCase, humanExecutionCase } from '../intent/0099/execution-fixtures.mjs';
import { recoveryHumanExecutionHook } from '../intent/0099/execution-hooks.mjs';
import { loadRequiredCases, digest } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { makeRecoveryEvidence, mutateRecoveryEvidence, recoveryCuts, recoveryCorruptions, mutateHumanAuthorityBundle } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { humanAuthorityDecision as legacyHuman } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const catalog = loadRequiredCases().cases;
function observe(required) {
  const observations = [];
  recoveryHumanExecutionHook(required).run((input, invoke, expected) => {
    const actual = invoke();
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, required.id);
    assert.deepEqual(actual.effects, zeroEffects()); observations.push({ input, actual, expected });
  });
  return observations;
}

test('0099: all eight exact recovery cuts preserve complete evidence and the two expected unknown outcomes', () => {
  const rows = catalog.filter((row) => row.family === 'RECOVERY-CUT');
  assert.deepEqual(rows.map((row) => row.coordinate.kind), recoveryCuts);
  for (const [index, row] of rows.entries()) {
    const fixture = recoveryExecutionCase(row.family, row.coordinate.kind), observations = observe(row);
    assert.equal(fixture.sourceBytes, makeRecoveryEvidence(row.coordinate.kind));
    assert.equal(observations.length, 1);
    assert.equal(observations[0].actual.outcome, index < 2 ? 'UNKNOWN_RECONCILE_PROVIDER' : 'RECOVERY_VERIFIED');
    assert.equal(observations[0].actual.timedRecordCount, 6); assert.equal(observations[0].actual.observedAsOfCount, 5);
  }
});

test('0099: all 25 exact recovery corruptions execute a complete positive control before the intended denial', () => {
  const rows = catalog.filter((row) => row.family === 'RECOVERY-CORRUPTION');
  assert.deepEqual(rows.map((row) => row.coordinate.kind), recoveryCorruptions);
  for (const row of rows) {
    const fixture = recoveryExecutionCase(row.family, row.coordinate.kind), observations = observe(row);
    assert.equal(fixture.sourceBytes, mutateRecoveryEvidence(makeRecoveryEvidence(), row.coordinate.kind));
    assert.equal(observations.length, 2); assert.notEqual(observations[0].input, observations[1].input);
    assert.equal(observations[0].actual.outcome, 'RECOVERY_VERIFIED');
    assert.equal(observations[1].actual.outcome, 'RECOVERY_INCOMPLETE');
    assert.equal(observations[1].actual.firstError, 'RECOVERY_TIME_INVALID');
  }
});

test('0099: all 17 authority cases retain exact frozen mutations against a complete full-binding positive control', () => {
  const rows = catalog.filter((row) => row.family === 'HUMAN-AUTHORITY'); assert.equal(rows.length, 17);
  for (const row of rows) {
    const fixture = humanExecutionCase(row.coordinate.kind), observations = observe(row);
    assert.deepEqual(fixture.changed, mutateHumanAuthorityBundle(fixture.positive, row.coordinate.kind));
    assert.equal(observations.length, 2); assert.equal(observations[0].actual.decision, 'ALLOW');
    assert.equal(observations[1].actual.decision, row.coordinate.kind === 'positive' ? 'ALLOW' : 'DENY');
    assert.equal(observations[1].actual.executionAuthorized, false);
  }
  const fixture = humanExecutionCase('positive'), envelope = JSON.parse(fixture.bytes);
  for (const field of Object.keys(fixture.positive).filter((key) => key.endsWith('Bytes'))) {
    const bundle = structuredClone(fixture.positive); delete bundle[field];
    const result = fixture.verifier.verify(jcs({ ...envelope, bundleBytes: jcs(bundle) }), fixture.evaluatedAt);
    assert.equal(result.decision, 'DENY', field); assert.deepEqual(result.effects, zeroEffects());
  }
  assert.equal(fixture.verifier.verify(fixture.bytes, '2035-09-04T12:00:00Z').decision, 'DENY');
});

test('0099: both human R5 counterexamples reach the named corrected error after legacy acceptance and full positive control', () => {
  for (const [index, kind, error] of [[1, 'r5-session', 'HUMAN_PROVIDER_BINDING_INVALID'], [2, 'r5-provider-time', 'HUMAN_TIMED_EVIDENCE_INVALID']]) {
    const fixture = humanExecutionCase(kind), row = catalog.find((entry) => entry.id === `R5:PREFLIGHT-R3-R5-002:reproduction:${index}`);
    assert.equal(legacyHuman(fixture.legacy).decision, 'ALLOW');
    const observations = observe(row); assert.equal(observations.length, 3);
    assert.equal(observations[0].actual.decision, 'ALLOW'); assert.equal(observations[2].actual.firstError, error);
    assert.equal(JSON.parse(fixture.changed.authorityBytes).sessionId, JSON.parse(fixture.legacy.authorityBytes).sessionId);
    if (kind === 'r5-provider-time') assert.equal(JSON.parse(fixture.changed.providerProofBytes).recordedAt, '2000-01-01T00:00:00Z');
  }
});

test('0099: closed mappings seal supplemental sources without crediting unknown cases or swallowing assertions', () => {
  assert.equal(catalog.filter((row) => recoveryHumanExecutionHook(row) !== null).length, 52);
  assert.equal(recoveryHumanExecutionHook({ family: 'UNKNOWN', id: 'UNKNOWN' }), null);
  assert.throws(() => recoveryExecutionCase('RECOVERY-CUT', 'invented'));
  assert.throws(() => humanExecutionCase('invented'));
  const row = catalog.find((entry) => entry.family === 'HUMAN-AUTHORITY');
  assert.throws(() => recoveryHumanExecutionHook(row).run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  const report = runCorrectedCoverage();
  assert.deepEqual(report.supplementalHookSources.filter((entry) => entry.path.startsWith('intent/0099/')).map((entry) => entry.path), ['intent/0099/execution-hooks.mjs', 'intent/0099/execution-fixtures.mjs']);
  for (const entry of report.supplementalHookSources) assert.equal(entry.digest, digest(readFileSync(new URL('../' + entry.path, import.meta.url))));
  assert.equal(report.completeCoverage, false); assert.equal(report.independentAcceptance, false);
});
