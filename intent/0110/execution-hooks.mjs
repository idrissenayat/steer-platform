import { shortRetentionExecutionCase } from '../0107/execution-fixtures.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const classes = new Set(['RC-FAILED-RUN', 'RC-POSTHOG-RAW', 'RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT']);
export function shortRetentionExecutionHook(required) {
  if (required.family !== 'LIFECYCLE-GRAPH' || !classes.has(required.coordinate.classId) || !['before', 'complete'].includes(required.coordinate.boundary)) return null;
  const { classId, boundary } = required.coordinate;
  return { executor: 'intent/0061/lifecycle-graph.candidate.mjs#createLifecycleGraphVerifier',
    scope: 'exact source trigger, parent cap and -1/+6 second boundary observations for four original-key-era classes; full positive/replay controls, safe scheduling and missing-proof denials; no at/after pending-state, future-class or live deletion claim',
    run(check) {
      const observe = (point, variant, expected) => {
        const value = shortRetentionExecutionCase(classId, point, variant);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), expected);
      };
      // Every coordinate must have a complete validated disposition control.
      for (const variant of ['positive', 'replay']) {
        const value = shortRetentionExecutionCase(classId, 'complete', variant);
        observe('complete', variant, { state: 'validated-lifecycle-candidate', firstError: null, boundaryAt: value.boundaryAt,
          configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest,
          copyCount: 2, protectedActionCount: 3, replayCount: variant === 'replay' ? 3 : 0,
          evidenceDigest: sha256(jcs([...value.graph.copies.map((copy) => JSON.parse(copy.receiptBytes).recordDigest), JSON.parse(value.graph.aggregateBytes).recordDigest, JSON.parse(value.graph.tombstone.receiptBytes).recordDigest])) });
      }
      const denied = { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' };
      observe('complete', 'missing-receipt', denied);
      observe(boundary, 'missing-state', denied);
      if (classId.startsWith('RC-CORPUS-')) observe(boundary, 'wrong-parent', denied);
      if (boundary === 'before') {
        const expected = { state: 'scheduled', firstError: null, boundaryAt: shortRetentionExecutionCase(classId, boundary).boundaryAt };
        observe(boundary, 'positive', expected);
        // Before expiry, effects evidence is deliberately not consumed. This
        // is scheduling evidence, never acceptance of premature copy receipts.
        observe(boundary, 'missing-receipt', expected);
      }
    } };
}
