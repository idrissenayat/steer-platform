// Complete historical prefix plus current signed suffix; facts only, no effects.
import { exactKeys, jcs, parseCanonical, sha256, zeroEffects, RETENTION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createHistoricalEventVerifier, policyDigest as historicalPolicy } from '../0078/historical-events.candidate.mjs';
import { createLifecycleEventVerifier, correctionPolicyDigest as originalEventPolicy } from '../0059/lifecycle-events.candidate.mjs';
import { lifecycleEventFollows, eventOrderPolicyDigest } from '../0071/event-order.candidate.mjs';
export const policyDigest = sha256(jcs({ version: 'steer-mixed-history/v1', historicalPolicy, originalEventPolicy, eventOrderPolicyDigest,
  rules: 'exact archived prefix and complete current-key suffix; 129 total events; global event/provider identity uniqueness and ordering; all scope/record/policy bindings; no sorting or dropping; facts only' }));
const ensure = (value) => { if (!value) throw new Error('MIXED_HISTORY_INVALID'); };
export function createMixedHistoryVerifier(trustedHistoricalContextBytes) {
  const archived = createHistoricalEventVerifier(trustedHistoricalContextBytes), context = parseCanonical(trustedHistoricalContextBytes);
  const current = createLifecycleEventVerifier(context.currentRegistryBytes);
  return Object.freeze({ policyDigest,
    verify(serialized, evaluationTime) {
      try {
        ensure(typeof serialized === 'string' && serialized.length <= 16777216); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'archivedEvidenceBytes', 'eventBytes', 'historyBytes']) &&
          input.version === 'steer-mixed-history/v1' && input.policyDigest === policyDigest && Array.isArray(input.historyBytes) && input.historyBytes.length <= 128);
        const checked = archived.verify(input.archivedEvidenceBytes, evaluationTime); ensure(checked.state === 'verified-historical-events');
        const historical = parseCanonical(input.archivedEvidenceBytes), prefix = [...historical.historyBytes, historical.eventBytes], all = [...input.historyBytes, input.eventBytes];
        ensure(all.length >= prefix.length && prefix.every((bytes, index) => bytes === all[index]));
        const suffix = all.slice(prefix.length);
        if (suffix.length) {
          const result = current.verify(jcs({ version: 'steer-r5-001-events/v1', policyDigest: current.policyDigest, scope: context.scope,
            eventBytes: suffix.at(-1), historyBytes: suffix.slice(0, -1), evaluationTime }), evaluationTime);
          ensure(result.state === 'validated-trigger');
        }
        const ids = new Set(), digests = new Set(), proofIds = new Set(), proofDigests = new Set(); let previous = null;
        for (const bytes of all) {
          ensure(typeof bytes === 'string' && bytes.length <= 65536); const event = parseCanonical(bytes), proof = parseCanonical(event.providerProofBytes);
          ensure(event.recordId === context.recordId && event.recordClass === context.recordClass && event.artifactRevision === context.artifactRevision &&
            event.policySha256 === RETENTION_POLICY_SHA && lifecycleEventFollows(previous, event) &&
            !ids.has(event.eventId.toLowerCase()) && !digests.has(event.recordDigest) && !proofIds.has(proof.providerRecordId) && !proofDigests.has(proof.recordDigest));
          ids.add(event.eventId.toLowerCase()); digests.add(event.recordDigest); proofIds.add(proof.providerRecordId); proofDigests.add(proof.recordDigest); previous = event;
        }
        return { state: 'verified-mixed-history', historyDigest: sha256(jcs(all)), archivedEventCount: prefix.length, currentEventCount: suffix.length,
          historicalEvidenceDigest: sha256(input.archivedEvidenceBytes), factOnly: true, currentActionAuthorityRequired: true, executionAuthorized: false, effects: zeroEffects() };
      } catch { return { state: 'blocked', firstError: 'MIXED_HISTORY_INVALID', executionAuthorized: false, effects: zeroEffects() }; }
    },
  });
}
