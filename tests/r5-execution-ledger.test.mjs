import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { loadRequiredCases, digest } from '../intent/0098/required-cases.mjs';
import { executionHook } from '../intent/0098/execution-hooks.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
import { LIFECYCLE_EVENT_EXTRAS } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
const root = new URL('../', import.meta.url), base = 'intent/0001/reviews/domain/round-3/remediation/';
const read = (path) => readFileSync(new URL(path, root), 'utf8'), json = (path) => JSON.parse(read(path));

test('0098: required legacy IDs exactly match the frozen declaration loops without executing its decision oracles', () => {
  const catalog = loadRequiredCases(), legacy = catalog.cases.filter((row) => row.source === 'legacy');
  const source = read(base + 'validate-remediation.mjs'), start = source.indexOf('// Data declarations are expanded before execution'), end = source.indexOf('const authorizationBase=');
  assert.ok(start > 0 && end > start); const declared = new Set();
  // This exact source is hash-checked by loadRequiredCases above. Evaluate only
  // the inspected declaration loops, never imports, decision calls or mark().
  runInNewContext(source.slice(start, end), { fixtures: json(base + 'NORMATIVE-EXECUTION-INVENTORY.candidate.json').dimensions,
    privacyDetectorCases: json(base + 'PRIVACY-DETECTOR-CASES.candidate.json'), lifecyclePolicy: json(base + 'LIFECYCLE-POLICY-TABLE.candidate.json'),
    LIFECYCLE_EVENT_EXTRAS, declare: (id) => { assert.ok(!declared.has(id)); declared.add(id); } }, { timeout: 1000 });
  assert.equal(legacy.length, 4027); assert.deepEqual(legacy.map((row) => row.id).sort(), [...declared].sort());
  assert.equal(catalog.cases.filter((row) => row.family === 'MIGRATION').length, 3600);
  assert.equal(new Set(catalog.cases.map((row) => row.id)).size, 4036); assert.deepEqual(loadRequiredCases(), catalog);
});

test('0098: all nine R5 reproductions retain source content including singular major-finding objects', () => {
  const rows = loadRequiredCases().cases.filter((row) => row.source === 'R5'), critic = json(base + 'preflight-critic-r5.json');
  assert.equal(rows.length, 9);
  const expected = critic.findings.flatMap((finding) => (finding.reproductions ?? [finding.reproduction]).map((reproduction, index) => ({
    id: `R5:${finding.id}:reproduction:${index + 1}`, coordinate: { findingId: finding.id, ordinal: index + 1, reproduction },
  })));
  assert.deepEqual(rows.map(({ id, coordinate }) => ({ id, coordinate })), expected);
  assert.ok(rows.some((row) => row.coordinate.findingId.endsWith('004'))); assert.ok(rows.some((row) => row.coordinate.findingId.endsWith('005')));
});

test('0098: actual corrected hooks produce exact-ID execution seals while every unmapped case stays uncovered', () => {
  const catalog = loadRequiredCases(), report = runCorrectedCoverage(), mapped = catalog.cases.filter((row) => executionHook(row) !== null).map((row) => row.id);
  assert.equal(report.required, 4036); assert.equal(report.executed, 377); assert.equal(report.passed, 377); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3659);
  assert.deepEqual(report.executions.map((row) => row.id), mapped); assert.equal(report.completeCoverage, false);
  for (const row of report.executions) {
    assert.ok(row.observationCount > 0); assert.equal(row.status, 'passed'); assert.match(row.observationsDigest, /^[0-9a-f]{64}$/);
    assert.equal(row.implementationDigest, digest(read(row.executor.split('#')[0])));
  }
  assert.equal(report.families.MIGRATION.executed, 0); assert.equal(report.families['LIFECYCLE-GRAPH'].executed, 36);
  assert.equal(report.families.R5.executed, 9); assert.equal(report.families.R5.uncovered, 0);
  assert.deepEqual(runCorrectedCoverage(), report);
});

test('0098: negative event hooks require positive controls and a failed assertion is not swallowed by a hook', () => {
  const required = loadRequiredCases().cases.find((row) => row.family === 'LIFECYCLE-NEGATIVE'), hook = executionHook(required), observations = [];
  hook.run((input, invoke, expected) => { const result = invoke(); observations.push({ input, result, expected }); });
  assert.equal(observations.length, 2); assert.equal(observations[0].result.state, 'validated-trigger'); assert.equal(observations[1].result.state, 'blocked-policy-conflict');
  assert.notEqual(observations[0].input, observations[1].input);
  assert.throws(() => hook.run(() => { throw new Error('FAILED_ASSERTION'); }), /FAILED_ASSERTION/);
  assert.equal(executionHook({ id: 'unknown', family: 'unknown' }), null);
});

test('0098: CLI report is truthful and complete-coverage mode fails while uncovered cases remain', () => {
  const command = fileURLToPath(new URL('../scripts/run-r5-coverage.mjs', import.meta.url));
  for (const mode of [[], ['--report'], ['--require-complete']]) {
    const result = spawnSync(process.execPath, [command, ...mode], { encoding: 'utf8', timeout: 30000, maxBuffer: 2097152 });
    assert.equal(result.status, mode[0] === '--report' ? 0 : 2, result.stderr);
    const report = JSON.parse(result.stdout); assert.equal(report.completeCoverage, false); assert.equal(report.uncovered, 3659); assert.equal(report.failed, 0);
  }
  const bad = spawnSync(process.execPath, [command, '--approve'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(bad.status, 64); assert.equal(bad.stdout, '');
});

test('0098: report separates partial hook execution from global normative, live or independent acceptance', () => {
  const report = runCorrectedCoverage();
  for (const flag of ['normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.ok(report.executions.filter((row) => row.id.startsWith('PRIVACY-GRAPH:')).every((row) => row.scope.includes('0063')));
  assert.equal(Object.values(report.families).reduce((n, row) => n + row.required, 0), report.required);
  assert.equal(Object.values(report.families).reduce((n, row) => n + row.executed + row.uncovered, 0), report.required);
});
