import { intentAdmissionOutputSchema } from '../src/intent-admission-discovery-contracts.ts';
import { runDiscoveryFixture } from './intent-run-discovery.fixture.ts';
export function admissionDiscoveryFixture() {
  const f = runDiscoveryFixture();
  const output = intentAdmissionOutputSchema.parse({ ...f.input, kind: 'steer-admission-discovery/v1', bindingSetDigest: 'f'.repeat(64), configuredExecutionCount: 2,
    observedAt: f.output.observedAt, useUntil: f.output.useUntil, latest: f.output.latest,
    entries: f.output.entries.map((entry, index) => ({ ...entry, originalRecord: index ? 'present-metadata' : 'not-observed', executionExpired: !!index })),
    nextCursor: null, coverage: 'configured-scope-and-development-bindings-only', originalContentVerified: false, executionState: 'not-inspected',
    retryAuthorized: false, executionAuthorized: false, savedToGit: false, gateSigned: false });
  return { input: f.input, output };
}
