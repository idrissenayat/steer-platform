import { createCurrentMigrationChainVerifier } from '../0092/migration-chain.candidate.mjs';
export { observationPolicyDigest as policyDigest } from '../0092/migration-chain.candidate.mjs';
export function createMigrationChainObservationVerifier(contextBytes) {
  return createCurrentMigrationChainVerifier(contextBytes);
}
