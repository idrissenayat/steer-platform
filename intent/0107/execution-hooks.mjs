import { lifecycleGraphExecutionCase, lifecycleGraphVariants } from './execution-fixtures.mjs';
import { makeLifecycleGraph } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { lifecycleGraphDecision as legacyGraph, lifecycleEventDecision as legacyEvents } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
export function lifecycleGraphExecutionHook(required) {
  if (required.id !== 'R5:PREFLIGHT-R3-R5-001:reproduction:1') return null;
  return { executor: 'intent/0061/lifecycle-graph.candidate.mjs#createLifecycleGraphVerifier',
    scope: 'full original-era RC-FAILED-RUN graph at its actual 90-day boundary, with complete event/history, two copy/human/action/provider paths and tombstone; not future key eras, other lifecycle matrix classes or live deletion',
    run(check) {
      const legacy = makeLifecycleGraph('RC-FAILED-RUN', 'complete', 'complete'), trigger = JSON.parse(legacy).triggerBytes;
      check(jcs({ legacyModelOnly: true, bytes: legacy }), () => {
        const result = legacyGraph(legacy); return { state: result.state, hypotheticalLegacyEffects: result.effects, boundaryAt: result.boundaryAt, copyCount: result.copyCount };
      }, { state: 'deleted-tombstoned', hypotheticalLegacyEffects: { ...zeroEffects(), lifecycle: 1 }, boundaryAt: '2026-12-03T12:00:00Z', copyCount: 2 });
      check(trigger, () => legacyEvents(trigger), { state: 'blocked-policy-conflict', firstError: 'EVENT_SCHEMA_INVALID' });
      for (const variant of lifecycleGraphVariants()) {
        const value = lifecycleGraphExecutionCase(variant), positive = ['positive', 'replay'].includes(variant);
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), positive ? {
          state: 'validated-lifecycle-candidate', firstError: null, configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest,
          boundaryAt: '2026-12-03T12:00:00Z', copyCount: 2, protectedActionCount: 3, replayCount: variant === 'replay' ? 3 : 0,
          evidenceDigest: sha256(jcs([...value.graph.copies.map((copy) => JSON.parse(copy.receiptBytes).recordDigest), JSON.parse(value.graph.aggregateBytes).recordDigest, JSON.parse(value.graph.tombstone.receiptBytes).recordDigest])),
        } : { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' });
        if (variant === 'positive') check(jcs({ configBytes: value.configBytes, bytes: legacy, evaluatedAt: value.evaluationTime }),
          () => value.verifier.verify(legacy, value.evaluationTime), { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' });
      }
    } };
}
