import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loadRequiredCases, digest } from '../intent/0098/required-cases.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { trustDomainExecutionHook } from '../intent/0102/execution-hooks.mjs';
import { sealRecord, verifyRecord, jcs } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const cases = loadRequiredCases().cases, rows = cases.filter((row) => row.family === 'TRUST-DOMAIN-FORGERY');

test('0102: all 17 declared private signing requests fail only after a working ordinary-record control', () => {
  assert.equal(rows.length, 17);
  for (const row of rows) {
    const observations = [];
    trustDomainExecutionHook(row).run((input, invoke, expected) => {
      const actual = invoke(); for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value);
      observations.push({ input: JSON.parse(input), actual });
    });
    assert.equal(observations.length, 2); assert.deepEqual(observations[0].input, { payload: { attacker: true }, domain: 'record' });
    assert.equal(observations[0].actual.verification, null);
    assert.deepEqual(observations[1].input, { payload: { attacker: true }, domain: row.coordinate.kind });
    assert.deepEqual(observations[1].actual, { error: `PRIVATE_SIGNING_DOMAIN_UNAVAILABLE:${row.coordinate.kind}` });
    assert.equal('record' in observations[1].actual, false);
  }
});

test('0102: an ordinary signed record cannot substitute for any declared independent signing domain', () => {
  const record = sealRecord({ attacker: true }), original = jcs(record);
  assert.equal(verifyRecord(record, 'record', '2026-09-04T12:00:30Z'), null);
  for (const row of rows) assert.notEqual(verifyRecord(record, row.coordinate.kind, '2026-09-04T12:00:30Z'), null, row.coordinate.kind);
  assert.equal(jcs(record), original);
});

test('0102: public boundary hooks neither swallow assertion failures nor claim unknown families', () => {
  assert.equal(trustDomainExecutionHook({ family: 'unknown', id: 'unknown' }), null);
  assert.throws(() => trustDomainExecutionHook(rows[0]).run(() => { throw new Error('ASSERTION_FAILED'); }), /ASSERTION_FAILED/);
  assert.equal(cases.filter((row) => trustDomainExecutionHook(row) !== null).length, 17);
});

test('0102: exact source and observation seals retain narrow capability scope with schema and accessibility still uncovered', () => {
  const report = runCorrectedCoverage(), executions = report.executions.filter((row) => row.id.startsWith('TRUST-DOMAIN-FORGERY:'));
  assert.equal(report.executed, 381); assert.equal(report.passed, 381); assert.equal(report.uncovered, 3655);
  assert.deepEqual(executions.map((row) => row.id), rows.map((row) => row.id));
  for (const row of executions) {
    assert.equal(row.status, 'passed'); assert.equal(row.observationCount, 2);
    assert.ok(row.scope.includes('not cryptanalysis')); assert.ok(row.scope.includes('current-key custody'));
  }
  const source = report.supplementalHookSources.filter((row) => row.path === 'intent/0102/execution-hooks.mjs');
  assert.equal(source.length, 1); assert.equal(source[0].digest, digest(readFileSync(new URL('../intent/0102/execution-hooks.mjs', import.meta.url))));
  assert.equal(report.families.SCHEMA.uncovered, 1); assert.equal(report.families.ACCESSIBILITY.uncovered, 16);
  assert.equal(report.completeCoverage, false); assert.equal(report.normativeAcceptanceComplete, false); assert.equal(report.independentAcceptance, false);
});
