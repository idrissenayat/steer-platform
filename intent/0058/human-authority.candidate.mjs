// Complete-binding successor candidate; no frozen oracle, Exam or live route is changed.
import { readFileSync } from 'node:fs';
import { compileOffline } from '../0001/reviews/domain/round-3/remediation/offline-schema-registry.candidate.mjs';
import { AUTHORIZATION_POLICY_BYTES, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA, RETENTION_POLICY_BYTES,
  RETENTION_POLICY_PATH, RETENTION_POLICY_SHA, TARGET_REVISION, TARGET_EXAM_SHA,
  exactKeys, jcs, parseCanonical, sha256, strictTime, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from './record-verifier.candidate.mjs';

const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const verifier = createTimedRecordVerifier(registryBytes);
const schema = compileOffline('HUMAN-AUTHORITY.schema.json');
const fields = ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes', 'assignmentEvidenceBytes',
  'inventoryBytes', 'authorizationPolicyBytes', 'retentionPolicyBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes', 'evaluationTime'];
const excluded = new Set(['providerProofDigest', 'recordDigest', 'signature']);
export function humanAuthorityBindingDigest(authority) {
  return sha256(jcs(Object.fromEntries(Object.entries(authority).filter(([field]) => !excluded.has(field)))));
}
export const correctionPolicyBytes = jcs({ version: 'steer-r5-002-human/v1', finding: 'PREFLIGHT-R3-R5-002',
  registryDigest: verifier.registryDigest, timePolicyDigest: verifier.timePolicyDigest, binding: 'all canonical authority fields except providerProofDigest, recordDigest, signature',
  providerTime: 'recordedAt equals decidedAt; verify key at recordedAt and evaluationTime',
  supportingTime: 'identity verifiedAt; inventory capturedAt; replay/head snapshotAt; reservation recordedAt; qualification/assignment as of decidedAt',
  envelopeLimit: 1048576, recordLimit: 65536,
});
export const correctionPolicyDigest = sha256(correctionPolicyBytes);
const deny = (firstError) => ({ decision: 'DENY', firstError, effects: zeroEffects() });
const validTime = (value) => { const time = strictTime(value); if (time === null) throw new Error('INVALID_TIME'); return time; };

