// Complete observed reference revocation evidence; no execution or erasure grant.
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects, RETENTION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createReferenceContentVerifier, policyDigest as contentPolicy } from '../0086/reference-content.candidate.mjs';
import { createHumanAuthorityVerifier } from '../0058/human-authority.candidate.mjs';
import { createLifecycleEventVerifier } from '../0059/lifecycle-events.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant } from '../0069/exact-time.candidate.mjs';
const excluded = ['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'];
export const policyDigest = sha256(jcs({ version: 'steer-reference-revocation/v1', contentPolicy,
  rules: 'full current reference owner after retained verification; exact event actor selector manifest bundle tombstone and before-commit reservation; independent per-reference removal and exact aggregate; current facts only, separate disposition' }));
const ensure = (value) => { if (!value) throw new Error('REFERENCE_REVOCATION_INVALID'); };
const time = (value) => { const parsed = exactInstant(value); ensure(parsed !== null); return parsed; };
const bytes = (value, maximum) => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= maximum;
const text = (value) => bytes(value, 512) && !/[\u0000-\u001f*?]/u.test(value);
export function createReferenceRevocationVerifier(trustedContextBytes) {
  let context, contentContext, content, human, events, timed;
  try {
    ensure(bytes(trustedContextBytes, 262144)); context = parseCanonical(trustedContextBytes);
    ensure(exactKeys(context, ['version', 'contentContextBytes', 'environmentId', 'tombstoneRecordId']) && context.version === 'steer-reference-revocation-context/v1' &&
      (context.environmentId === null || text(context.environmentId)) && text(context.tombstoneRecordId));
    content = createReferenceContentVerifier(context.contentContextBytes); contentContext = parseCanonical(context.contentContextBytes);
    human = createHumanAuthorityVerifier(contentContext.currentRegistryBytes, 'qualified-reference');
    events = createLifecycleEventVerifier(contentContext.currentRegistryBytes); timed = createTimedRecordVerifier(contentContext.currentRegistryBytes);
  } catch { throw new Error('REFERENCE_REVOCATION_CONFIGURATION_INVALID'); }
  const configDigest = sha256(trustedContextBytes), scope = { organization: contentContext.organization, itemId: contentContext.itemId, environmentId: context.environmentId };
  const selector = { ...scope, recordId: contentContext.recordId, recordClass: 'RC-REFERENCED-EVIDENCE', artifactRevision: contentContext.artifactRevision }, selectorDigest = sha256(jcs(selector));
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      try {
        const now = time(evaluationTime); ensure(bytes(serialized, 8388608)); const input = parseCanonical(serialized);
        ensure(exactKeys(input, ['version', 'policyDigest', 'contentBytes', 'eventBytes', 'humanBundleBytes', 'referenceReceiptBytes', 'completionBytes']) &&
          input.version === 'steer-reference-revocation/v1' && input.policyDigest === policyDigest);
        const retained = content.verify(input.contentBytes, evaluationTime); ensure(retained.state === 'verified-reference-content');
        ensure(events.verify(jcs({ version: 'steer-r5-001-events/v1', policyDigest: events.policyDigest, scope, eventBytes: input.eventBytes,
          historyBytes: [], evaluationTime }), evaluationTime).state === 'validated-trigger');
        ensure(human.verify(jcs({ version: human.envelopeVersion, policyDigest: human.policyDigest, bundleBytes: input.humanBundleBytes }), evaluationTime).decision === 'ALLOW');
        const event = parseCanonical(input.eventBytes), bundle = parseCanonical(input.humanBundleBytes), authority = parseCanonical(bundle.authorityBytes);
        const inventory = parseCanonical(bundle.inventoryBytes), reservation = parseCanonical(bundle.casReservationBytes), head = parseCanonical(bundle.casHeadBytes);
        const bindingDigest = sha256(jcs(Object.fromEntries(Object.entries(event).filter(([field]) => !excluded.includes(field)))));
        ensure(event.eventType === 'reference-revocation-authorized' && event.recordId === selector.recordId && event.recordClass === selector.recordClass &&
          event.artifactRevision === selector.artifactRevision && event.policySha256 === RETENTION_POLICY_SHA &&
          event.actorId === authority.humanSubject && event.actorAuthority === authority.activeHat && event.authorizationRecordId === authority.authorityId &&
          event.referenceInventorySha256 === retained.referenceManifestDigest && event.verificationBundleSha256 === retained.verificationBundleDigest &&
          event.tombstoneRecordId === context.tombstoneRecordId && authority.eventId === event.eventId && authority.eventBindingDigest === bindingDigest &&
          authority.referenceInventoryDigest === retained.referenceManifestDigest && authority.verificationBundleDigest === retained.verificationBundleDigest &&
          authority.tombstoneRecordId === context.tombstoneRecordId && authority.referenceState === 'active' &&
          jcs(inventory.items) === jcs([{ recordId: selector.recordId, recordClass: selector.recordClass, artifactRevision: selector.artifactRevision, selectorDigest }]) &&
          jcs(authority.conditions) === jcs([`event:${bindingDigest}`, `selector:${selectorDigest}`, `references:${retained.referenceManifestDigest}`,
            `verification:${retained.verificationBundleDigest}`, `tombstone:${context.tombstoneRecordId}`]) &&
          jcs(authority.safeguards) === jcs(['exact-record-scope', 'independent-provider-proof', 'retained-verification', 'separate-disposition-authority']) &&
          time(authority.decidedAt) >= time(retained.retainedAt) && time(inventory.capturedAt) >= time(retained.inventoryAt) &&
          time(reservation.recordedAt) <= time(event.occurredAt));
        const manifest = parseCanonical(parseCanonical(input.contentBytes).referenceManifestBytes);
        ensure(Array.isArray(input.referenceReceiptBytes) && input.referenceReceiptBytes.length === manifest.references.length);
        const readProof = (serializedRecord, domain, kind, extras) => {
          ensure(bytes(serializedRecord, 65536)); const raw = parseCanonical(serializedRecord);
          const record = timed.verifyBytes(serializedRecord, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime }).record;
          ensure(exactKeys(record, ['kind', 'source', 'configDigest', 'policyDigest', 'eventDigest', 'authorityDigest', 'reservationDigest', 'referenceManifestDigest',
            'verificationBundleDigest', 'tombstoneRecordId', ...extras, 'recordedAt', 'validThrough', 'recordDigest', 'signature']) && record.kind === kind &&
            record.configDigest === configDigest && record.policyDigest === policyDigest && record.eventDigest === event.recordDigest && record.authorityDigest === authority.recordDigest &&
            record.reservationDigest === reservation.recordDigest && record.referenceManifestDigest === retained.referenceManifestDigest &&
            record.verificationBundleDigest === retained.verificationBundleDigest && record.tombstoneRecordId === context.tombstoneRecordId &&
            time(record.recordedAt) >= time(event.occurredAt) && now - time(record.recordedAt) <= 300000000000n && now < time(record.validThrough) &&
            time(record.validThrough) > time(record.recordedAt) && time(record.validThrough) - time(record.recordedAt) <= 300000000000n &&
            time(record.validThrough) <= time(authority.expiresAt) && time(record.validThrough) <= time(retained.validThrough));
          return record;
        };
        const receipts = [], ids = new Set(), sourceHeads = new Map();
        for (let index = 0; index < manifest.references.length; index++) {
          const reference = manifest.references[index], receipt = readProof(input.referenceReceiptBytes[index], 'provider', 'reference-removal-receipt',
            ['receiptId', 'referenceId', 'referenceSha256', 'afterRevision', 'status', 'remainingMatches']);
          ensure(receipt.source === 'authoritative-reference-store' && text(receipt.receiptId) && !ids.has(receipt.receiptId) && receipt.referenceId === reference.referenceId &&
            receipt.referenceSha256 === sha256(jcs(reference)) && hex(receipt.afterRevision, 40) && receipt.afterRevision !== reference.sourceRevision &&
            receipt.status === 'removed' && receipt.remainingMatches === 0 && (index === 0 || time(receipt.recordedAt) >= time(receipts.at(-1).recordedAt)));
          ids.add(receipt.receiptId);
          const source = jcs([reference.sourceRepositoryId, reference.sourceRevision, reference.sourcePath]);
          ensure(!sourceHeads.has(source) || sourceHeads.get(source) === receipt.afterRevision); sourceHeads.set(source, receipt.afterRevision); receipts.push(receipt);
        }
        const completion = readProof(input.completionBytes, 'record', 'reference-revocation-completion', ['receiptDigests', 'referenceCount', 'referenceState', 'remainingReferenceIds']);
        ensure(completion.source === 'authoritative-reference-state' && completion.referenceCount === manifest.references.length && completion.referenceState === 'cleared' &&
          jcs(completion.remainingReferenceIds) === '[]' && jcs(completion.receiptDigests) === jcs(receipts.map((receipt) => receipt.recordDigest)) &&
          time(completion.recordedAt) >= time(receipts.at(-1).recordedAt) && receipts.every((receipt) => time(completion.validThrough) <= time(receipt.validThrough)));
        const qualifiedApproval = { authorityId: authority.authorityId, providerRecordId: authority.providerRecordId, idempotencyKey: authority.idempotencyKey,
          reservationId: reservation.reservationId, headPair: jcs([head.headId, head.head]) };
        ensure(Object.values(qualifiedApproval).every(text));
        return { state: 'verified-reference-revocation', configDigest, policyDigest, eventDigest: event.recordDigest, completionDigest: completion.recordDigest,
          completionAt: completion.recordedAt, holdState: authority.holdState, referenceCount: receipts.length, referenceManifestDigest: retained.referenceManifestDigest,
          verificationBundleDigest: retained.verificationBundleDigest, tombstoneRecordId: context.tombstoneRecordId, evidenceDigest: sha256(serialized),
          qualifiedApproval, factOnly: true, currentActionAuthorityRequired: true,
          executionAuthorized: false, effects: zeroEffects() };
      } catch { return { state: 'blocked', firstError: 'REFERENCE_REVOCATION_INVALID', executionAuthorized: false, effects: zeroEffects() }; }
    },
  });
}
