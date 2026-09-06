import { lifecycleGraphExecutionCase, lifecycleNegativeExecutionCase } from '../0107/execution-fixtures.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const kinds = new Set(['active-hold', 'hold-conflict', 'stale-inventory', 'provider-partial', 'provider-wrong-copy', 'aggregate-missing', 'early-tombstone',
  'ordinary-replay', 'missing-authority', 'request-reused', 'restored-race', 'local-signer-receipt', 'copy-missing', 'copy-duplicate', 'copy-extra',
  'tuple-key-mismatch', 'provider-mismatch', 'policy-mismatch', 'target-mismatch', 'cas-loser', 'receipt-missing', 'receipt-duplicate',
  'crash-before-aggregate', 'invalid-human-schema', 'provider-before-not-before', 'provider-after-expiry', 'provider-registry-substitution']);
export function lifecycleNegativeExecutionHook(required) {
  if (required.family !== 'LIFECYCLE-GRAPH-NEGATIVE' || !kinds.has(required.coordinate.kind)) return null;
  const kind = required.coordinate.kind;
  return { executor: 'intent/0061/lifecycle-graph.candidate.mjs#createLifecycleGraphVerifier',
    scope: 'full original-era failed-run control then exact adapted ordinary lifecycle negative; active hold retains; copy/provider selectors bind through shared resource proof; injected registry is rejected by pinned closed-envelope design; no raw/reference, future-era or real deletion claim',
    run(check) {
      const positive = lifecycleGraphExecutionCase();
      check(positive.input, () => positive.verifier.verify(positive.bytes, positive.evaluationTime), {
        state: 'validated-lifecycle-candidate', firstError: null, boundaryAt: '2026-12-03T12:00:00Z', copyCount: 2, protectedActionCount: 3, replayCount: 0,
        evidenceDigest: sha256(jcs([...positive.graph.copies.map((copy) => JSON.parse(copy.receiptBytes).recordDigest), JSON.parse(positive.graph.aggregateBytes).recordDigest, JSON.parse(positive.graph.tombstone.receiptBytes).recordDigest])),
      });
      const value = lifecycleNegativeExecutionCase(kind);
      check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), kind === 'active-hold' ? {
        state: 'retained-on-hold', firstError: null, boundaryAt: '2026-12-03T12:00:00Z',
      } : { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' });
    } };
}
