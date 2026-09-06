// Explicit offline exact-time entry point; never selects the original profile.
import { createExactMigrationGraphVerifier } from '../0062/migration-graph.candidate.mjs';
export { exactPolicyDigest as policyDigest } from '../0062/migration-graph.candidate.mjs';
export function createMigrationTimeVerifier(configBytes) {
  return createExactMigrationGraphVerifier(configBytes);
}
