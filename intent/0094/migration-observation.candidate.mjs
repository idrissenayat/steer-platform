// Read-only current audit of immutable staged evidence. No original-as-of claim.
import { exactKeys, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
import { createStagedMigrationCompatibilityVerifier, stagedPolicyDigest } from '../0091/migration-compatibility.candidate.mjs';
export const policyDigest = sha256(jcs({ version: 'steer-migration-current-observation/v1', stagedPolicyDigest,
  rules: 'full current proof/model verification; only unsigned human audit clock rebound; original graph digest preserved; no historical observation or execution authority' }));
export function createCurrentMigrationObservationVerifier(contextBytes) {
  const original = createStagedMigrationCompatibilityVerifier(contextBytes);
  return Object.freeze({ policyDigest: original.policyDigest, observationPolicyDigest: policyDigest,
    verify(serialized, evaluationTime) {
      try {
        const now = exactInstant(evaluationTime);
        if (now === null || typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > 16777216) throw new Error('INVALID');
        const envelope = parseCanonical(serialized);
        if (!exactKeys(envelope, ['version', 'configDigest', 'policyDigest', 'graphBytes'])) throw new Error('INVALID');
        const graph = parseCanonical(envelope.graphBytes), view = { ...graph };
        if (graph.cleanupBundleBytes !== '') {
          const bundle = parseCanonical(graph.cleanupBundleBytes), retainedClock = exactInstant(bundle.evaluationTime);
          if (retainedClock === null || retainedClock > now) throw new Error('INVALID');
          view.cleanupBundleBytes = jcs({ ...bundle, evaluationTime });
        }
        const verified = original.verify(jcs({ ...envelope, graphBytes: jcs(view) }), evaluationTime);
        if (verified.state !== 'verified-migration-model-compatibility') throw new Error('INVALID');
        return { ...verified, graphDigest: sha256(envelope.graphBytes), observationPolicyDigest: policyDigest, evaluatedAt: evaluationTime, originalObservationVerified: false };
      } catch { return { state: 'blocked', firstError: 'MIGRATION_CURRENT_OBSERVATION_INVALID', executionAuthorized: false, effects: zeroEffects(), journalEffects: 0 }; }
    },
  });
}
