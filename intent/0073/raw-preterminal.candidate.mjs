// Offline grant evidence only. Current execution/batch consumption is a separate gate.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, RETENTION_POLICY_SHA, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { correctedHumanAuthorityDecision, correctionPolicyDigest as humanPolicy } from '../0058/human-authority.candidate.mjs';
import { correctedLifecycleEventDecision, correctionPolicyDigest as eventPolicy } from '../0059/lifecycle-events.candidate.mjs';
import { compilePreciseSchema, schemaPolicyDigest } from '../0070/precision-schemas.candidate.mjs';
import { exactInstant, exactRetentionBoundary, timePolicyDigest } from '../0069/exact-time.candidate.mjs';
const read = (name) => readFileSync(new URL(`../0001/reviews/domain/round-3/remediation/${name}`, import.meta.url), 'utf8').trimEnd();
const registryBytes = jcs(JSON.parse(read('TRUST-REGISTRY.candidate.json'))), registry = parseCanonical(registryBytes);
const providerBytes = read('PROVIDER-KEY-REGISTRY.candidate.json'), providers = JSON.parse(providerBytes).bindings;
const timed = createTimedRecordVerifier(registryBytes), rawSchema = compilePreciseSchema('RAW-POLICY-GRANT.schema.json');
export const policyDigest = sha256(jcs({ version: 'steer-raw-preterminal/v1', humanPolicy, eventPolicy, schemaPolicyDigest, timePolicyDigest,
  registryDigest: timed.registryDigest, providerDigest: sha256(providerBytes), retentionPolicyDigest: RETENTION_POLICY_SHA,
  rules: 'one exact preparation inventory and complete human grant before the named terminal; no future state/receipt signing; no execution or batch-consumption authority', maxCopies: 32 }));
