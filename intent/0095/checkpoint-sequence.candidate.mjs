// Explicit current-audit sequence profile; the original single-slot API is unchanged.
import { createMigrationCheckpointSequenceVerifier as createSequence } from '../0093/migration-checkpoint.candidate.mjs';
export { sequencePolicyDigest as policyDigest } from '../0093/migration-checkpoint.candidate.mjs';
export function createMigrationCheckpointSequenceVerifier(contextBytes) {
  return createSequence(contextBytes);
}
