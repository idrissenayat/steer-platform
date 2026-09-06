// A development runner: assertions run here; an imported report is never evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRequiredCases, digest } from './required-cases.mjs';
import { executionHook } from './execution-hooks.mjs';
import { jcs, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

export function runCorrectedCoverage() {
  const catalog = loadRequiredCases(), executions = [], uncovered = [], families = {};
  for (const required of catalog.cases) {
    const totals = families[required.family] ??= { required: 0, executed: 0, passed: 0, failed: 0, uncovered: 0 }; totals.required++;
    const hook = executionHook(required);
    if (hook === null) { uncovered.push(required.id); totals.uncovered++; continue; }
    const observations = []; let status = 'passed';
    try {
      hook.run((input, invoke, expected) => {
        assert.equal(typeof input, 'string'); const result = invoke();
        observations.push({ inputDigest: digest(input), outputDigest: digest(jcs(result)), expectedDigest: digest(jcs(expected)) });
        for (const [field, value] of Object.entries(expected)) assert.deepEqual(result[field], value);
        if (Object.hasOwn(result, 'effects')) assert.deepEqual(result.effects, zeroEffects());
      });
      assert.ok(observations.length > 0, 'EMPTY_EXECUTION_IS_NOT_COVERAGE');
    } catch { status = 'failed'; }
    totals.executed++; totals[status]++;
    executions.push({ id: required.id, executor: hook.executor, implementationDigest: digest(readFileSync(new URL('../../' + hook.executor.split('#')[0], import.meta.url))),
      scope: hook.scope, status, observationCount: observations.length,
      observationsDigest: digest(jcs(observations)) });
  }
  assert.equal(new Set(executions.map((row) => row.id)).size, executions.length);
  const failed = executions.filter((row) => row.status === 'failed').length;
  const mapped = new Set(executions.map((row) => row.id));
  assert.deepEqual([...mapped, ...uncovered].sort(), catalog.cases.map((row) => row.id).sort());
  return { version: 'steer-corrected-execution-ledger/v1', baselineRevision: catalog.baselineRevision,
    catalogDigest: catalog.catalogDigest, sourcePinsDigest: catalog.sourcePinsDigest,
    runnerDigest: digest(readFileSync(new URL('./execution-ledger.mjs', import.meta.url))),
    hooksDigest: digest(readFileSync(new URL('./execution-hooks.mjs', import.meta.url))),
    supplementalHookSources: ['intent/0099/execution-hooks.mjs', 'intent/0099/execution-fixtures.mjs', 'intent/0100/execution-hooks.mjs', 'intent/0100/execution-fixtures.mjs',
      'intent/0101/execution-hooks.mjs', 'intent/0101/execution-fixtures.mjs', 'intent/0102/execution-hooks.mjs', 'intent/0103/execution-hooks.mjs'].map((path) => ({
      path, digest: digest(readFileSync(new URL('../../' + path, import.meta.url))) })),
    required: catalog.cases.length, executed: executions.length, passed: executions.length - failed, failed, uncovered: uncovered.length,
    uncoveredIdsDigest: digest(jcs(uncovered)), executionsDigest: digest(jcs(executions)), families, executions,
    completeCoverage: uncovered.length === 0 && failed === 0, normativeAcceptanceComplete: false, independentAcceptance: false,
    executionAuthorized: false, liveProviderUsed: false,
    limitations: ['Executed means this registered hook ran and its assertions passed, not all invariants of the associated oracle.',
      'No registered hook means uncovered here, not necessarily absent implementation elsewhere.',
      'Privacy graph hooks now include 0063 independent time observation; later trust eras and remaining global time requirements still need reconciliation.',
      'Legacy baseline calls inside a counterexample hook are not credited as corrected coverage.',
      'Non-phone detector IDs execute the unchanged classifier retained by the corrected graph; they do not claim newly corrected detector behavior or corpus acceptance.',
      'Schema IDs cover the selected structural formats and precision successor only, not signature validity, corrected graph adequacy or future profiles; the obsolete migration schema stays unmapped.',
      'The source catalog is the frozen declaration plus nine R5 reproductions, not every additional normative clause or variation.',
      'These are synthetic development executions; full normative, live integration, independent and protected review remain separate.'] };
}
