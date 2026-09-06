import { longRetentionExecutionCase } from '../0107/execution-fixtures.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const classes = new Set(['RC-SECURITY-AUDIT', 'RC-CORPUS-BASELINE', 'RC-DECISION-PROOF', 'RC-LEGAL-SIGNED-LOG', 'RC-REFERENCED-EVIDENCE']);
export function longRetentionExecutionHook(required) {
  if (required.family !== 'LIFECYCLE-GRAPH' || !classes.has(required.coordinate.classId) || !['before', 'complete'].includes(required.coordinate.boundary)) return null;
  const { classId, boundary } = required.coordinate, reference = classId === 'RC-REFERENCED-EVIDENCE';
  return { executor: reference ? 'intent/0089/reference-lifecycle.candidate.mjs#createReferenceLifecycleVerifier' : 'intent/0061/lifecycle-graph.candidate.mjs#createCurrentLifecycleGraphVerifier',
    scope: 'five admitted long-retention classes at exact source -1/+6 second observations; retained original history/keys and fresh synthetic current-v4/v5 qualified-archive, human/action/provider proofs; reference removal and named tombstone; no real future evidence, pending-state or deletion claim',
    run(check) {
      const observe = (point, variant, expected) => {
        const value = longRetentionExecutionCase(classId, point, variant);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), { ...expected, executionAuthorized: false });
      };
      for (const variant of ['positive', 'replay']) {
        const value = longRetentionExecutionCase(classId, 'complete', variant);
        observe('complete', variant, { state: 'validated-lifecycle-candidate', firstError: null, boundaryAt: value.boundaryAt,
          configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest, runtimeConfigDigest: sha256(value.runtimeBytes), historicalEvidenceDigest: sha256(value.graph.historicalEvidenceBytes),
          copyCount: 2, protectedActionCount: 3, replayCount: variant === 'replay' ? 3 : 0,
          ...(reference ? { referenceEvidenceDigest: sha256(value.graph.referenceRevocationBytes), referenceCount: 2, tombstoneRecordId: 'tombstone-evidence-1' } : {}),
          evidenceDigest: sha256(jcs([...value.graph.copies.map((copy) => JSON.parse(copy.receiptBytes).recordDigest), JSON.parse(value.graph.aggregateBytes).recordDigest, JSON.parse(value.graph.tombstone.receiptBytes).recordDigest])) });
      }
      const denied = { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' };
      observe('complete', 'missing-receipt', denied);
      observe(boundary, 'missing-history', denied);
      observe(boundary, 'missing-state', denied);
      const scheduled = { state: 'scheduled', firstError: null, boundaryAt: longRetentionExecutionCase(classId, boundary).boundaryAt };
      if (boundary === 'before') { observe(boundary, 'positive', scheduled); observe(boundary, 'missing-receipt', scheduled); }
      if (reference) observe(boundary, 'missing-reference', boundary === 'before' ? scheduled : {
        state: 'retained-pending-safe-disposition', firstError: 'REFERENCE_EVIDENCE_REQUIRED', boundaryAt: scheduled.boundaryAt });
    } };
}
