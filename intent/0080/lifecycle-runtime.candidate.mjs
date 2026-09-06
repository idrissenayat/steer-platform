// Trusted offline composition configuration, never an agent/request input.
import { readFileSync } from 'node:fs';
import { exactKeys, jcs, parseCanonical, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createHumanAuthorityVerifier, correctionPolicyDigest as originalHumanPolicy } from '../0058/human-authority.candidate.mjs';
import { createHistoricalEventVerifier, policyDigest as historyPolicy } from '../0078/historical-events.candidate.mjs';
const originalProviders = JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/PROVIDER-KEY-REGISTRY.candidate.json', import.meta.url), 'utf8'));
const supportedClasses = Object.freeze(['RC-SECURITY-AUDIT', 'RC-CORPUS-BASELINE', 'RC-DECISION-PROOF', 'RC-LEGAL-SIGNED-LOG']);
export const policyDigest = sha256(jcs({ version: 'steer-lifecycle-runtime/v1', originalHumanPolicy, historyPolicy,
  supportedClasses, originalProvidersDigest: sha256(jcs(originalProviders)), rules: 'trusted complete current registries and exact archive context; archive retained before state; stable provider identities and exact selected signing keys; no unsupported release; explicit future graph policy; original raw contract unchanged; full current human/action/receipt checks, no execution' }));
const ensure = (value) => { if (!value) throw new Error('LIFECYCLE_RUNTIME_CONFIGURATION_INVALID'); };
export function createLifecycleRuntime(serialized) {
  try {
    ensure(typeof serialized === 'string' && serialized.length <= 262144);
    const config = parseCanonical(serialized);
    ensure(exactKeys(config, ['version', 'currentRegistryBytes', 'currentProviderRegistryBytes', 'historicalContextBytes']) && config.version === 'steer-lifecycle-runtime/v1' &&
      typeof config.currentProviderRegistryBytes === 'string' && config.currentProviderRegistryBytes.length <= 65536);
    const human = createHumanAuthorityVerifier(config.currentRegistryBytes), history = createHistoricalEventVerifier(config.historicalContextBytes);
    const historicalContext = parseCanonical(config.historicalContextBytes);
    ensure(historicalContext.currentRegistryBytes === config.currentRegistryBytes);
    const registry = parseCanonical(config.currentRegistryBytes), providers = parseCanonical(config.currentProviderRegistryBytes);
    ensure(exactKeys(providers, ['version', 'bindings']) && providers.version === originalProviders.version && Array.isArray(providers.bindings) && providers.bindings.length === originalProviders.bindings.length);
    const seen = new Set();
    for (const binding of providers.bindings) {
      const old = originalProviders.bindings.find((entry) => entry.providerBindingId === binding.providerBindingId);
      ensure(old && !seen.has(binding.providerBindingId) && exactKeys(binding, Object.keys(old))); seen.add(binding.providerBindingId);
      ensure(['providerBindingId', 'domain', 'provider', 'account', 'tenant', 'proofType', 'proofIssuer'].every((field) => binding[field] === old[field]));
      const key = registry.bindings.find((entry) => entry.domain === binding.domain && entry.keyId === binding.keyId);
      ensure(key && ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter', 'revokedAt'].every((field) => binding[field] === key[field]));
    }
    return Object.freeze({ configDigest: sha256(serialized), policyDigest, registryBytes: config.currentRegistryBytes, providerBytes: config.currentProviderRegistryBytes,
      registry, providers: providers.bindings, historicalContext, history, human, supportedClasses });
  } catch { throw new Error('LIFECYCLE_RUNTIME_CONFIGURATION_INVALID'); }
}