export function correctedHumanAuthorityDecision(serialized) {
  try {
    if (typeof serialized !== 'string' || serialized.length > 1048576) return deny('HUMAN_ENVELOPE_INVALID');
    const envelope = parseCanonical(serialized);
    if (!exactKeys(envelope, ['version', 'policyDigest', 'bundleBytes']) || envelope.version !== 'steer-r5-002-human/v1' ||
        envelope.policyDigest !== correctionPolicyDigest || typeof envelope.bundleBytes !== 'string') return deny('HUMAN_ENVELOPE_INVALID');
    const input = parseCanonical(envelope.bundleBytes);
    if (!exactKeys(input, fields) || fields.some((field) => typeof input[field] !== 'string' || input[field].length > 65536)) return deny('HUMAN_BUNDLE_INVALID');
    if (input.authorizationPolicyBytes !== AUTHORIZATION_POLICY_BYTES || input.retentionPolicyBytes !== RETENTION_POLICY_BYTES) return deny('HUMAN_POLICY_INVALID');
    const authority = parseCanonical(input.authorityBytes);
    if (schema(authority).length) return deny('HUMAN_SCHEMA_INVALID');
    const now = validTime(input.evaluationTime), decided = validTime(authority.decidedAt), authenticated = validTime(authority.authenticatedAt);
    if (!(authenticated <= decided && decided <= now && validTime(authority.validFrom) <= decided && now < validTime(authority.expiresAt) &&
        now < validTime(authority.qualificationValidThrough) && now < validTime(authority.assignmentValidThrough))) return deny('HUMAN_TIME_INVALID');
    const checked = (bytes, domain, at) => verifier.verifyBytes(bytes, { domain, recordedAt: at, evaluatedAt: input.evaluationTime });
    checked(input.authorityBytes, 'authority', authority.decidedAt);
    const providerRaw = parseCanonical(input.providerProofBytes);
    const { record: provider, anchorDigest } = checked(input.providerProofBytes, 'human-provider', providerRaw.recordedAt);
    if (!exactKeys(provider, ['providerRecordId', 'authorityBindingDigest', 'humanSubject', 'decision', 'recordedAt', 'recordDigest', 'signature']) ||
        provider.recordedAt !== authority.decidedAt || anchorDigest !== authority.providerTrustAnchorDigest ||
        provider.authorityBindingDigest !== humanAuthorityBindingDigest(authority) || provider.providerRecordId !== authority.providerRecordId ||
        provider.humanSubject !== authority.humanSubject || provider.decision !== 'authorized' || provider.recordDigest !== authority.providerProofDigest)
      return deny('HUMAN_PROVIDER_BINDING_INVALID');
    const timed = (field, domain, timeField) => { const raw = parseCanonical(input[field]); return checked(input[field], domain, raw[timeField]).record; };
    const identity = timed('identityEvidenceBytes', 'provider', 'verifiedAt');
    const qualification = checked(input.qualificationEvidenceBytes, 'provider', authority.decidedAt).record;
    const assignment = checked(input.assignmentEvidenceBytes, 'assignment', authority.decidedAt).record;
    const inventory = timed('inventoryBytes', 'record', 'capturedAt');
    const replay = timed('replayLedgerBytes', 'replay-authority', 'snapshotAt');
    const head = timed('casHeadBytes', 'cas-authority', 'snapshotAt');
    const reservation = timed('casReservationBytes', 'cas-authority', 'recordedAt');
    if (authority.organization !== 'steer-platform' || authority.tenant !== 'steer-platform' || authority.item !== '0001-flight-deck-foundation' ||
        authority.targetExamRevision !== TARGET_REVISION || authority.targetExamDigest !== TARGET_EXAM_SHA ||
        authority.retentionPolicyPath !== RETENTION_POLICY_PATH || authority.retentionPolicyDigest !== RETENTION_POLICY_SHA ||
        authority.authorizationPolicyPath !== AUTHORIZATION_POLICY_PATH || authority.authorizationPolicyRevision !== TARGET_REVISION ||
        authority.authorizationPolicyDigest !== AUTHORIZATION_POLICY_SHA) return deny('HUMAN_TARGET_INVALID');
    const scope = (record) => record.organization === authority.organization && record.tenant === authority.tenant && record.humanSubject === authority.humanSubject;
    if (!scope(identity) || identity.recordDigest !== authority.identityEvidenceDigest || identity.issuer !== authority.identityIssuer ||
        identity.status !== 'verified-active' || validTime(identity.verifiedAt) > authenticated) return deny('HUMAN_IDENTITY_INVALID');
    if (!scope(qualification) || qualification.recordDigest !== authority.qualificationEvidenceDigest || qualification.qualification !== 'qualified-current' ||
        qualification.issuer !== 'records-board' || qualification.validThrough !== authority.qualificationValidThrough) return deny('HUMAN_QUALIFICATION_INVALID');
    if (!scope(assignment) || assignment.recordDigest !== authority.assignmentEvidenceDigest || assignment.activeHat !== authority.activeHat ||
        assignment.item !== authority.item || assignment.targetExamRevision !== authority.targetExamRevision || assignment.targetExamDigest !== authority.targetExamDigest ||
        assignment.status !== 'current' || assignment.validThrough !== authority.assignmentValidThrough) return deny('HUMAN_ASSIGNMENT_INVALID');
    if (inventory.recordDigest !== authority.copyInventoryDigest || inventory.organization !== authority.organization || inventory.tenant !== authority.tenant ||
        inventory.item !== authority.item || !Array.isArray(inventory.items) || !inventory.items.length ||
        new Set(inventory.items.map((row) => row.copyId)).size !== inventory.items.length || validTime(inventory.capturedAt) > decided) return deny('HUMAN_INVENTORY_INVALID');
    const target = (record) => record.targetExamRevision === TARGET_REVISION && record.targetExamSha256 === TARGET_EXAM_SHA && record.authorizationPolicyDigest === AUTHORIZATION_POLICY_SHA;
    if (!exactKeys(replay, ['ledgerId', 'source', 'status', 'idempotencyKey', 'requestDigest', 'resultDigest', 'headId', 'snapshotAt', 'validThrough',
      'targetExamRevision', 'targetExamSha256', 'authorizationPolicyDigest', 'recordDigest', 'signature']) || replay.source !== 'authoritative-replay-store' ||
        !['unused', 'committed'].includes(replay.status) || !target(replay) || now >= validTime(replay.validThrough)) return deny('HUMAN_REPLAY_INVALID');
    if (replay.idempotencyKey === authority.idempotencyKey) return deny('HUMAN_REPLAY');
    if (!exactKeys(head, ['headId', 'source', 'head', 'previousHead', 'sequence', 'snapshotAt', 'validThrough', 'targetExamRevision', 'targetExamSha256',
      'authorizationPolicyDigest', 'recordDigest', 'signature']) || head.source !== 'authoritative-cas-store' || head.headId !== replay.headId ||
        head.head !== authority.casHead || !target(head) || now >= validTime(head.validThrough) || !Number.isSafeInteger(head.sequence) || head.sequence < 1) return deny('HUMAN_CAS_INVALID');
    if (!exactKeys(reservation, ['reservationId', 'source', 'headId', 'expectedHead', 'idempotencyKey', 'requestDigest', 'authorityDigest', 'winner', 'status',
      'recordedAt', 'validThrough', 'targetExamRevision', 'targetExamSha256', 'authorizationPolicyDigest', 'recordDigest', 'signature']) ||
        reservation.source !== 'authoritative-cas-store' || reservation.headId !== head.headId || reservation.expectedHead !== authority.casHead ||
        reservation.idempotencyKey !== authority.idempotencyKey || reservation.requestDigest !== authority.recordDigest || reservation.authorityDigest !== authority.recordDigest ||
        reservation.winner !== true || reservation.status !== 'reserved' || !target(reservation) ||
        validTime(reservation.recordedAt) < validTime(head.snapshotAt) || now >= validTime(reservation.validThrough)) return deny('HUMAN_RESERVATION_INVALID');
    return { decision: 'ALLOW', firstError: null, effects: zeroEffects(), correctionPolicyDigest,
      consumedRecordIds: [authority.authorityId, provider.providerRecordId, identity.evidenceId, qualification.evidenceId, assignment.assignmentId,
        inventory.inventoryId, replay.ledgerId, head.headId, reservation.reservationId] };
  } catch { return deny('HUMAN_TIMED_EVIDENCE_INVALID'); }
}
