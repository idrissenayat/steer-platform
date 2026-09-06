// Trusted profile selection only; no runtime context comes from a request.
import { parseCanonical } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createCurrentLifecycleGraphVerifier, createCurrentLifecycleReadinessVerifier } from '../0061/lifecycle-graph.candidate.mjs';
function releaseOnly(bytes) {
  if (typeof bytes !== 'string' || bytes.length > 262144 || parseCanonical(bytes).version !== 'steer-lifecycle-runtime/v6') throw new Error('RELEASE_PROFILE_REQUIRED');
}
export function createReleaseLifecycleVerifier(configBytes, runtimeBytes) { releaseOnly(runtimeBytes); return createCurrentLifecycleGraphVerifier(configBytes, runtimeBytes); }
export function createReleaseLifecycleReadinessVerifier(configBytes, runtimeBytes) { releaseOnly(runtimeBytes); return createCurrentLifecycleReadinessVerifier(configBytes, runtimeBytes); }
