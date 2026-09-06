import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { multilineCostExecutionCase } from '../intent/0101/execution-fixtures.mjs';
import { detectorMultilineExecutionHook as hook } from '../intent/0101/execution-hooks.mjs';
import { executionHook } from '../intent/0098/execution-hooks.mjs';
import { loadRequiredCases, digest } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { costDecision } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { correctedCostDecision } from '../intent/0057/cost-correction.candidate.mjs';
import { jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const cases = loadRequiredCases().cases, reproductionId = 'R5:PREFLIGHT-R3-R5-004:reproduction:1';
function observe(row) {
  const result = [];
  executionHook(row).run((input, invoke, expected) => {
    const actual = invoke(); for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, row.id);
    if (actual.effects) assert.deepEqual(actual.effects, zeroEffects()); result.push({ input, actual });
  }); return result;
}

test('0101: exact declared text and expected class are executed for all 14 identifiers and 70 detector cases', () => {
  const rows = cases.filter((row) => ['PRIVACY-IDENTIFIER', 'PRIVACY-DETECTOR'].includes(row.family)); assert.equal(rows.length, 84);
  for (const row of rows) {
    const actual = observe(row); assert.equal(actual.length, 1); assert.equal(actual[0].input, row.coordinate.text);
    assert.equal(actual[0].actual.hit, row.family === 'PRIVACY-IDENTIFIER' ? true : row.coordinate.expectedHit);
    const executor = executionHook(row);
    assert.ok(executor.executor.endsWith(row.coordinate.class === 'phone' ? '#inspectPrivacyPhoneText' : '#detectIdentifiers'));
    if (row.coordinate.class !== 'phone') assert.ok(executor.scope.includes('unchanged non-phone'));
  }
  assert.equal(rows.filter((row) => hook(row) !== null).length, 74, 'Ten existing phone detector cases are not added twice.');
});

test('0101: exact two-line R5 input demonstrates scalar acceptance but rejects either missing record and the single-pair counterexample', () => {
  const base = multilineCostExecutionCase('positive'), legacy = JSON.parse(base.legacyBytes), correctedGraph = JSON.parse(base.complete.graphBytes);
  assert.equal(legacy.recordsBytes.length, 2); assert.equal(legacy.varianceBytes, base.complete.varianceRecordsBytes[0]);
  assert.equal(legacy.reconciliationBytes, base.complete.reconciliationRecordsBytes[0]);
  assert.equal(jcs({ ...legacy, varianceBytes: '', reconciliationBytes: '' }), base.complete.graphBytes);
  assert.equal(JSON.parse(legacy.varianceBytes).ledgerDigest, JSON.parse(correctedGraph.recordsBytes[0]).recordDigest);
  assert.equal(costDecision(base.legacyBytes).decision, 'ALLOW'); assert.equal(base.verifier.verify(base.bytes).reconciledLineCount, 2);
  for (const kind of ['missing-variance', 'missing-successor', 'missing-both']) {
    const value = multilineCostExecutionCase(kind);
    assert.equal(value.input.graphBytes, base.complete.graphBytes);
    assert.equal(correctedCostDecision(value.correctionBytes).firstError, 'LINEAGE_MULTIPLICITY_INVALID');
    const result = value.verifier.verify(value.bytes); assert.equal(result.decision, 'DENY'); assert.deepEqual(result.effects, zeroEffects());
    assert.equal('aggregateNanoUsd' in result, false); assert.equal('roundedCents' in result, false);
    if (kind === 'missing-both') {
      assert.deepEqual(value.input.varianceRecordsBytes, [base.complete.varianceRecordsBytes[0]]);
      assert.deepEqual(value.input.reconciliationRecordsBytes, [base.complete.reconciliationRecordsBytes[0]]);
    }
  }
});

