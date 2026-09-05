// Offline recovery audit. No restored data, provider call or release authority.
import { readFileSync } from 'node:fs';
import { recoveryDecision } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { exactKeys, jcs, parseCanonical, sha256, strictTime, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registryBytes);
export const policyDigest = sha256(jcs({ version: 'steer-recovery-time/v1', registryDigest: timed.registryDigest, timePolicyDigest: timed.timePolicyDigest,
  observerDomain: 'provider-a', rowLimit: 4, recordLimit: 65536, rtoLimitMs: 3600000,
  rules: 'exact observation and complete inventory; timed identity and every supplied signature; native journal timestamps after identity verification and no later than recovery finish; independently attested recovery duration; no inferred issuance; original recovery semantics mandatory; pre-ack remains unknown; no execution' }));
const requireValue = (value) => { if (!value) throw new Error('RECOVERY_TIME_INVALID'); };
const time = (value) => { const parsed = strictTime(value); requireValue(parsed !== null); return parsed; };
const bytes = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;
const utf8 = new TextDecoder('utf-8', { fatal: true });
function decode(encoded, limit = 65536) {
  requireValue(bytes(encoded, 90000) && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded));
  const value = Buffer.from(encoded, 'base64'); requireValue(value.length > 0 && value.length <= limit && value.toString('base64') === encoded); return value;
}

export function createRecoveryTimeVerifier(contextBytes) {
  let evaluatedAt;
  try {
    requireValue(bytes(contextBytes, 1024)); const context = parseCanonical(contextBytes);
    requireValue(exactKeys(context, ['version', 'evaluatedAt']) && context.version === 'steer-audit-clock/v1');
    time(context.evaluatedAt); evaluatedAt = context.evaluatedAt;
  } catch { throw new Error('RECOVERY_TIME_CONTEXT_INVALID'); }
  return Object.freeze({
    verify(serialized) {
      const reject = () => ({ outcome: 'RECOVERY_INCOMPLETE', firstError: 'RECOVERY_TIME_INVALID', effects: zeroEffects(), executionAuthorized: false });
      try {
        requireValue(bytes(serialized, 262144)); const input = parseCanonical(serialized);
        requireValue(exactKeys(input, ['version', 'policyDigest', 'recoveryBytes', 'observationBytes']) && input.version === 'steer-recovery-time/v1' &&
          input.policyDigest === policyDigest && bytes(input.recoveryBytes, 65536) && bytes(input.observationBytes, 8192));
        const recovery = parseCanonical(input.recoveryBytes), observation = parseCanonical(input.observationBytes);
        requireValue(exactKeys(observation, ['version', 'recoveryDigest', 'policyDigest', 'registryDigest', 'inventoryDigest', 'recordCount', 'startedAt', 'finishedAt', 'recordedAt', 'recordDigest', 'signature']) &&
          observation.version === 'steer-recovery-observation/v1' && observation.recoveryDigest === sha256(input.recoveryBytes) &&
          observation.policyDigest === policyDigest && observation.registryDigest === timed.registryDigest && observation.recordedAt === observation.finishedAt);
        const start = time(observation.startedAt), finish = time(observation.finishedAt), evaluation = time(evaluatedAt);
        requireValue(start <= finish && finish <= evaluation && Number.isSafeInteger(recovery.startedAtMs) && recovery.startedAtMs >= 0 &&
          Number.isSafeInteger(recovery.verifiedAtMs) && recovery.verifiedAtMs >= recovery.startedAtMs && Number.isSafeInteger(recovery.rtoLimitMs) &&
          recovery.rtoLimitMs > 0 && recovery.rtoLimitMs <= 3600000 && finish - start === recovery.verifiedAtMs - recovery.startedAtMs && finish - start <= recovery.rtoLimitMs);
        // The original bundle already has an independent verifier-domain record.
        // A different pinned observer is required to avoid self-attestation.
        const observer = timed.verifyBytes(input.observationBytes, { domain: 'provider-a', recordedAt: observation.recordedAt, evaluatedAt });
        const inventory = [];
        const add = (path, serializedRecord, domain, field = null) => {
          requireValue(bytes(serializedRecord, 65536)); const record = parseCanonical(serializedRecord), recordedAt = field === null ? observation.recordedAt : record[field];
          requireValue(time(recordedAt) <= finish); const verified = timed.verifyBytes(serializedRecord, { domain, recordedAt, evaluatedAt });
          requireValue(verified.anchorDigest !== observer.anchorDigest);
          inventory.push({ path, domain, bytesDigest: sha256(serializedRecord), recordDigest: record.recordDigest,
            timeBasis: field === null ? 'observed-as-of' : `signed:${field}`, recordedAt });
          return verified;
        };
        add('recovery', input.recoveryBytes, 'record');
        const identity = add('recovery/identityEvidenceBytes', utf8.decode(decode(recovery.identityEvidenceBytes)), 'provider', 'verifiedAt').record;
        requireValue(time(identity.verifiedAt) <= finish);
        const journalBytes = utf8.decode(decode(recovery.providerJournalBytes)), journalProof = add('recovery/providerJournalBytes', journalBytes, 'recovery-provider'), journal = journalProof.record;
        const exported = add('recovery/exportedRecordBytes', utf8.decode(decode(recovery.exportedRecordBytes)), 'recovery-provider').record;
        const restored = add('recovery/restoredRecordBytes', utf8.decode(decode(recovery.restoredRecordBytes)), 'record').record;
        add('recovery/independentVerifierBytes', utf8.decode(decode(recovery.independentVerifierBytes)), 'verifier');
        requireValue(recovery.providerTrustAnchorDigest === journalProof.anchorDigest && journal.providerTrustAnchorDigest === journalProof.anchorDigest);
        for (const array of [journal.records, exported.records, restored.mappings, recovery.inventory, recovery.preInventory, recovery.postInventory])
          requireValue(Array.isArray(array) && array.length > 0 && array.length <= 4);
        let previous = null;
        for (const record of journal.records) {
          // Source journal events can predate the recovery attempt; the RTO
          // interval measures recovery work, not the age of the source history.
          const at = time(record.serverTimestamp); requireValue(time(identity.verifiedAt) <= at && at <= finish && (previous === null || previous < at)); previous = at;
          // Journal signature covers the original native timestamps. Check the
          // selected provider key at each timestamp as well as observation/eval.
          timed.verifyBytes(journalBytes, { domain: 'recovery-provider', recordedAt: record.serverTimestamp, evaluatedAt });
        }
        for (const record of [...journal.records, ...exported.records, ...restored.mappings]) {
          parseCanonical(utf8.decode(decode(record.decisionBytesBase64)));
          decode(record.gitObjectBytesBase64);
        }
        requireValue(observation.recordCount === inventory.length && observation.inventoryDigest === sha256(jcs(inventory)));
        const result = recoveryDecision(input.recoveryBytes);
        requireValue(['RECOVERY_VERIFIED', 'UNKNOWN_RECONCILE_PROVIDER'].includes(result.outcome));
        return { ...result, executionAuthorized: false, timePolicyDigest: policyDigest, evaluatedAt, observationDigest: observation.recordDigest,
          timedRecordCount: inventory.length, observedAsOfCount: inventory.filter((row) => row.timeBasis === 'observed-as-of').length };
      } catch { return reject(); }
    },
  });
}