const ensure = (value) => { if (!value) throw new Error('RAW_PRETERMINAL_INVALID'); };
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f*?]/u.test(value);
const time = (value) => { const instant = exactInstant(value); ensure(instant !== null); return instant; };
const same = (left, right) => jcs(left) === jcs(right);
const copyFields = ['copyId', 'copyKind', 'provider', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId', 'sourceOriginal'];

// The composition root, not an agent request, supplies the lifecycle context pin.
export function createRawPreterminalVerifier(configBytes) {
  let config;
  try {
    ensure(typeof configBytes === 'string' && configBytes.length <= 16384); config = parseCanonical(configBytes);
    ensure(exactKeys(config, ['version', 'lifecycleConfigDigest', 'recordId', 'artifactRevision', 'environmentId']) &&
      config.version === 'steer-raw-preparation-context/v1' && hex(config.lifecycleConfigDigest, 64) && text(config.recordId) &&
      hex(config.artifactRevision, 40) && (config.environmentId === null || text(config.environmentId)));
  } catch { throw new Error('RAW_PRETERMINAL_CONFIGURATION_INVALID'); }
  const configDigest = sha256(configBytes);
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, terminalEventBytes, evaluationTime) {
      try {
        const now = time(evaluationTime);
        ensure(typeof serialized === 'string' && serialized.length <= 2097152 && typeof terminalEventBytes === 'string' && terminalEventBytes.length <= 65536);
        const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'configDigest', 'preparationBytes', 'humanBundleBytes', 'rawGrantBytes']) &&
          input.version === 'steer-raw-preterminal/v1' && input.policyDigest === policyDigest && input.configDigest === configDigest &&
          typeof input.preparationBytes === 'string' && input.preparationBytes.length <= 65536 &&
          typeof input.humanBundleBytes === 'string' && input.humanBundleBytes.length <= 1048576 &&
          typeof input.rawGrantBytes === 'string' && input.rawGrantBytes.length <= 65536);
        const terminal = parseCanonical(terminalEventBytes);
        const event = correctedLifecycleEventDecision(jcs({ version: 'steer-r5-001-events/v1', policyDigest: eventPolicy,
          scope: { organization: 'steer-platform', itemId: '0001-flight-deck-foundation', environmentId: config.environmentId },
          eventBytes: terminalEventBytes, historyBytes: [], evaluationTime }));
        ensure(event.state === 'validated-trigger' && terminal.eventType === 'corpus-sanitization-terminal' &&
          terminal.recordClass === 'RC-CORPUS-RAW-WORKING' && terminal.recordId === config.recordId && terminal.artifactRevision === config.artifactRevision &&
          terminal.policySha256 === RETENTION_POLICY_SHA && ['pass', 'fail', 'cancelled'].includes(terminal.result));
        const terminalAt = time(terminal.occurredAt), deadlineAt = exactRetentionBoundary(terminal.occurredAt, 'PT60S');
        const rawPreparation = parseCanonical(input.preparationBytes);
        const preparation = timed.verifyBytes(input.preparationBytes, { domain: 'provider', recordedAt: rawPreparation.recordedAt, evaluatedAt: evaluationTime }).record;
        ensure(exactKeys(preparation, ['kind', 'configDigest', 'preparationId', 'source', 'terminalEventId', 'copies', 'complete', 'sanitizerRevision', 'inspectorRevision', 'recordedAt', 'validThrough', 'recordDigest', 'signature']) &&
          preparation.kind === 'raw-preparation' && preparation.source === 'authoritative-raw-preparation' && preparation.configDigest === configDigest &&
          text(preparation.preparationId) && preparation.complete === true && preparation.terminalEventId === terminal.eventId &&
          text(preparation.sanitizerRevision) && text(preparation.inspectorRevision) && preparation.sanitizerRevision === terminal.sanitizerRevision &&
          preparation.inspectorRevision === terminal.inspectionRevision && time(preparation.recordedAt) < terminalAt &&
          now < time(preparation.validThrough) && time(deadlineAt) < time(preparation.validThrough) &&
          Array.isArray(preparation.copies) && preparation.copies.length > 0 && preparation.copies.length <= 32);
        const copies = preparation.copies, ids = new Set(), physical = new Set();
        for (const copy of copies) {
          ensure(exactKeys(copy, copyFields) && copyFields.filter((field) => field !== 'sourceOriginal').every((field) => text(copy[field])) &&
            copy.copyKind === 'temporary-working' && copy.sourceOriginal === false && !ids.has(copy.copyId)); ids.add(copy.copyId);
          const physicalId = jcs([copy.providerBindingId, copy.account, copy.objectKey, copy.versionId]); ensure(!physical.has(physicalId)); physical.add(physicalId);
          const binding = providers.find((row) => row.providerBindingId === copy.providerBindingId);
          ensure(binding && binding.tenant === 'steer-platform' && binding.provider === copy.provider && binding.account === copy.account);
          const anchor = registry.bindings.find((row) => row.domain === binding.domain && row.keyId === binding.keyId);
          ensure(anchor && ['algorithm', 'publicKeyHex', 'notBefore', 'notAfter', 'revokedAt'].every((field) => anchor[field] === binding[field]));
          for (const at of [time(preparation.recordedAt), now]) ensure(at >= time(binding.notBefore) && at < time(binding.notAfter) && (binding.revokedAt === null || at < time(binding.revokedAt)));
        }
        ensure(same(copies.map((copy) => copy.copyId), [...ids].sort()));
        const tupleDigest = sha256(jcs(copies)), bundle = parseCanonical(input.humanBundleBytes);
        ensure(bundle.evaluationTime === evaluationTime && correctedHumanAuthorityDecision(jcs({ version: 'steer-r5-002-human/v1', policyDigest: humanPolicy, bundleBytes: input.humanBundleBytes })).decision === 'ALLOW');
        const authority = parseCanonical(bundle.authorityBytes), inventory = parseCanonical(bundle.inventoryBytes), grant = parseCanonical(input.rawGrantBytes);
        ensure(rawSchema(grant).length === 0 && same(grant.authority, authority) && grant.sanitizerRevision === preparation.sanitizerRevision && grant.inspectorRevision === preparation.inspectorRevision);
        ensure(authority.authorityType === 'raw-policy-grant' && authority.eraseMethod === 'cryptographic-erase' && authority.terminalEventId === preparation.terminalEventId &&
          authority.deadlineSeconds === 60 && authority.sourceOriginalExcluded === true && authority.holdState === 'none' && authority.referenceState === 'cleared' &&
          same(authority.conditions, [`raw-preparation:${preparation.recordDigest}`, `raw-context:${configDigest}`, `raw-tuples:${tupleDigest}`]) &&
          same(authority.safeguards, ['network-denied', 'encrypted', 'complete-inventory', 'provider-receipt']) &&
          same(authority.allowedCopyProviders, [...new Set(copies.map((copy) => copy.provider))].sort()) &&
          inventory.preparationDigest === preparation.recordDigest && inventory.tupleDigest === tupleDigest &&
          same(inventory.items, copies.map((copy) => ({ copyId: copy.copyId, provider: copy.provider, objectDigest: sha256(jcs(copy)) }))) &&
          time(preparation.recordedAt) <= time(inventory.capturedAt) && time(inventory.capturedAt) <= time(authority.decidedAt) &&
          time(authority.decidedAt) < terminalAt && time(authority.validFrom) <= terminalAt && time(deadlineAt) < time(authority.expiresAt));
        // Enrollment's complete provider/CAS proof must exist before terminal,
        // not just a backdated validFrom. Later batch execution needs new checks.
        for (const [field, timestamp] of [['providerProofBytes', 'recordedAt'], ['replayLedgerBytes', 'snapshotAt'], ['casHeadBytes', 'snapshotAt'], ['casReservationBytes', 'recordedAt']])
          ensure(time(parseCanonical(bundle[field])[timestamp]) < terminalAt);
        ensure(parseCanonical(bundle.replayLedgerBytes).status === 'unused' &&
          time(parseCanonical(bundle.casReservationBytes).recordedAt) >= time(authority.decidedAt));
        const authorityDigest = authority.recordDigest, preparationDigest = preparation.recordDigest;
        return { state: 'verified-preterminal-grant', firstError: null, effects: zeroEffects(), executionAuthorized: false,
          configDigest, policyDigest, authorityDigest, preparationDigest, tupleDigest, copyCount: copies.length, terminalEventId: terminal.eventId,
          decidedAt: authority.decidedAt, expiresAt: authority.expiresAt, deadlineAt,
          batchBindingDigest: sha256(jcs({ configDigest, preparationDigest, authorityDigest, terminalEventId: terminal.eventId })),
          requiresCurrentBatchAuthorization: true };
      } catch { return { state: 'blocked', firstError: 'RAW_PRETERMINAL_INVALID', effects: zeroEffects(), executionAuthorized: false }; }
    },
  });
}
