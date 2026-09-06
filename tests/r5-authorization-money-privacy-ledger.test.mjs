import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { authorizationExecutionCase, spendExecutionCase, costExecutionCase, privacyExecutionCase } from '../intent/0100/execution-fixtures.mjs';
import { authorizationMoneyPrivacyExecutionHook as hook } from '../intent/0100/execution-hooks.mjs';
import { loadRequiredCases, digest } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { makeAuthorizationBundle, mutateAuthorizationBundle, expectedAuthorizationRecordIds, makeSpendGraph, mutateSpendGraph, makeCostGraph, makePrivacyGraph, mutatePrivacyGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { checkedAdd, checkedMultiply, jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createAuthorizationTimeVerifier } from '../intent/0066/authorization-time.candidate.mjs';
import { createMoneyTimeVerifier } from '../intent/0064/money-time.candidate.mjs';
import { createPrivacyCostTimeVerifier } from '../intent/0063/privacy-cost-time.candidate.mjs';
const cases = loadRequiredCases().cases, rows = (family) => cases.filter((row) => row.family === family);
function observe(required) {
  const result = [];
  hook(required).run((input, invoke, expected) => {
    const before = input, actual = invoke();
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, `${required.id}:${key}`);
    if (actual.effects) assert.deepEqual(actual.effects, zeroEffects());
    assert.equal(input, before); result.push({ input, actual });
  });
  return result;
}

test('0100: all 32 authorization IDs preserve exact mutations, full positive/replay controls and ten consumed records', () => {
  assert.equal(rows('AUTHORIZATION').length, 32);
  for (const row of rows('AUTHORIZATION')) {
    const fixture = authorizationExecutionCase(row.coordinate.kind), actual = observe(row);
    assert.deepEqual(fixture.positive, makeAuthorizationBundle());
    assert.deepEqual(fixture.changed, mutateAuthorizationBundle(makeAuthorizationBundle(), row.coordinate.kind));
    assert.equal(actual.length, 2); assert.equal(actual[0].actual.recordedDecision, 'ALLOW');
    assert.deepEqual(actual[0].actual.consumedRecordIds, expectedAuthorizationRecordIds);
    assert.equal(actual[0].actual.timedRecordCount, 10); assert.equal(actual[0].actual.observedAsOfCount, 1);
    if (row.coordinate.kind === 'retry') assert.equal(actual[1].actual.recordedDecision, 'REPLAY_NOOP');
    assert.equal(actual[1].actual.executionAuthorized, false);
  }
});

test('0100: all 20 spending cases include valid lineage and preserve exact unknown, expiry and replay inputs', () => {
  assert.equal(rows('SPEND').length, 20);
  for (const row of rows('SPEND')) {
    const kind = row.coordinate.kind, fixture = spendExecutionCase(kind), actual = observe(row);
    assert.equal(fixture.sourceBytes, kind === 'unknown-kind' ? '"unknown"' : mutateSpendGraph(makeSpendGraph(), kind));
    assert.equal(actual.length, 2); assert.equal(actual[0].actual.timedRecordCount, 8);
    assert.equal(actual[0].actual.observedAsOfCount, 0); assert.equal(actual[1].actual.executionAuthorized, false);
    if (kind === 'replay') assert.equal(actual[1].actual.recordedDecision, 'REPLAY_NOOP');
    if (kind === 'invalid-time') assert.equal(JSON.parse(fixture.sourceBytes).decisionAt, 'not-a-time');
  }
});

test('0100: 28 ordinary cost cases preserve source bytes, aggregate rounding and exact overflow primitive boundaries', () => {
  let count = 0;
  for (const row of rows('COST')) {
    const kind = row.coordinate.kind, fixture = costExecutionCase(kind); if (fixture.plural) continue; count++;
    const actual = observe(row); assert.equal(actual[0].actual.decision, 'VERIFIED');
    if (kind.startsWith('overflow-')) {
      assert.equal(actual.length, 3); assert.equal(actual[1].actual.error, 'NANOUSD_OVERFLOW');
      assert.deepEqual(JSON.parse(actual[1].input), ['9000000000000000000', kind === 'overflow-add' ? '1' : '2']);
      assert.equal(actual[2].actual.decision, 'DENY');
      const graph = JSON.parse(fixture.sourceBytes); assert.equal(graph.kind, 'aggregate');
      assert.equal(JSON.parse(graph.recordsBytes[0]).units, '9000000000000000000');
    } else {
      assert.equal(fixture.sourceBytes, kind === 'unknown-kind' ? '"unknown"' : makeCostGraph(kind)); assert.equal(actual.length, 2);
    }
    if (kind === 'subcent-aggregate-before-round') assert.equal(actual.at(-1).actual.aggregateNanoUsd, '14700000');
    if (kind === 'invoice-two-lines-reordered') assert.equal(actual.at(-1).actual.aggregateNanoUsd, '9800000');
  }
  assert.equal(count, 28); assert.equal(checkedAdd('8999999999999999999', '1'), 9000000000000000000n);
  assert.equal(checkedMultiply('4500000000000000000', '2'), 9000000000000000000n);
});

