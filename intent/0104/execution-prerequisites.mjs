// Bookkeeping over the runner's fresh private execution array, never imported evidence.
import assert from 'node:assert/strict';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
export function sameRunPrerequisites(requiredIds, executions) {
  assert.equal(new Set(requiredIds).size, requiredIds.length, 'DUPLICATE_PREREQUISITE');
  return requiredIds.map((id) => {
    const matches = executions.filter((row) => row.id === id), prior = matches[0];
    assert.ok(matches.length === 1 && prior.status === 'passed' && prior.observationCount > 0, 'SAME_RUN_PREREQUISITE_FAILED');
    return { id, executionDigest: sha256(jcs(prior)) };
  });
}
