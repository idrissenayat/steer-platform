// Narrow trusted entry point; no caller-selected legacy profile fallback.
import { parseCanonical } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createCurrentLifecycleGraphVerifier } from '../0061/lifecycle-graph.candidate.mjs';
export function createReferenceLifecycleVerifier(configBytes, trustedRuntimeBytes) {
  try {
    if (typeof trustedRuntimeBytes !== 'string' || trustedRuntimeBytes.length > 262144 || parseCanonical(trustedRuntimeBytes).version !== 'steer-lifecycle-runtime/v5')
      throw new Error('REFERENCE_LIFECYCLE_CONFIGURATION_INVALID');
    return createCurrentLifecycleGraphVerifier(configBytes, trustedRuntimeBytes);
  } catch { throw new Error('REFERENCE_LIFECYCLE_CONFIGURATION_INVALID'); }
}
