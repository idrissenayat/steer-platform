import { rawDeadlineExecutionCase } from '../0107/execution-fixtures.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const variants = ['positive', 'replay', 'missing-grant', 'expired-grant', 'missing-state', 'held', 'reference-active',
  'missing-receipt', 'missing-batch', 'missing-tombstone', 'deadline-receipt', 'late-receipt', 'late-second'];
export function rawDeadlineExecutionHook(required) {
  if (required.family !== 'LIFECYCLE-GRAPH' || required.coordinate.classId !== 'RC-CORPUS-RAW-WORKING' || !['before', 'at', 'after', 'complete'].includes(required.coordinate.boundary)) return null;
  return { executor: 'intent/0061/lifecycle-graph.candidate.mjs#createLifecycleGraphVerifier',
    scope: 'raw-v2 full preterminal grant/batch/action/provider/tombstone graph at exact source +59/+60/+61/+66 seconds; timely completion is a maximum deadline, not a minimum wait; inclusive receipt deadline versus signed +1ns/+1s late receipts; offline evidence audit, not live erasure or quarantine',
    run(check) {
      const observe = (point, variant) => {
        const value = rawDeadlineExecutionCase(point, variant), graph = value.graph;
        let expected = { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID' };
        if (['held', 'reference-active'].includes(variant)) expected = { state: 'retained-on-hold', firstError: null, boundaryAt: value.boundaryAt };
        if (['positive', 'replay'].includes(variant) || point === 'complete' && variant === 'deadline-receipt') {
          const batch = JSON.parse(graph.rawBatchBytes), raw = JSON.parse(graph.rawPolicyBytes), authority = JSON.parse(JSON.parse(raw.humanBundleBytes).authorityBytes);
          expected = { state: 'validated-lifecycle-candidate', firstError: null, boundaryAt: value.boundaryAt,
            configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest, copyCount: 3, protectedActionCount: 4,
            replayCount: variant === 'replay' ? 4 : 0, rawBatchMode: variant === 'replay' ? 'replay' : 'first',
            rawBatchPlanDigest: JSON.parse(batch.planBytes).recordDigest, rawBatchReservationDigest: JSON.parse(batch.reservationBytes).recordDigest,
            rawGrantDigest: authority.recordDigest, executionAuthorized: false,
            evidenceDigest: sha256(jcs([...graph.copies.map((copy) => JSON.parse(copy.receiptBytes).recordDigest), JSON.parse(graph.aggregateBytes).recordDigest,
              JSON.parse(graph.tombstone.receiptBytes).recordDigest, authority.recordDigest, JSON.parse(batch.planBytes).recordDigest, JSON.parse(batch.reservationBytes).recordDigest])) };
        }
        check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), expected);
      };
      for (const variant of variants) observe(required.coordinate.boundary, variant);
      // Earlier observations reject unavailable future aggregate/tombstone bytes.
      // The paired complete audit isolates the actual provider-receipt deadline.
      if (required.coordinate.boundary !== 'complete') for (const variant of ['deadline-receipt', 'late-receipt', 'late-second']) observe('complete', variant);
    } };
}
