// Deliberately separate from quick root checks. This executes the full synthetic matrix.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runFullCorrectedCoverage } from '../../intent/0098/execution-ledger.mjs';
import { loadRequiredCases } from '../../intent/0098/required-cases.mjs';
import { jcs, sha256 } from '../../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const report = runFullCorrectedCoverage(), rows = report.executions.filter((row) => row.id.startsWith('ACCESSIBILITY:'));

test('0104 full: all 16 exact original accessibility cases actually execute with a full same-run positive control', () => {
  assert.equal(report.profile, 'full'); assert.equal(report.executed, 393); assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  assert.deepEqual(rows.map((row) => row.id), loadRequiredCases().cases.filter((row) => row.family === 'ACCESSIBILITY').map((row) => row.id));
  const positive = rows.find((row) => row.id === 'ACCESSIBILITY:positive'), stream = positive.streamObservations[0];
  assert.equal(stream.count, 32900); assert.equal(stream.exhausted, true); assert.equal(stream.closed, true);
  assert.equal(stream.rowsDigest, 'ff76750d691d50a7540f0cebd1a0ad04c3c7629f4b6064fa2f6b87f8ea32c1ee');
  for (const row of rows) {
    assert.equal(row.status, 'passed'); assert.equal(row.observationCount, 1); assert.equal(row.streamObservations.length, 1);
    assert.deepEqual(row.prerequisites, row === positive ? [] : [{ id: positive.id, executionDigest: sha256(jcs(positive)) }]);
    assert.equal(row.streamObservations[0].closed, true); assert.match(row.streamObservations[0].consumedInputDigest, /^[0-9a-f]{64}$/);
  }
});

test('0104 full: preflight denials do not claim row consumption, and row failures do not claim a successful matrix', () => {
  for (const id of ['manifest-mutated', 'summary-tamper', 'identity-substitution', 'batch-proof-substitution']) {
    const stream = rows.find((row) => row.id === `ACCESSIBILITY:${id}`).streamObservations[0];
    assert.equal(stream.count, 0, id); assert.equal(stream.exhausted, false, id);
  }
  const corrupt = rows.find((row) => row.id === 'ACCESSIBILITY:environment-substituted').streamObservations[0];
  assert.equal(corrupt.count, 1); assert.equal(corrupt.exhausted, false);
  assert.equal(report.completeCoverage, false); assert.equal(report.normativeAcceptanceComplete, false); assert.equal(report.independentAcceptance, false);
  assert.equal(report.executionAuthorized, false); assert.equal(report.liveProviderUsed, false);
});

test('0104 full: saved full report exactly matches a fresh execution, never imported as proof', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../../intent/0112/FULL-EXECUTION-REPORT.json', import.meta.url))), report);
});
