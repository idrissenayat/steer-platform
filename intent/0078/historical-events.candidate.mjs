// Historical facts only; never credentials, action permission or archival key renewal.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects, RETENTION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { correctedLifecycleEventDecision, correctionPolicyDigest as eventPolicy } from '../0059/lifecycle-events.candidate.mjs';
import { exactInstant, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const originalRegistryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const originalRegistry = parseCanonical(originalRegistryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-historical-events/v1', eventPolicy, timePolicyDigest, originalRegistryDigest: sha256(originalRegistryBytes),
  rules: 'trusted exact archive reference/history/as-of and current registry; original complete event proof at as-of; unchanged historical key material/windows; known current revocation denies; fresh independent archive attestation and retained-byte receipt; facts only, never action authority' }));
const ensure = (value) => { if (!value) throw new Error('HISTORICAL_EVENTS_INVALID'); };
const time = (value) => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };
const bytes = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const text = (value) => bytes(value, 512) && !/[\u0000-\u001f*?]/u.test(value);

export function createHistoricalEventVerifier(configBytes) {
  let config, current, registry;
  try {
    ensure(bytes(configBytes, 131072)); config = parseCanonical(configBytes);
    ensure(exactKeys(config, ['version', 'scope', 'recordId', 'recordClass', 'artifactRevision', 'archiveReference', 'historyDigest', 'observedAt', 'currentRegistryBytes']) &&
      config.version === 'steer-historical-event-context/v1' && exactKeys(config.scope, ['organization', 'itemId', 'environmentId']) &&
      text(config.scope.organization) && text(config.scope.itemId) && (config.scope.environmentId === null || text(config.scope.environmentId)) &&
      text(config.recordId) && text(config.recordClass) && hex(config.artifactRevision, 40) && hex(config.historyDigest, 64) &&
      exactKeys(config.archiveReference, ['repositoryId', 'revision', 'path']) && text(config.archiveReference.repositoryId) &&
      hex(config.archiveReference.revision, 40) && text(config.archiveReference.path) && !config.archiveReference.path.startsWith('/') &&
      config.archiveReference.path.split('/').every((part) => !['', '.', '..'].includes(part)) && bytes(config.currentRegistryBytes, 65536));
    time(config.observedAt); current = createTimedRecordVerifier(config.currentRegistryBytes); registry = parseCanonical(config.currentRegistryBytes);
    // A current registry may add successor keys or revoke old keys. It cannot
    // quietly replace, omit or lengthen a historical anchor to make history pass.
    for (const original of originalRegistry.bindings) {
      const matches = registry.bindings.filter((key) => key.domain === original.domain && key.keyId === original.keyId);
      ensure(matches.length === 1 && ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter'].every((field) => matches[0][field] === original[field]));
      if (original.revokedAt !== null) ensure(matches[0].revokedAt !== null && time(matches[0].revokedAt) <= time(original.revokedAt));
    }
  } catch { throw new Error('HISTORICAL_EVENT_CONFIGURATION_INVALID'); }
  const configDigest = sha256(configBytes);
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      const blocked = () => ({ state: 'blocked', firstError: 'HISTORICAL_EVENTS_INVALID', effects: zeroEffects(), executionAuthorized: false });
      try {
        const now = time(evaluationTime); ensure(time(config.observedAt) <= now && bytes(serialized, 12582912));
        const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'eventBytes', 'historyBytes', 'attestationBytes', 'retentionReceiptBytes']) &&
          input.version === 'steer-historical-events/v1' && input.policyDigest === policyDigest);
        const original = correctedLifecycleEventDecision(jcs({ version: 'steer-r5-001-events/v1', policyDigest: eventPolicy,
          scope: config.scope, eventBytes: input.eventBytes, historyBytes: input.historyBytes, evaluationTime: config.observedAt }));
        ensure(original.state === 'validated-trigger');
        const allBytes = [...input.historyBytes, input.eventBytes]; ensure(sha256(jcs(allBytes)) === config.historyDigest);
        const inventory = [], historicKeys = new Set();
        for (const serializedEvent of allBytes) {
          const event = parseCanonical(serializedEvent), provider = parseCanonical(event.providerProofBytes);
          ensure(event.recordId === config.recordId && event.recordClass === config.recordClass && event.artifactRevision === config.artifactRevision && event.policySha256 === RETENTION_POLICY_SHA);
          for (const [recordBytes, record, domain, at] of [[serializedEvent, event, 'record', event.occurredAt], [event.providerProofBytes, provider, 'provider', provider.recordedAt]]) {
            const key = registry.bindings.find((key) => key.domain === domain && key.keyId === record.signature.keyId);
            ensure(key && (key.revokedAt === null || now < time(key.revokedAt)));
            const verified = current.verifyBytes(recordBytes, { domain, recordedAt: at, evaluatedAt: config.observedAt });
            historicKeys.add(verified.anchorDigest);
          }
          inventory.push({ eventId: event.eventId, bytesDigest: sha256(serializedEvent), recordDigest: event.recordDigest,
            providerBytesDigest: sha256(event.providerProofBytes), providerDigest: provider.recordDigest, occurredAt: event.occurredAt });
        }
        const inventoryDigest = sha256(jcs(inventory));
        const proof = (serializedRecord, domain, kind, extraFields) => {
          ensure(bytes(serializedRecord, 65536)); const raw = parseCanonical(serializedRecord);
          const verified = current.verifyBytes(serializedRecord, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }), record = verified.record;
          ensure(exactKeys(record, ['kind', 'source', 'configDigest', 'policyDigest', 'registryDigest', 'historyDigest', 'inventoryDigest', 'archiveReference',
            'observedAt', 'recordCount', ...extraFields, 'recordedAt', 'validThrough', 'recordDigest', 'signature']) && record.kind === kind &&
            record.configDigest === configDigest && record.policyDigest === policyDigest && record.registryDigest === current.registryDigest &&
            record.historyDigest === config.historyDigest && record.inventoryDigest === inventoryDigest && jcs(record.archiveReference) === jcs(config.archiveReference) &&
            record.observedAt === config.observedAt && record.recordCount === allBytes.length && time(record.recordedAt) >= time(config.observedAt) &&
            now < time(record.validThrough) && now - time(record.recordedAt) <= 300000000000n &&
            time(record.validThrough) > time(record.recordedAt) && time(record.validThrough) - time(record.recordedAt) <= 300000000000n &&
            !historicKeys.has(verified.anchorDigest));
          return { record, anchor: verified.anchorDigest };
        };
        const attested = proof(input.attestationBytes, 'authority', 'historical-event-attestation', ['decision']);
        ensure(attested.record.source === 'authoritative-history-revalidator' && attested.record.decision === 'historical-facts-verified');
        const retained = proof(input.retentionReceiptBytes, 'provider', 'historical-event-retention', ['attestationDigest', 'retainedBytesDigest', 'complete']);
        ensure(retained.record.source === 'authoritative-archive-store' && retained.record.attestationDigest === attested.record.recordDigest &&
          retained.record.retainedBytesDigest === config.historyDigest && retained.record.complete === true && retained.anchor !== attested.anchor &&
          time(retained.record.recordedAt) >= time(attested.record.recordedAt) && time(retained.record.validThrough) <= time(attested.record.validThrough));
        return { state: 'verified-historical-events', factOnly: true, currentActionAuthorityRequired: true, configDigest, policyDigest,
          historyDigest: config.historyDigest, inventoryDigest, verifiedEventCount: allBytes.length, observedAt: config.observedAt, evaluatedAt: evaluationTime,
          attestationDigest: attested.record.recordDigest, retentionReceiptDigest: retained.record.recordDigest,
          effects: zeroEffects(), executionAuthorized: false };
      } catch { return blocked(); }
    },
  });
}
