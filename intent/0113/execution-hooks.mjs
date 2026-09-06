import { immutableRetentionExecutionCase } from '../0107/execution-fixtures.mjs';
export function immutableRetentionExecutionHook(required) {
  if (required.family !== 'LIFECYCLE-GRAPH' || required.coordinate.classId !== 'RC-AUTHORITATIVE-ARTIFACT' || !['before', 'at', 'after', 'complete'].includes(required.coordinate.boundary)) return null;
  return { executor: 'intent/0061/lifecycle-graph.candidate.mjs#createLifecycleGraphVerifier',
    scope: 'indefinite authoritative-artifact retention at the exact source commit instant; four frozen labels alias one instant, not four distinct boundaries; valid event/inventory/state with no effect evidence, conservative hold, injected effects and proof failures; no deletion or live immutable-store claim',
    run(check) {
      for (const variant of ['positive', 'active-hold', 'effects-injected', 'missing-state', 'missing-inventory', 'wrong-parent', 'future-state', 'wrong-history', 'wrong-trigger', 'proposed-expiry', 'bad-event-proof']) {
        const value = immutableRetentionExecutionCase(required.coordinate.boundary, variant);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), ['positive', 'active-hold', 'effects-injected'].includes(variant) ?
          { state: 'retained-immutable', firstError: null, boundaryAt: null } : { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' });
      }
    } };
}
