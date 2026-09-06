// Trusted offline composition configuration, never an agent/request input.
import { readFileSync } from 'node:fs';
import { exactKeys, jcs, parseCanonical, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createHumanAuthorityVerifier, correctionPolicyDigest as originalHumanPolicy } from '../0058/human-authority.candidate.mjs';
import { createHistoricalEventVerifier, policyDigest as historyPolicy } from '../0078/historical-events.candidate.mjs';
import { createMixedHistoryVerifier, policyDigest as mixedHistoryPolicy } from '../0081/mixed-history.candidate.mjs';
import { createQualifiedHistoryVerifier, policyDigest as qualifiedHistoryPolicy, archivalPolicyDigest as archivalHistoryPolicy } from '../0083/qualified-history.candidate.mjs';
import { createReferenceRevocationVerifier, policyDigest as referenceRevocationPolicy } from '../0087/reference-revocation.candidate.mjs';
import { manifestDigest as referenceActionManifestDigest } from '../0088/reference-actions.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
const originalProviders = JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/PROVIDER-KEY-REGISTRY.candidate.json', import.meta.url), 'utf8'));
const supportedClasses = Object.freeze(['RC-SECURITY-AUDIT', 'RC-CORPUS-BASELINE', 'RC-DECISION-PROOF', 'RC-LEGAL-SIGNED-LOG']);
export const policyDigest = sha256(jcs({ version: 'steer-lifecycle-runtime/v1', originalHumanPolicy, historyPolicy,
  supportedClasses, originalProvidersDigest: sha256(jcs(originalProviders)), rules: 'trusted complete current registries and exact archive context; archive retained before state; stable provider identities and exact selected signing keys; no unsupported release; explicit future graph policy; original raw contract unchanged; full current human/action/receipt checks, no execution' }));
const ensure = (value) => { if (!value) throw new Error('LIFECYCLE_RUNTIME_CONFIGURATION_INVALID'); };
export const mixedPolicyDigest = sha256(jcs({ version: 'steer-lifecycle-runtime/v2', originalRuntimePolicyDigest: policyDigest, mixedHistoryPolicy,
  keySeparation: 'all public keys unique across original and current bindings; no role aliases or old-material relabeling' }));
export const qualifiedPolicyDigest = sha256(jcs({ version: 'steer-lifecycle-runtime/v3', mixedPolicyDigest, qualifiedHistoryPolicy }));
export const archivalPolicyDigest = sha256(jcs({ version: 'steer-lifecycle-runtime/v4', qualifiedPolicyDigest, archivalHistoryPolicy }));
export const referencePolicyDigest = sha256(jcs({ version: 'steer-lifecycle-runtime/v5', archivalPolicyDigest, referenceRevocationPolicy, referenceActionManifestDigest,
  recordClass: 'RC-REFERENCED-EVIDENCE', rules: 'full qualified revocation and removal; exact history/current state and version/copy hashes; named tombstone and full separate shared actions; no execution' }));
export const releasePolicyDigest = sha256(jcs({ version: 'steer-lifecycle-runtime/v6', archivalPolicyDigest,
  recordClass: 'RC-RELEASE-MIGRATION', rules: 'exact trusted retirement selector; non-null environment; one archived provider-bound release-rails commit with traffic disabled and credentials revoked; original history and fresh qualified archive/current proof stack; no actual retirement, deletion or execution' }));
