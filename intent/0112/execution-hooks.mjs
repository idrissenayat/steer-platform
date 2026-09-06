import { lifecycleReadinessExecutionCase, shortRetentionExecutionCase, longRetentionExecutionCase } from '../0107/execution-fixtures.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const short = new Set(['RC-FAILED-RUN', 'RC-POSTHOG-RAW', 'RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT']);
const long = new Set(['RC-SECURITY-AUDIT', 'RC-CORPUS-BASELINE', 'RC-DECISION-PROOF', 'RC-LEGAL-SIGNED-LOG', 'RC-REFERENCED-EVIDENCE']);
const limits = { executionAuthorized: false, dispositionEvidenceVerified: false, quarantineVerified: false, deletionVerified: false, referenceClearanceVerified: false };
export function lifecycleReadinessExecutionHook(required) {
  if (required.family !== 'LIFECYCLE-GRAPH' || !['at', 'after'].includes(required.coordinate.boundary) || !short.has(required.coordinate.classId) && !long.has(required.coordinate.classId)) return null;
  const { classId, boundary } = required.coordinate;
  return { executor: 'intent/0112/lifecycle-readiness.candidate.mjs#' + (long.has(classId) ? 'createCurrentLifecycleReadinessVerifier' : 'createLifecycleReadinessVerifier'),
    scope: 'exact at/+1-second read-only retention eligibility for nine classes, with full completion/replay controls and fresh head-only proofs; source quarantine wording is not asserted as a real effect; no disposition, reference clearance or execution authority',
    run(check) {
      for (const variant of ['positive', 'replay']) {
        const full = (short.has(classId) ? shortRetentionExecutionCase : longRetentionExecutionCase)(classId, 'complete', variant);
        check(full.input, () => full.verifier.verify(full.bytes, full.evaluationTime), { state: 'validated-lifecycle-candidate', firstError: null, boundaryAt: full.boundaryAt,
          copyCount: 2, protectedActionCount: 3, replayCount: variant === 'replay' ? 3 : 0,
          evidenceDigest: sha256(jcs([...full.graph.copies.map((copy) => JSON.parse(copy.receiptBytes).recordDigest), JSON.parse(full.graph.aggregateBytes).recordDigest, JSON.parse(full.graph.tombstone.receiptBytes).recordDigest])) });
      }
      for (const point of ['before', boundary]) {
        const value = lifecycleReadinessExecutionCase(classId, point);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), { ...limits, firstError: null,
          state: point === 'before' ? 'waiting-retention' : 'eligible-pending-disposition-evidence', retentionEligible: point !== 'before',
          boundaryAt: value.boundaryAt, evaluatedAt: value.evaluationTime, configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest,
          dispositionPolicyDigest: value.fullVerifier.policyDigest, inputDigest: sha256(jcs({ bytes: value.bytes, evaluatedAt: value.evaluationTime })),
          targetDigest: sha256(jcs(value.head.target)), inventoryDigest: JSON.parse(value.head.inventoryBytes).recordDigest,
          stateDigest: JSON.parse(value.head.stateBytes).recordDigest, historyDigest: sha256(jcs([...value.head.historyBytes, value.head.eventBytes])),
          ...(value.runtimeBytes ? { runtimeConfigDigest: sha256(value.runtimeBytes), historicalEvidenceDigest: sha256(value.head.historicalEvidenceBytes) } : {}) });
      }
      for (const variant of ['missing-state', 'bad-history', 'stale-inventory', 'future-state', 'wrong-provider', 'wrong-target', 'wrong-policy', 'wrong-config', 'extra-field',
        ...(['RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT'].includes(classId) ? ['missing-cap'] : [])]) {
        const value = lifecycleReadinessExecutionCase(classId, boundary, variant);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), { ...limits, state: 'blocked', firstError: 'LIFECYCLE_READINESS_INVALID' });
      }
      for (const variant of ['active-hold', 'reference-active']) {
        const value = lifecycleReadinessExecutionCase(classId, boundary, variant);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), { ...limits, state: 'retained-on-hold', firstError: null, retentionEligible: false });
      }
      const value = lifecycleReadinessExecutionCase(classId, boundary);
      check(value.input, () => value.fullVerifier.verify(value.bytes, value.evaluationTime), { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' });
    } };
}
