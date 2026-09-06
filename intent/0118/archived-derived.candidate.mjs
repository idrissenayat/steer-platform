// Offline retained facts only. Trusted archive setup is never installed by input.
import { Buffer } from 'node:buffer';
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects, TRUST_REGISTRY } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createDerivedDispositionVerifier, policyDigest as originalPolicy } from '../0117/derived-disposition.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const originalRegistry = parseCanonical(jcs(TRUST_REGISTRY));
export const policyDigest = sha256(jcs({ version: 'steer-archived-derived/v1', originalPolicy, timePolicyDigest, originalRegistryDigest: sha256(jcs(originalRegistry)),
  rules: 'trusted exact original context, observation, input bytes and immutable archive reference; full original child evidence revalidated; unchanged original anchors/windows; conservative all-original-anchor revocation denial; unique keys across roles/eras; fresh independent current revalidation and retained-byte witnesses; no parent completeness or current action authority' }));
const ensure = value => { if (!value) throw new Error('ARCHIVED_DERIVED_INVALID'); };
const time = value => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };
const bytes = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && Buffer.byteLength(v, 'utf8') <= max;
const text = v => bytes(v, 512) && v.trim() === v && !/[\u0000-\u001f*?]/u.test(v);
export function createArchivedDerivedVerifier(configBytes) {
  let config, original, historical, current, registry;
  try {
    ensure(bytes(configBytes, 524288)); config = parseCanonical(configBytes);
    ensure(exactKeys(config, ['version', 'originalContextBytes', 'originalBytesDigest', 'archiveReference', 'currentRegistryBytes']) && config.version === 'steer-archived-derived-context/v1' &&
      hex(config.originalBytesDigest, 64) && bytes(config.originalContextBytes, 131072) && bytes(config.currentRegistryBytes, 65536) &&
      exactKeys(config.archiveReference, ['repositoryId', 'revision', 'path']) && text(config.archiveReference.repositoryId) && hex(config.archiveReference.revision, 40) &&
      text(config.archiveReference.path) && !config.archiveReference.path.startsWith('/') && !config.archiveReference.path.includes('\\') &&
      config.archiveReference.path.split('/').every(part => !['', '.', '..'].includes(part)));
    original = createDerivedDispositionVerifier(config.originalContextBytes); historical = parseCanonical(config.originalContextBytes);
    current = createTimedRecordVerifier(config.currentRegistryBytes); registry = parseCanonical(config.currentRegistryBytes);
    ensure(new Set(registry.bindings.map(k => k.publicKeyHex)).size === registry.bindings.length);
    for (const old of originalRegistry.bindings) {
      const matches = registry.bindings.filter(k => k.domain === old.domain && k.keyId === old.keyId);
      ensure(matches.length === 1 && ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter'].every(field => matches[0][field] === old[field]));
      if (old.revokedAt !== null) ensure(matches[0].revokedAt !== null && time(matches[0].revokedAt) <= time(old.revokedAt));
    }
  } catch { throw new Error('ARCHIVED_DERIVED_CONFIGURATION_INVALID'); }
  const configDigest = sha256(configBytes), originalKeys = new Set(originalRegistry.bindings.map(k => sha256(k.publicKeyHex)));
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      const limits = { effects: zeroEffects(), executionAuthorized: false, deletionVerified: false, liveProviderUsed: false };
      try {
        const now = time(evaluationTime); ensure(time(historical.observedAt) <= now && bytes(serialized, 33554432));
        const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'originalBytes', 'attestationBytes', 'retentionReceiptBytes']) && input.version === 'steer-archived-derived/v1' &&
          input.policyDigest === policyDigest && bytes(input.originalBytes, 16777216) && sha256(input.originalBytes) === config.originalBytesDigest);
        // Conservative first profile: every original anchor must be unrevoked now,
        // including unused anchors. No fragile nested-record key discovery is used.
        for (const old of originalRegistry.bindings) {
          const currentKey = registry.bindings.find(k => k.domain === old.domain && k.keyId === old.keyId);
          ensure(currentKey.revokedAt === null || now < time(currentKey.revokedAt));
        }
        const fact = original.verify(input.originalBytes, historical.observedAt);
        ensure(fact.state === 'verified-derived-disposition-evidence' && fact.fullChildEvidenceVerified === true && fact.futureArchiveVerified === false &&
          fact.executionAuthorized === false && fact.deletionVerified === false && jcs(fact.effects) === jcs(zeroEffects()));
        const proof = (serializedRecord, domain, kind, extras) => {
          ensure(bytes(serializedRecord, 65536)); const raw = parseCanonical(serializedRecord);
          const verified = current.verifyBytes(serializedRecord, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }), record = verified.record;
          ensure(exactKeys(record, ['kind', 'source', 'configDigest', 'policyDigest', 'registryDigest', 'originalConfigDigest', 'originalBytesDigest', 'originalEvidenceDigest',
            'archiveReference', 'observedAt', 'childCount', 'copyCount', ...extras, 'recordedAt', 'validThrough', 'recordDigest', 'signature']) && record.kind === kind &&
            record.configDigest === configDigest && record.policyDigest === policyDigest && record.registryDigest === current.registryDigest &&
            record.originalConfigDigest === original.configDigest && record.originalBytesDigest === config.originalBytesDigest && record.originalEvidenceDigest === fact.evidenceDigest &&
            jcs(record.archiveReference) === jcs(config.archiveReference) && record.observedAt === historical.observedAt && record.childCount === fact.verifiedChildCount && record.copyCount === fact.verifiedCopyCount &&
            time(record.recordedAt) >= time(historical.observedAt) && now < time(record.validThrough) && now - time(record.recordedAt) <= 300000000000n &&
            time(record.validThrough) > time(record.recordedAt) && time(record.validThrough) - time(record.recordedAt) <= 300000000000n && !originalKeys.has(verified.anchorDigest));
          return { record, anchor: verified.anchorDigest };
        };
        const attested = proof(input.attestationBytes, 'authority', 'archived-derived-attestation', ['decision']);
        ensure(attested.record.source === 'authoritative-derived-history-revalidator' && attested.record.decision === 'original-derived-evidence-verified');
        const retained = proof(input.retentionReceiptBytes, 'provider', 'archived-derived-retention', ['attestationDigest', 'retainedBytesDigest', 'complete']);
        ensure(retained.record.source === 'authoritative-archive-store' && retained.record.attestationDigest === attested.record.recordDigest &&
          retained.record.retainedBytesDigest === config.originalBytesDigest && retained.record.complete === true && retained.anchor !== attested.anchor &&
          time(retained.record.recordedAt) >= time(attested.record.recordedAt) && time(retained.record.validThrough) <= time(attested.record.validThrough));
        return { state: 'verified-archived-derived-evidence', firstError: null, ...limits, factOnly: true, futureArchiveVerified: true, fullChildEvidenceVerified: true,
          currentActionAuthorityRequired: true, parentCompletenessVerified: false, configDigest, policyDigest, originalConfigDigest: original.configDigest,
          originalBytesDigest: config.originalBytesDigest, originalEvidenceDigest: fact.evidenceDigest, observedAt: historical.observedAt, evaluatedAt: evaluationTime,
          retainedAt: retained.record.recordedAt, verifiedChildCount: fact.verifiedChildCount, verifiedCopyCount: fact.verifiedCopyCount,
          attestationDigest: attested.record.recordDigest, retentionReceiptDigest: retained.record.recordDigest,
          inputDigest: sha256(jcs({ bytes: serialized, evaluatedAt: evaluationTime })), requires: ['verified-parent-manifest-and-history', 'complete-current-parent-disposition-authority'] };
      } catch { return { state: 'blocked', firstError: 'ARCHIVED_DERIVED_INVALID', ...limits, futureArchiveVerified: false, fullChildEvidenceVerified: false, parentCompletenessVerified: false }; }
    } });
}
