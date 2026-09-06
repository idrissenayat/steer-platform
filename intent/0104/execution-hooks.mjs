import { createAccessibilityTimeVerifier, policyDigest } from '../0067/accessibility-time.candidate.mjs';
import { makeAccessibilityBundle } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { consumeWithStreamSeal } from './stream-seal.mjs';
const evaluatedAt = '2026-09-04T12:03:00Z';
export function accessibilityExecutionHook(required) {
  if (required.family !== 'ACCESSIBILITY') return null;
  const kind = required.coordinate.kind;
  return { executor: 'intent/0067/accessibility-time.candidate.mjs#createAccessibilityTimeVerifier',
    requires: kind === 'positive' ? [] : ['ACCESSIBILITY:positive'],
    scope: 'complete original synthetic accessibility case with actual consumed-row prefix seal; same-run full positive prerequisite for negatives; not a browser or qualified manual audit', run(check) {
      const bundle = makeAccessibilityBundle(kind), { rows, evaluationTime, ...metadata } = bundle;
      const serialized = jcs({ version: 'steer-accessibility-time/v1', policyDigest, metadataBytes: jcs(metadata) });
      const verifier = createAccessibilityTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt }));
      check(jcs({ version: 'steer-streamed-execution-input/v1', kind, metadataBytes: serialized, evaluatedAt }), () => {
        const { result, stream } = consumeWithStreamSeal(rows, (input) => verifier.verify(serialized, input));
        return { ...result, consumedStream: stream, consumedRows: stream.count, consumedDigest: stream.rowsDigest,
          streamComplete: stream.exhausted, streamClosed: stream.closed,
          consumedInputDigest: sha256(jcs({ metadataDigest: sha256(serialized), stream })) };
      }, kind === 'positive' ? { valid: true, rawRowCount: 32900, rowCount: 2664900, timedRecordCount: 6, observedAsOfCount: 2,
        consumedRows: 32900, consumedDigest: JSON.parse(metadata.summaryBytes).rawRowsDigest, streamComplete: true, streamClosed: true,
        manualAuditComplete: false, executionAuthorized: false } : { valid: false, error: 'ACCESSIBILITY_TIME_INVALID', rowCount: 0, digest: null,
        streamClosed: true, manualAuditComplete: false, executionAuthorized: false });
    } };
}