export function createLifecycleRuntime(serialized) {
  try {
    ensure(typeof serialized === 'string' && serialized.length <= 262144);
    const config = parseCanonical(serialized);
    const reference = config.version === 'steer-lifecycle-runtime/v5', release = config.version === 'steer-lifecycle-runtime/v6', archival = reference || release || config.version === 'steer-lifecycle-runtime/v4';
    ensure(exactKeys(config, ['version', 'currentRegistryBytes', 'currentProviderRegistryBytes', 'historicalContextBytes', ...(archival ? ['archivedOwnerContextBytes'] : []), ...(reference ? ['referenceContextBytes'] : []), ...(release ? ['retirementContextBytes'] : [])]) && ['steer-lifecycle-runtime/v1', 'steer-lifecycle-runtime/v2', 'steer-lifecycle-runtime/v3', 'steer-lifecycle-runtime/v4', 'steer-lifecycle-runtime/v5', 'steer-lifecycle-runtime/v6'].includes(config.version) &&
      typeof config.currentProviderRegistryBytes === 'string' && config.currentProviderRegistryBytes.length <= 65536);
    const qualified = archival || config.version === 'steer-lifecycle-runtime/v3', mixed = qualified || config.version === 'steer-lifecycle-runtime/v2';
    const human = createHumanAuthorityVerifier(config.currentRegistryBytes), history = qualified ? createQualifiedHistoryVerifier(config.historicalContextBytes, archival ? config.archivedOwnerContextBytes : undefined) :
      mixed ? createMixedHistoryVerifier(config.historicalContextBytes) : createHistoricalEventVerifier(config.historicalContextBytes);
    const historicalContext = parseCanonical(config.historicalContextBytes);
    ensure(historicalContext.currentRegistryBytes === config.currentRegistryBytes);
    let retirementContext;
    if (release) {
      ensure(typeof config.retirementContextBytes === 'string' && config.retirementContextBytes.length <= 16384);
      retirementContext = parseCanonical(config.retirementContextBytes);
      ensure(exactKeys(retirementContext, ['version', 'environmentId', 'recordId', 'artifactRevision', 'retirementEventId', 'releaseRailsRecordId', 'providerRecordId', 'retiredAt', 'actorId']) &&
        retirementContext.version === 'steer-release-retirement-context/v1' && historicalContext.recordClass === 'RC-RELEASE-MIGRATION' &&
        Object.values(retirementContext).every(v => typeof v === 'string' && v.length > 0 && v.length <= 512 && v.trim() === v && !/[\u0000-\u001f*?]/u.test(v)) &&
        retirementContext.environmentId === historicalContext.scope.environmentId && retirementContext.recordId === historicalContext.recordId && retirementContext.artifactRevision === historicalContext.artifactRevision &&
        /^[0-9a-f]{40}$/.test(retirementContext.artifactRevision) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(retirementContext.retirementEventId) &&
        exactInstant(retirementContext.retiredAt) !== null && exactInstant(retirementContext.retiredAt) <= exactInstant(historicalContext.observedAt));
    }
    const referenceVerifier = reference ? createReferenceRevocationVerifier(config.referenceContextBytes) : null;
    const referenceContext = reference ? parseCanonical(config.referenceContextBytes) : null;
    const referenceContentContext = reference ? parseCanonical(referenceContext.contentContextBytes) : null;
    if (reference) ensure(referenceContentContext.currentRegistryBytes === config.currentRegistryBytes);
    const registry = parseCanonical(config.currentRegistryBytes), providers = parseCanonical(config.currentProviderRegistryBytes);
    if (mixed) ensure(new Set(registry.bindings.map((key) => key.publicKeyHex)).size === registry.bindings.length);
    ensure(exactKeys(providers, ['version', 'bindings']) && providers.version === originalProviders.version && Array.isArray(providers.bindings) && providers.bindings.length === originalProviders.bindings.length);
    const seen = new Set();
    for (const binding of providers.bindings) {
      const old = originalProviders.bindings.find((entry) => entry.providerBindingId === binding.providerBindingId);
      ensure(old && !seen.has(binding.providerBindingId) && exactKeys(binding, Object.keys(old))); seen.add(binding.providerBindingId);
      ensure(['providerBindingId', 'domain', 'provider', 'account', 'tenant', 'proofType', 'proofIssuer'].every((field) => binding[field] === old[field]));
      const key = registry.bindings.find((entry) => entry.domain === binding.domain && entry.keyId === binding.keyId);
      ensure(key && ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter', 'revokedAt'].every((field) => binding[field] === key[field]));
    }
    return Object.freeze({ configDigest: sha256(serialized), policyDigest: release ? releasePolicyDigest : reference ? referencePolicyDigest : archival ? archivalPolicyDigest : qualified ? qualifiedPolicyDigest : mixed ? mixedPolicyDigest : policyDigest,
      ...(release ? { release, retirementContext, retirementContextDigest: sha256(config.retirementContextBytes) } : {}),
      mixed, qualified, archival, reference, referenceVerifier, referenceContext, referenceContentContext, registryBytes: config.currentRegistryBytes, providerBytes: config.currentProviderRegistryBytes,
      registry, providers: providers.bindings, historicalContext, history, human, supportedClasses: release ? ['RC-RELEASE-MIGRATION'] : reference ? ['RC-REFERENCED-EVIDENCE'] : supportedClasses });
  } catch { throw new Error('LIFECYCLE_RUNTIME_CONFIGURATION_INVALID'); }
}
