import { immediateLifecycleExecutionCase } from '../0107/execution-fixtures.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const limits = { executionAuthorized: false, dispositionEvidenceVerified: false, quarantineVerified: false, deletionVerified: false, referenceClearanceVerified: false };
export function immediateLifecycleExecutionHook(required) {
  if (required.family !== 'LIFECYCLE-GRAPH' || required.coordinate.classId !== 'RC-REBUILDABLE' || !['before', 'at', 'after', 'complete'].includes(required.coordinate.boundary)) return null;
  const point = required.coordinate.boundary;
  return { executor: point === 'complete' ? 'intent/0061/lifecycle-graph.candidate.mjs#createLifecycleGraphVerifier' : 'intent/0115/lifecycle-immediate.candidate.mjs#createImmediateLifecycleReadinessVerifier',
    scope: 'exact rebuildable source observations; separate original-era head-only waiting-for-trigger/pending surface and complete +6s disposition/replay controls; available complete history, earliest observed trigger, pinned target and provider selectors; no future trigger, immediate physical deletion, quarantine or execution authority',
    run(check) {
      for (const variant of ['full-positive', 'full-replay', 'full-missing-receipt']) {
        const value = immediateLifecycleExecutionCase('complete', variant);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), variant === 'full-missing-receipt' ? { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' } : {
          state: 'validated-lifecycle-candidate', firstError: null, boundaryAt: '2026-09-04T12:00:00Z', copyCount: 2, protectedActionCount: 3, replayCount: variant === 'full-replay' ? 3 : 0,
          configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest,
          evidenceDigest: sha256(jcs([...value.graph.copies.map((entry) => JSON.parse(entry.receiptBytes).recordDigest), JSON.parse(value.graph.aggregateBytes).recordDigest, JSON.parse(value.graph.tombstone.receiptBytes).recordDigest])) });
      }
      for (const variant of ['positive', 'rebuild-trigger', 'future-trigger', 'missing-state', 'missing-inventory', 'bad-history', 'incomplete-history', 'stale-inventory',
        'future-state', 'wrong-provider', 'wrong-target', 'wrong-policy', 'extra-field', 'active-hold', 'reference-active', ...(point === 'before' ? [] : ['earliest-superseded', 'earliest-rebuild'])]) {
        const value = immediateLifecycleExecutionCase(point, variant), held = ['active-hold', 'reference-active'].includes(variant), earliest = variant.startsWith('earliest-');
        let expected = { ...limits, state: 'blocked', firstError: 'LIFECYCLE_READINESS_INVALID' };
        if (held || earliest || ['positive', 'rebuild-trigger'].includes(variant)) expected = { ...limits, firstError: null,
          state: held ? 'retained-on-hold' : point === 'before' ? 'waiting-for-trigger' : 'eligible-pending-disposition-evidence', retentionEligible: !held && point !== 'before',
          boundaryAt: point === 'before' ? null : earliest ? '2026-09-04T11:59:40Z' : '2026-09-04T12:00:00Z', evaluatedAt: value.evaluationTime,
          configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest, dispositionPolicyDigest: value.fullVerifier.policyDigest,
          inputDigest: sha256(jcs({ bytes: value.bytes, evaluatedAt: value.evaluationTime })), targetDigest: sha256(jcs(value.head.target)),
          inventoryDigest: JSON.parse(value.head.inventoryBytes).recordDigest, stateDigest: JSON.parse(value.head.stateBytes).recordDigest,
          historyDigest: sha256(jcs([...value.head.historyBytes, value.head.eventBytes])),
          requires: [...(point === 'before' ? ['observed-trigger'] : []), 'human-disposition-authority', 'protected-actions', 'provider-receipts', 'aggregate', 'tombstone'] };
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), expected);
      }
      const value = immediateLifecycleExecutionCase(point);
      check(value.input, () => value.fullVerifier.verify(value.bytes, value.evaluationTime), { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' });
    } };
}
