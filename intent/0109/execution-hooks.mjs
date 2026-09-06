import { specialLifecycleExecutionCase } from '../0107/execution-fixtures.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const kinds = new Set(['reference-missing', 'raw-grant-missing', 'malformed-raw-grant']);
export function specialLifecycleExecutionHook(required) {
  if (required.family !== 'LIFECYCLE-GRAPH-NEGATIVE' || !kinds.has(required.coordinate.kind)) return null;
  const kind = required.coordinate.kind, reference = kind === 'reference-missing';
  return { executor: reference ? 'intent/0089/reference-lifecycle.candidate.mjs#createReferenceLifecycleVerifier' : 'intent/0061/lifecycle-graph.candidate.mjs#createLifecycleGraphVerifier',
    scope: reference ? 'full current-v5 reference graph with retained historical bytes, fresh synthetic trust/qualified proofs, exact copy hashes, removal and named tombstone; missing evidence retains; no real future observation or deletion' :
      'full raw-v2 graph with preterminal grant, complete batch and three copy/four action paths; malformed legacy authority-array shape is exercised in the actual raw-grant slot, not merely as an obsolete failed-run field; no real erasure',
    run(check) {
      for (const variant of ['positive', 'replay', 'negative']) {
        const value = specialLifecycleExecutionCase(kind, variant);
        if (variant === 'negative') {
          check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), reference ? {
            state: 'retained-pending-safe-disposition', firstError: 'REFERENCE_EVIDENCE_REQUIRED', boundaryAt: '2029-09-04T12:00:00Z', executionAuthorized: false,
          } : { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' });
          continue;
        }
        const extra = reference ? {
          runtimeConfigDigest: sha256(value.runtimeBytes), historicalEvidenceDigest: sha256(value.graph.historicalEvidenceBytes),
          referenceEvidenceDigest: sha256(value.graph.referenceRevocationBytes), referenceCount: 2, tombstoneRecordId: 'tombstone-evidence-1',
        } : (() => {
          const raw = JSON.parse(value.graph.rawPolicyBytes), batch = JSON.parse(value.graph.rawBatchBytes);
          return { rawBatchMode: variant === 'replay' ? 'replay' : 'first', rawGrantDigest: JSON.parse(raw.rawGrantBytes).authority.recordDigest,
            rawBatchPlanDigest: JSON.parse(batch.planBytes).recordDigest, rawBatchReservationDigest: JSON.parse(batch.reservationBytes).recordDigest };
        })();
        const digestParts = [...value.graph.copies.map((copy) => JSON.parse(copy.receiptBytes).recordDigest), JSON.parse(value.graph.aggregateBytes).recordDigest, JSON.parse(value.graph.tombstone.receiptBytes).recordDigest,
          ...(!reference ? [extra.rawGrantDigest, extra.rawBatchPlanDigest, extra.rawBatchReservationDigest] : [])];
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), {
          state: 'validated-lifecycle-candidate', firstError: null, copyCount: reference ? 2 : 3, protectedActionCount: reference ? 3 : 4,
          replayCount: variant === 'replay' ? reference ? 3 : 4 : 0, executionAuthorized: false,
          boundaryAt: reference ? '2029-09-04T12:00:00Z' : '2026-09-04T12:01:00Z', configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest,
          ...extra, evidenceDigest: sha256(jcs(digestParts)),
        });
      }
    } };
}
