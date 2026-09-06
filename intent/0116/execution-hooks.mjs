import { releaseLifecycleExecutionCase } from '../0107/execution-fixtures.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const limits = { executionAuthorized: false, dispositionEvidenceVerified: false, quarantineVerified: false, deletionVerified: false, referenceClearanceVerified: false };
export function releaseLifecycleExecutionHook(required) {
  if (required.family !== 'LIFECYCLE-GRAPH' || required.coordinate.classId !== 'RC-RELEASE-MIGRATION' || !['before', 'at', 'after', 'complete'].includes(required.coordinate.boundary)) return null;
  const point = required.coordinate.boundary;
  return { executor: 'intent/0116/release-lifecycle.candidate.mjs#' + (point === 'complete' ? 'createReleaseLifecycleVerifier' : 'createReleaseLifecycleReadinessVerifier'),
    scope: 'release-only current-v6 with exact trusted retirement selector; archived 2026 release-rails event and original key windows plus fresh synthetic 2033 qualified/current proofs; exact source clocks, waiting/pending and full disposition/replay; not real environment shutdown, deletion or independent acceptance',
    run(check) {
      const binding = (value, graph) => ({ configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest,
        runtimeConfigDigest: sha256(value.runtimeBytes), historicalEvidenceDigest: sha256(graph.historicalEvidenceBytes),
        retirementContextDigest: sha256(JSON.parse(value.runtimeBytes).retirementContextBytes), retirementEventDigest: JSON.parse(graph.eventBytes).recordDigest });
      for (const variant of ['full-positive', 'full-replay', 'full-missing-receipt', 'full-wrong-clock-source', 'full-wrong-rails-record', 'full-traffic-active', 'full-credentials-active']) {
        const value = releaseLifecycleExecutionCase('complete', variant);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), !['full-positive', 'full-replay'].includes(variant) ?
          { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID', executionAuthorized: false } : { ...binding(value, value.graph),
            state: 'validated-lifecycle-candidate', firstError: null, executionAuthorized: false, boundaryAt: value.boundaryAt, copyCount: 2, protectedActionCount: 3, replayCount: variant === 'full-replay' ? 3 : 0,
            evidenceDigest: sha256(jcs([...value.graph.copies.map(c => JSON.parse(c.receiptBytes).recordDigest), JSON.parse(value.graph.aggregateBytes).recordDigest, JSON.parse(value.graph.tombstone.receiptBytes).recordDigest])) });
      }
      for (const variant of ['positive', 'wrong-clock-source', 'wrong-actor', 'wrong-rails-record', 'wrong-provider-record', 'wrong-retired-time', 'traffic-active', 'credentials-active',
        'missing-history', 'missing-owner-archive', 'missing-state', 'held', 'wrong-provider', 'future-state', 'wrong-target']) {
        const value = releaseLifecycleExecutionCase(point, variant);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), !['positive', 'held'].includes(variant) ? { ...limits, state: 'blocked', firstError: 'LIFECYCLE_READINESS_INVALID' } : {
          ...limits, ...binding(value, value.head), state: variant === 'held' ? 'retained-on-hold' : point === 'before' ? 'waiting-retention' : 'eligible-pending-disposition-evidence',
          firstError: null, retentionEligible: variant !== 'held' && point !== 'before', boundaryAt: value.boundaryAt, evaluatedAt: value.evaluationTime,
          dispositionPolicyDigest: value.fullVerifier.policyDigest, inputDigest: sha256(jcs({ bytes: value.bytes, evaluatedAt: value.evaluationTime })), targetDigest: sha256(jcs(value.head.target)),
          inventoryDigest: JSON.parse(value.head.inventoryBytes).recordDigest, stateDigest: JSON.parse(value.head.stateBytes).recordDigest, historyDigest: sha256(jcs([...value.head.historyBytes, value.head.eventBytes])) });
      }
      const value = releaseLifecycleExecutionCase(point);
      check(value.input, () => value.fullVerifier.verify(value.bytes, value.evaluationTime), { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID', executionAuthorized: false });
    } };
}
