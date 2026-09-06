// Archived owner records are facts, never revived current authority or effects.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createHumanAuthorityVerifier } from '../0058/human-authority.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { createHistoricalEventVerifier, policyDigest as historyPolicy } from '../0078/historical-events.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
const originalRegistryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const originalHuman = createHumanAuthorityVerifier(originalRegistryBytes, 'qualified-event');
export const policyDigest = sha256(jcs({ version: 'steer-archived-owner/v1', historyPolicy, originalHumanPolicy: originalHuman.policyDigest,
  rules: 'exact trusted decision archive pin; all original owner records verified at each retained original decision observation, after its event and before archive observation; all known key revocations deny now; complete ordered hold record mapping; independent fresh retained-byte attestation; no current permission' }));
const ensure = (value) => { if (!value) throw new Error('ARCHIVED_OWNER_INVALID'); };
const time = (value) => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };
const bytes = (value, maximum) => typeof value === 'string' && value.length > 0 && value.length <= maximum;
const fields = [['authorityBytes', 'authority', 'decidedAt'], ['providerProofBytes', 'human-provider', 'recordedAt'],
  ['identityEvidenceBytes', 'provider', 'verifiedAt'], ['qualificationEvidenceBytes', 'provider', null], ['assignmentEvidenceBytes', 'assignment', null],
  ['inventoryBytes', 'record', 'capturedAt'], ['replayLedgerBytes', 'replay-authority', 'snapshotAt'], ['casHeadBytes', 'cas-authority', 'snapshotAt'],
  ['casReservationBytes', 'cas-authority', 'recordedAt']];

