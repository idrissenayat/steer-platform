import { humanAuthorityDecision as legacyHuman } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { recoveryExecutionCase, humanExecutionCase } from './execution-fixtures.mjs';
export function recoveryHumanExecutionHook(required) {
  if (['RECOVERY-CUT', 'RECOVERY-CORRUPTION'].includes(required.family)) return {
    executor: 'intent/0065/recovery-time.candidate.mjs#createRecoveryTimeVerifier',
    scope: 'complete six-record original-registry recovery audit; four-row synthetic bound; pre-ack unknown is expected, not live recovery', run(check) {
      const value = recoveryExecutionCase(required.family, required.coordinate.kind);
      if (required.family === 'RECOVERY-CORRUPTION') check(value.positiveBytes, () => value.verifier.verify(value.positiveBytes),
        { outcome: 'RECOVERY_VERIFIED', timedRecordCount: 6, observedAsOfCount: 5, executionAuthorized: false });
      check(value.bytes, () => value.verifier.verify(value.bytes), { outcome: value.expectedOutcome, executionAuthorized: false,
        ...(required.family === 'RECOVERY-CUT' ? { timedRecordCount: 6, observedAsOfCount: 5 } : { firstError: 'RECOVERY_TIME_INVALID' }) });
    } };
  const kind = required.family === 'HUMAN-AUTHORITY' ? required.coordinate.kind : required.id === 'R5:PREFLIGHT-R3-R5-002:reproduction:1' ? 'r5-session' :
    required.id === 'R5:PREFLIGHT-R3-R5-002:reproduction:2' ? 'r5-provider-time' : null;
  if (kind !== null) return { executor: 'intent/0058/human-authority.candidate.mjs#createHumanAuthorityVerifier',
    scope: 'complete original-registry nine-proof disposition authority with trusted clock; not current qualified-event/reference profiles or real approval', run(check) {
      const value = humanExecutionCase(kind);
      check(value.positiveBytes, () => value.verifier.verify(value.positiveBytes, value.evaluatedAt), { decision: 'ALLOW', executionAuthorized: false });
      if (value.legacy) check(jcs(value.legacy), () => legacyHuman(value.legacy), { decision: 'ALLOW' });
      check(value.bytes, () => value.verifier.verify(value.bytes, value.evaluatedAt), { decision: value.expectedDecision, executionAuthorized: false,
        ...(kind === 'r5-session' ? { firstError: 'HUMAN_PROVIDER_BINDING_INVALID' } : kind === 'r5-provider-time' ? { firstError: 'HUMAN_TIMED_EVIDENCE_INVALID' } : {}) });
    } };
  return null;
}