test('0100: all six reconciliation cases lift scalar lineage without rewriting signed bytes or routing through the scalar oracle', () => {
  let count = 0;
  for (const row of rows('COST')) {
    const fixture = costExecutionCase(row.coordinate.kind); if (!fixture.plural) continue; count++;
    assert.equal(fixture.sourceBytes, makeCostGraph(row.coordinate.kind));
    const outer = JSON.parse(fixture.bytes), correction = JSON.parse(outer.correctionBytes), graph = JSON.parse(correction.graphBytes);
    assert.equal(outer.kind, 'cost-reconciliation'); assert.equal(graph.varianceBytes, ''); assert.equal(graph.reconciliationBytes, '');
    assert.equal(correction.varianceRecordsBytes.length, 1); assert.equal(correction.reconciliationRecordsBytes.length, 1);
    assert.equal(jcs({ ...graph, varianceBytes: correction.varianceRecordsBytes[0], reconciliationBytes: correction.reconciliationRecordsBytes[0] }), fixture.sourceBytes);
    const actual = observe(row); assert.equal(actual[0].actual.decision, 'ALLOW'); assert.equal(actual[0].actual.reconciledLineCount, 1);
    assert.equal(actual[0].actual.timedRecordCount, 9); assert.equal(actual[0].actual.observedAsOfCount, 2);
    assert.equal(actual[1].actual.decision, row.coordinate.kind === 'reconcile-at-24h' ? 'ALLOW' : 'DENY');
    assert.ok(hook(row).executor.startsWith('intent/0063/'));
  }
  assert.equal(count, 6);
});

test('0100: all 19 existing privacy IDs now execute complete independent-time evidence plus exact mutations and positive controls', () => {
  assert.equal(rows('PRIVACY-GRAPH').length, 19);
  for (const row of rows('PRIVACY-GRAPH')) {
    const kind = row.coordinate.kind, fixture = privacyExecutionCase(kind), actual = observe(row);
    assert.equal(fixture.sourceBytes, kind === 'positive' ? makePrivacyGraph() : mutatePrivacyGraph(makePrivacyGraph(), kind));
    assert.equal(actual.length, 2); assert.equal(actual[0].actual.timedRecordCount, 10); assert.equal(actual[0].actual.observedAsOfCount, 6);
    assert.ok(hook(row).executor.startsWith('intent/0063/'));
    assert.equal(actual[1].actual.decision, kind === 'positive' ? 'ACCEPT' : 'DENY');
  }
});

test('0100: mapped positive controls bind full independent observations and reject invalid proofs or expired trusted clocks', () => {
  for (const [fixture, factory, expired] of [
    [authorizationExecutionCase('positive'), createAuthorizationTimeVerifier, '2026-09-04T12:01:00Z'],
    [spendExecutionCase('positive'), createMoneyTimeVerifier, '2026-09-04T12:01:00Z'],
    [costExecutionCase('forecast-allow'), createMoneyTimeVerifier, '2026-10-01T00:00:00Z'],
    [costExecutionCase('reconcile-at-24h'), createPrivacyCostTimeVerifier, '2027-09-01T00:00:00Z'],
    [privacyExecutionCase('positive'), createPrivacyCostTimeVerifier, '2026-09-05T00:00:00Z'],
  ]) {
    const input = JSON.parse(fixture.positiveBytes), proof = JSON.parse(input.observationBytes), body = input.bundleBytes ?? input.graphBytes ?? input.correctionBytes;
    assert.equal(proof.bundleDigest ?? proof.graphDigest ?? proof.correctionDigest, sha256(body)); assert.ok(proof.recordCount > 0);
    proof.signature.valueBase64 = Buffer.alloc(64).toString('base64'); input.observationBytes = jcs(proof);
    assert.equal((fixture.positiveVerifier ?? fixture.verifier).verify(jcs(input)).decision, 'DENY');
    const value = factory(jcs({ version: 'steer-audit-clock/v1', evaluatedAt: expired })).verify(fixture.positiveBytes);
    assert.equal(value.decision, 'DENY'); assert.deepEqual(value.effects, zeroEffects());
  }
});

test('0100: source seals, exact case accounting and strict unmapped boundaries do not imply full shared-action or gate coverage', () => {
  assert.equal(cases.filter((row) => hook(row) !== null).length, 105);
  assert.equal(hook({ family: 'UNKNOWN', id: 'UNKNOWN' }), null);
  for (const [family, builder] of [['AUTHORIZATION', authorizationExecutionCase], ['SPEND', spendExecutionCase], ['COST', costExecutionCase], ['PRIVACY-GRAPH', privacyExecutionCase]]) {
    assert.throws(() => builder('invented'));
    assert.throws(() => hook(rows(family)[0]).run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  }
  const report = runCorrectedCoverage(); assert.equal(report.executed, 201); assert.equal(report.uncovered, 3835);
  assert.equal(report.families.R5.executed, 4); assert.equal(report.families.MIGRATION.executed, 0);
  const sources = report.supplementalHookSources.filter((row) => row.path.startsWith('intent/0100/'));
  assert.deepEqual(sources.map((row) => row.path), ['intent/0100/execution-hooks.mjs', 'intent/0100/execution-fixtures.mjs']);
  for (const source of sources) assert.equal(source.digest, digest(readFileSync(new URL('../' + source.path, import.meta.url))));
  assert.ok(report.executions.filter((row) => row.id.startsWith('AUTHORIZATION:')).every((row) => row.scope.includes('0060')));
  assert.equal(report.completeCoverage, false); assert.equal(report.normativeAcceptanceComplete, false);
});