export function createArchivedOwnerVerifier(trustedHistoricalContextBytes, trustedOwnerContextBytes) {
  let history, historical, config, current, registry;
  try {
    history = createHistoricalEventVerifier(trustedHistoricalContextBytes); historical = parseCanonical(trustedHistoricalContextBytes);
    ensure(bytes(trustedOwnerContextBytes, 16384)); config = parseCanonical(trustedOwnerContextBytes);
    ensure(exactKeys(config, ['version', 'historicalContextDigest', 'decisionBytesDigest', 'archiveReference']) && config.version === 'steer-archived-owner-context/v1' &&
      config.historicalContextDigest === sha256(trustedHistoricalContextBytes) && hex(config.decisionBytesDigest, 64) &&
      exactKeys(config.archiveReference, ['repositoryId', 'revision', 'path']) &&
      config.archiveReference.repositoryId === historical.archiveReference.repositoryId && config.archiveReference.revision === historical.archiveReference.revision &&
      bytes(config.archiveReference.path, 512) && !/[\u0000-\u001f*?]/u.test(config.archiveReference.path) && !config.archiveReference.path.startsWith('/') &&
      config.archiveReference.path.split('/').every((part) => !['', '.', '..'].includes(part)));
    // Preserve every original anchor and require current role/key independence.
    createHumanAuthorityVerifier(historical.currentRegistryBytes, 'qualified-event');
    current = createTimedRecordVerifier(historical.currentRegistryBytes); registry = parseCanonical(historical.currentRegistryBytes);
  } catch { throw new Error('ARCHIVED_OWNER_CONFIGURATION_INVALID'); }
  const configDigest = sha256(trustedOwnerContextBytes);
  return Object.freeze({ policyDigest, configDigest,
    verify(serialized, evaluationTime) {
      try {
        const now = time(evaluationTime); ensure(bytes(serialized, 16777216)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'archivedEvidenceBytes', 'decisionBytes', 'attestationBytes', 'retentionReceiptBytes']) &&
          input.version === 'steer-archived-owner/v1' && input.policyDigest === policyDigest && bytes(input.decisionBytes, 12582912) &&
          sha256(input.decisionBytes) === config.decisionBytesDigest);
        ensure(history.verify(input.archivedEvidenceBytes, evaluationTime).state === 'verified-historical-events');
        const archive = parseCanonical(input.archivedEvidenceBytes), events = [...archive.historyBytes, archive.eventBytes].map(parseCanonical);
        const holdEvents = events.filter((event) => ['hold-applied', 'hold-released'].includes(event.eventType));
        const decisions = parseCanonical(input.decisionBytes); ensure(Array.isArray(decisions) && decisions.length <= 128 && decisions.length === holdEvents.length);
        const historicKeys = new Set(), inventory = [];
        // Current archive witnesses cannot reuse any historical event key either.
        for (const event of events) for (const [record, domain] of [[event, 'record'], [parseCanonical(event.providerProofBytes), 'provider']]) {
          const key = registry.bindings.find((key) => key.domain === domain && key.keyId === record.signature.keyId); ensure(key); historicKeys.add(sha256(key.publicKeyHex));
        }
        for (let index = 0; index < decisions.length; index++) {
          const entry = decisions[index], event = holdEvents[index];
          ensure(exactKeys(entry, ['eventId', 'humanBundleBytes']) && entry.eventId === event.eventId && bytes(entry.humanBundleBytes, 1048576));
          const bundle = parseCanonical(entry.humanBundleBytes), authority = parseCanonical(bundle.authorityBytes), records = [];
          ensure(time(event.occurredAt) <= time(bundle.evaluationTime) && time(bundle.evaluationTime) <= time(historical.observedAt));
          ensure(originalHuman.verify(jcs({ version: originalHuman.envelopeVersion, policyDigest: originalHuman.policyDigest,
            bundleBytes: entry.humanBundleBytes }), bundle.evaluationTime).decision === 'ALLOW');
          for (const [field, domain, nativeField] of fields) {
            const record = parseCanonical(bundle[field]), key = registry.bindings.find((key) => key.domain === domain && key.keyId === record.signature.keyId);
            ensure(key && (key.revokedAt === null || now < time(key.revokedAt)));
            const verified = current.verifyBytes(bundle[field], { domain, recordedAt: nativeField ? record[nativeField] : authority.decidedAt, evaluatedAt: bundle.evaluationTime });
            historicKeys.add(verified.anchorDigest); records.push({ field, recordDigest: record.recordDigest, bytesDigest: sha256(bundle[field]) });
          }
          inventory.push({ eventId: event.eventId, eventDigest: event.recordDigest, observedAt: bundle.evaluationTime, bundleBytesDigest: sha256(entry.humanBundleBytes), records });
        }
        const inventoryDigest = sha256(jcs(inventory));
        const proof = (serializedRecord, domain, kind, extras) => {
          ensure(bytes(serializedRecord, 65536)); const raw = parseCanonical(serializedRecord);
          const verified = current.verifyBytes(serializedRecord, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }), record = verified.record;
          ensure(exactKeys(record, ['kind', 'source', 'configDigest', 'policyDigest', 'registryDigest', 'historyDigest', 'decisionBytesDigest', 'inventoryDigest',
            'archiveReference', 'observedAt', 'decisionCount', ...extras, 'recordedAt', 'validThrough', 'recordDigest', 'signature']) && record.kind === kind &&
            record.configDigest === configDigest && record.policyDigest === policyDigest && record.registryDigest === current.registryDigest &&
            record.historyDigest === historical.historyDigest && record.decisionBytesDigest === config.decisionBytesDigest && record.inventoryDigest === inventoryDigest &&
            jcs(record.archiveReference) === jcs(config.archiveReference) && record.observedAt === historical.observedAt && record.decisionCount === decisions.length &&
            time(record.recordedAt) >= time(historical.observedAt) && now < time(record.validThrough) && now - time(record.recordedAt) <= 300000000000n &&
            time(record.validThrough) > time(record.recordedAt) && time(record.validThrough) - time(record.recordedAt) <= 300000000000n && !historicKeys.has(verified.anchorDigest));
          return { record, anchor: verified.anchorDigest };
        };
        const attested = proof(input.attestationBytes, 'authority', 'archived-owner-attestation', ['decision']);
        ensure(attested.record.source === 'authoritative-owner-history-revalidator' && attested.record.decision === 'historical-owner-records-verified');
        const retained = proof(input.retentionReceiptBytes, 'provider', 'archived-owner-retention', ['attestationDigest', 'retainedBytesDigest', 'complete']);
        ensure(retained.record.source === 'authoritative-archive-store' && retained.record.attestationDigest === attested.record.recordDigest &&
          retained.record.retainedBytesDigest === config.decisionBytesDigest && retained.record.complete === true && retained.anchor !== attested.anchor &&
          time(retained.record.recordedAt) >= time(attested.record.recordedAt) && time(retained.record.validThrough) <= time(attested.record.validThrough));
        return { state: 'verified-archived-owner-records', decisions, observedAt: historical.observedAt, retainedAt: retained.record.recordedAt,
          configDigest, policyDigest, inventoryDigest, decisionBytesDigest: config.decisionBytesDigest, factOnly: true, currentActionAuthorityRequired: true,
          executionAuthorized: false, effects: zeroEffects() };
      } catch { return { state: 'blocked', firstError: 'ARCHIVED_OWNER_INVALID', executionAuthorized: false, effects: zeroEffects() }; }
    },
  });
}
