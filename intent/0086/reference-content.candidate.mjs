// Retained reference verification content only; not revocation or erasure authority.
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createHumanAuthorityVerifier } from '../0058/human-authority.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
export const policyDigest = sha256(jcs({ version: 'steer-reference-content/v1',
  rules: 'trusted exact target and content pins; closed sorted complete version/reference manifest; one verification record per exact reference; fresh independent inventory verification and retention attestations; content only, no revocation or erasure' }));
const ensure = (value) => { if (!value) throw new Error('REFERENCE_CONTENT_INVALID'); };
const time = (value) => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };
const bytes = (value, maximum) => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= maximum;
const text = (value) => bytes(value, 512) && !/[\u0000-\u001f*?]/u.test(value);
const path = (value) => text(value) && !value.startsWith('/') && value.split('/').every((part) => !['', '.', '..'].includes(part));
const ordered = (rows, field) => rows.every((row, index) => text(row[field]) && (index === 0 || rows[index - 1][field] < row[field]));
const referenceFields = ['referenceId', 'sourceRepositoryId', 'sourceRevision', 'sourcePath', 'targetRecordId', 'targetArtifactRevision', 'targetVersionId', 'targetSha256'];

export function createReferenceContentVerifier(trustedContextBytes) {
  let context, current;
  try {
    ensure(bytes(trustedContextBytes, 131072)); context = parseCanonical(trustedContextBytes);
    ensure(exactKeys(context, ['version', 'organization', 'itemId', 'recordId', 'artifactRevision', 'repositoryId', 'referenceManifestDigest',
      'verificationBundleDigest', 'verificationArchive', 'currentRegistryBytes']) && context.version === 'steer-reference-content-context/v1' &&
      ['organization', 'itemId', 'recordId', 'repositoryId'].every((field) => text(context[field])) && hex(context.artifactRevision, 40) &&
      hex(context.referenceManifestDigest, 64) && hex(context.verificationBundleDigest, 64) &&
      exactKeys(context.verificationArchive, ['repositoryId', 'revision', 'path']) && context.verificationArchive.repositoryId === context.repositoryId &&
      hex(context.verificationArchive.revision, 40) && path(context.verificationArchive.path));
    // Shared trusted-registry selection preserves old keys and denies aliases.
    createHumanAuthorityVerifier(context.currentRegistryBytes, 'qualified-reference'); current = createTimedRecordVerifier(context.currentRegistryBytes);
  } catch { throw new Error('REFERENCE_CONTENT_CONFIGURATION_INVALID'); }
  const configDigest = sha256(trustedContextBytes);
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      try {
        const now = time(evaluationTime); ensure(bytes(serialized, 4194304)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'referenceManifestBytes', 'verificationBundleBytes', 'inventoryAttestationBytes',
          'verificationAttestationBytes', 'retentionReceiptBytes']) && input.version === 'steer-reference-content/v1' && input.policyDigest === policyDigest &&
          bytes(input.referenceManifestBytes, 262144) && bytes(input.verificationBundleBytes, 2097152) &&
          sha256(input.referenceManifestBytes) === context.referenceManifestDigest && sha256(input.verificationBundleBytes) === context.verificationBundleDigest);
        const manifest = parseCanonical(input.referenceManifestBytes), bundle = parseCanonical(input.verificationBundleBytes);
        ensure(exactKeys(manifest, ['version', 'organization', 'itemId', 'recordId', 'artifactRevision', 'versions', 'references']) &&
          manifest.version === 'steer-reference-inventory/v1' && ['organization', 'itemId', 'recordId', 'artifactRevision'].every((field) => manifest[field] === context[field]) &&
          Array.isArray(manifest.versions) && manifest.versions.length > 0 && manifest.versions.length <= 128 && ordered(manifest.versions, 'versionId') &&
          Array.isArray(manifest.references) && manifest.references.length > 0 && manifest.references.length <= 128 && ordered(manifest.references, 'referenceId'));
        for (const version of manifest.versions) ensure(exactKeys(version, ['versionId', 'objectSha256']) && hex(version.objectSha256, 64));
        const physical = new Set();
        for (const reference of manifest.references) {
          ensure(exactKeys(reference, referenceFields) && reference.sourceRepositoryId === context.repositoryId && hex(reference.sourceRevision, 40) && path(reference.sourcePath) &&
            reference.targetRecordId === context.recordId && reference.targetArtifactRevision === context.artifactRevision &&
            manifest.versions.some((version) => version.versionId === reference.targetVersionId && version.objectSha256 === reference.targetSha256));
          const identity = jcs(referenceFields.filter((field) => field !== 'referenceId').map((field) => reference[field]));
          ensure(!physical.has(identity)); physical.add(identity);
        }
        ensure(exactKeys(bundle, ['version', 'referenceInventorySha256', 'records']) && bundle.version === 'steer-reference-verification-bundle/v1' &&
          bundle.referenceInventorySha256 === context.referenceManifestDigest && Array.isArray(bundle.records) && bundle.records.length === manifest.references.length);
        const derived = [];
        for (let index = 0; index < manifest.references.length; index++) {
          const reference = manifest.references[index], row = bundle.records[index];
          ensure(exactKeys(row, ['referenceId', 'verificationBytes']) && row.referenceId === reference.referenceId && bytes(row.verificationBytes, 8192));
          const verified = parseCanonical(row.verificationBytes);
          // The record preserves the exact SHA-256 relationship. A separately
          // signed verification-source attestation binds its actual observation.
          ensure(exactKeys(verified, ['version', 'referenceId', 'referenceSha256', 'method', 'targetVersionId', 'targetSha256']) &&
            verified.version === 'steer-reference-verification/v1' && verified.method === 'sha256-reference-binding' && verified.referenceId === reference.referenceId &&
            verified.referenceSha256 === sha256(jcs(reference)) && verified.targetVersionId === reference.targetVersionId && verified.targetSha256 === reference.targetSha256);
          derived.push({ referenceId: reference.referenceId, referenceSha256: verified.referenceSha256, verificationBytesDigest: sha256(row.verificationBytes) });
        }
        const verificationInventoryDigest = sha256(jcs(derived));
        const proof = (serializedRecord, domain, kind, extras) => {
          ensure(bytes(serializedRecord, 65536)); const raw = parseCanonical(serializedRecord);
          const verified = current.verifyBytes(serializedRecord, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }), record = verified.record;
          ensure(exactKeys(record, ['kind', 'source', 'configDigest', 'policyDigest', 'registryDigest', 'referenceManifestDigest', 'verificationBundleDigest',
            'verificationInventoryDigest', 'versionCount', 'referenceCount', ...extras, 'recordedAt', 'validThrough', 'recordDigest', 'signature']) &&
            record.kind === kind && record.configDigest === configDigest && record.policyDigest === policyDigest && record.registryDigest === current.registryDigest &&
            record.referenceManifestDigest === context.referenceManifestDigest && record.verificationBundleDigest === context.verificationBundleDigest &&
            record.verificationInventoryDigest === verificationInventoryDigest && record.versionCount === manifest.versions.length && record.referenceCount === manifest.references.length &&
            now < time(record.validThrough) && now - time(record.recordedAt) <= 300000000000n && time(record.validThrough) > time(record.recordedAt) &&
            time(record.validThrough) - time(record.recordedAt) <= 300000000000n);
          return { record, anchor: verified.anchorDigest };
        };
        const inventory = proof(input.inventoryAttestationBytes, 'provider', 'reference-inventory-attestation', ['completeVersions', 'completeReferences']);
        ensure(inventory.record.source === 'authoritative-reference-inventory' && inventory.record.completeVersions === true && inventory.record.completeReferences === true);
        const verified = proof(input.verificationAttestationBytes, 'record', 'reference-verification-attestation', ['inventoryAttestationDigest', 'result']);
        ensure(verified.record.source === 'authoritative-reference-verifier' && verified.record.result === 'verified' && verified.record.inventoryAttestationDigest === inventory.record.recordDigest &&
          time(verified.record.recordedAt) >= time(inventory.record.recordedAt) && time(verified.record.validThrough) <= time(inventory.record.validThrough));
        const retained = proof(input.retentionReceiptBytes, 'authority', 'reference-verification-retention', ['verificationAttestationDigest', 'archiveReference', 'retainedBytesDigest', 'complete']);
        ensure(retained.record.source === 'authoritative-verification-archive' && retained.record.verificationAttestationDigest === verified.record.recordDigest &&
          jcs(retained.record.archiveReference) === jcs(context.verificationArchive) && retained.record.retainedBytesDigest === context.verificationBundleDigest && retained.record.complete === true &&
          time(retained.record.recordedAt) >= time(verified.record.recordedAt) && time(retained.record.validThrough) <= time(verified.record.validThrough) &&
          new Set([inventory.anchor, verified.anchor, retained.anchor]).size === 3);
        return { state: 'verified-reference-content', configDigest, policyDigest, referenceManifestDigest: context.referenceManifestDigest,
          verificationBundleDigest: context.verificationBundleDigest, verificationInventoryDigest, referenceCount: manifest.references.length,
          versionCount: manifest.versions.length, inventoryAt: inventory.record.recordedAt, verifiedAt: verified.record.recordedAt, retainedAt: retained.record.recordedAt,
          validThrough: retained.record.validThrough, factOnly: true, qualifiedRevocationRequired: true, currentActionAuthorityRequired: true,
          executionAuthorized: false, effects: zeroEffects() };
      } catch { return { state: 'blocked', firstError: 'REFERENCE_CONTENT_INVALID', executionAuthorized: false, effects: zeroEffects() }; }
    },
  });
}