test('0101: all 32 complete orderings retain exact sets, full observation and aggregate-before-rounding', () => {
  const inputs = new Set(), base = multilineCostExecutionCase('positive'), original = JSON.parse(base.complete.graphBytes);
  for (let mask = 0; mask < 32; mask++) {
    const value = multilineCostExecutionCase('positive', mask), graph = JSON.parse(value.input.graphBytes); inputs.add(value.bytes);
    for (const name of ['recordsBytes', 'providerUsageRecordsBytes', 'providerInvoiceRecordsBytes']) assert.deepEqual([...graph[name]].sort(), [...original[name]].sort());
    for (const name of ['varianceRecordsBytes', 'reconciliationRecordsBytes']) assert.deepEqual([...value.input[name]].sort(), [...base.complete[name]].sort());
    const result = value.verifier.verify(value.bytes); assert.equal(result.decision, 'ALLOW'); assert.equal(result.reconciledLineCount, 2);
    assert.equal(result.aggregateNanoUsd, '9800000'); assert.equal(result.roundedCents, '1');
    assert.equal(result.timedRecordCount, 14); assert.equal(result.observedAsOfCount, 3); assert.deepEqual(result.effects, zeroEffects());
  }
  assert.equal(inputs.size, 32);
});

test('0101: positive and partial inventories bind exact independent evidence, with no unsigned proof bypass', () => {
  for (const [kind, count] of [['positive', 14], ['missing-variance', 13], ['missing-successor', 13], ['missing-both', 12]]) {
    const value = multilineCostExecutionCase(kind), input = JSON.parse(value.bytes), observation = JSON.parse(input.observationBytes);
    assert.equal(observation.recordCount, count); assert.equal(observation.correctionDigest, sha256(value.correctionBytes));
    observation.signature.valueBase64 = Buffer.alloc(64).toString('base64'); input.observationBytes = jcs(observation);
    assert.equal(value.verifier.verify(jcs(input)).decision, 'DENY');
  }
  const value = multilineCostExecutionCase('positive'), correction = structuredClone(value.complete), graph = JSON.parse(correction.graphBytes);
  const invoice = JSON.parse(graph.providerInvoiceRecordsBytes[1]); invoice.signature.valueBase64 = Buffer.alloc(64).toString('base64');
  graph.providerInvoiceRecordsBytes[1] = jcs(invoice); correction.graphBytes = jcs(graph);
  assert.equal(correctedCostDecision(jcs(correction)).decision, 'DENY');
});

test('0101: one R5 case seals all 40 actual observations without crediting legacy calls or permutations as additional IDs', () => {
  const row = cases.find((row) => row.id === reproductionId), observations = observe(row);
  assert.equal(observations.length, 40); assert.equal(observations[0].actual.timedRecordCount, 14);
  assert.equal(observations[1].actual.decision, 'ALLOW');
  const report = runCorrectedCoverage(), execution = report.executions.filter((entry) => entry.id === reproductionId);
  assert.equal(execution.length, 1); assert.equal(execution[0].observationCount, 40); assert.equal(execution[0].status, 'passed');
  assert.equal(report.required, 4036); assert.equal(report.executed, 310); assert.equal(report.uncovered, 3726);
  assert.equal(report.families.R5.executed, 8); assert.equal(report.families.R5.uncovered, 1);
  assert.equal(report.completeCoverage, false); assert.equal(report.independentAcceptance, false);
});

test('0101: closed fixture inputs and hook source seals retain the detector and multi-line scope boundaries', () => {
  assert.equal(cases.filter((row) => hook(row) !== null).length, 75);
  assert.equal(hook({ family: 'UNKNOWN', id: 'UNKNOWN' }), null);
  for (const [kind, permutation] of [['unknown', 0], ['positive', -1], ['positive', 32], ['positive', 0.5], ['missing-both', 1]])
    assert.throws(() => multilineCostExecutionCase(kind, permutation));
  assert.throws(() => hook(cases.find((row) => row.id === reproductionId)).run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  const report = runCorrectedCoverage(), sources = report.supplementalHookSources.filter((row) => row.path.startsWith('intent/0101/'));
  assert.deepEqual(sources.map((row) => row.path), ['intent/0101/execution-hooks.mjs', 'intent/0101/execution-fixtures.mjs']);
  for (const row of sources) assert.equal(row.digest, digest(readFileSync(new URL('../' + row.path, import.meta.url))));
  assert.ok(report.limitations.some((text) => text.includes('unchanged classifier')));
});
