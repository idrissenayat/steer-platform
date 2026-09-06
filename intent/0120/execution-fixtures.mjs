// Closed synthetic decision fixtures. Signing and mutation remain module-private.
import { Buffer } from 'node:buffer';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { TRUST_REGISTRY, jcs, sha256, RETENTION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { makeHumanAuthorityBundle, makeLifecycleEventBytes } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { humanAuthorityBindingDigest, createHumanAuthorityVerifier } from '../0058/human-authority.candidate.mjs';
import { exactInstant, formatExactInstant } from '../0069/exact-time.candidate.mjs';
import { createRetirementDecisionVerifier, policyDigest } from './retirement-decision.candidate.mjs';
const proofFields = ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes', 'assignmentEvidenceBytes', 'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes'];
const variants = ['positive', 'future-2033', 'empty-prefix', 'held', 'released', 'prior-retirement', 'wrong-source', 'wrong-actor', 'wrong-actor-role', 'wrong-event-id',
  'wrong-event-binding', 'wrong-corpus', 'wrong-previous', 'wrong-history-head', 'wrong-selector', 'wrong-conditions', 'wrong-safeguards', 'false-hold',
  'head-incomplete', 'head-policy', 'head-source', 'head-history', 'head-previous', 'head-hold', 'head-after-decision', 'head-after-cas',
  'reservation-after-event', 'cas-after-decision', 'replay-after-decision', 'unqualified', 'disabled-identity', 'expired-assignment', 'cas-loser', 'replayed', 'old-key-revoked',
  'missing-history', 'missing-head', 'extra-field', ...proofFields.map(f => `missing-${f}`), ...proofFields.map(f => `corrupt-${f}`)];
function key(domain, future) {
  return createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(future ? `steer-0120-future-${domain}` : `steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
}
function seal(input, domain, future) {
  const payload = Object.fromEntries(Object.entries(input).filter(([k]) => !['recordDigest', 'signature'].includes(k))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-${future ? 'current' : 'v1'}`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), key(domain, future)).toString('base64') } };
}
export function retirementDecisionExecutionCase(variant = 'positive') {
  if (!variants.includes(variant)) throw new Error('UNKNOWN_RETIREMENT_DECISION_CASE');
  const future = variant === 'future-2033', year = future ? 2033 : 2026, epoch = exactInstant(`${year}-09-04T12:00:00Z`);
  const at = second => formatExactInstant(epoch + BigInt(second) * 1000000000n), evaluationTime = at(2), until = at(60), registry = structuredClone(TRUST_REGISTRY);
  if (future) for (const domain of ['authority', 'provider', 'record', 'human-provider', 'assignment', 'replay-authority', 'cas-authority']) registry.bindings.push({
    domain, keyId: `${domain}-key-current`, algorithm: 'Ed25519', publicKeyHex: createPublicKey(key(domain, true)).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: `${year}-01-01T00:00:00Z`, notAfter: `${year + 1}-01-01T00:00:00Z`, revokedAt: null });
  if (variant === 'old-key-revoked') registry.bindings.find(k => k.domain === 'human-provider').revokedAt = evaluationTime;
  const registryBytes = jcs(registry), scope = { organization: 'steer-platform', itemId: '0001-flight-deck-foundation', environmentId: null };
  const selector = { ...scope, recordId: 'provenance-1', recordClass: 'RC-CORPUS-PROVENANCE', artifactRevision: 'b'.repeat(40), corpusId: 'fixture-corpus', corpusVersion: 'fixture-v1' };
  const emitEvent = (type, index, second) => {
    const raw = { ...JSON.parse(makeLifecycleEventBytes(type, index)), ...scope, recordId: selector.recordId, recordClass: selector.recordClass,
      artifactRevision: selector.artifactRevision, policySha256: RETENTION_POLICY_SHA, occurredAt: at(second) };
    if (type === 'corpus-retired') Object.assign(raw, { corpusId: selector.corpusId, corpusVersion: selector.corpusVersion, actorId: variant === 'wrong-actor' ? 'human:other' : 'human:records-owner',
      actorAuthority: variant === 'wrong-actor-role' ? 'platform-agent' : 'privacy-legal-records-owner', timestampAuthority: variant === 'wrong-source' ? 'system-of-record-commit' : 'qualified-owner-decision-commit' });
    if (['hold-applied', 'hold-released'].includes(type)) raw.holdId = 'fixture-hold';
    const payload = Object.fromEntries(Object.entries(raw).filter(([k]) => !['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'].includes(k)));
    const proof = seal({ providerRecordId: raw.providerRecordId, eventId: raw.eventId, eventBindingDigest: sha256(jcs(payload)), recordedAt: raw.occurredAt }, 'provider', future);
    return jcs(seal({ ...payload, providerProofBytes: jcs(proof), providerProofDigest: proof.recordDigest }, 'record', future));
  };
  const historyBytes = variant === 'empty-prefix' ? [] : [emitEvent(['held', 'released'].includes(variant) ? 'hold-applied' : variant === 'prior-retirement' ? 'corpus-retired' : 'record-committed', 1, -20)];
  if (variant === 'released') historyBytes.push(emitEvent('hold-released', 2, -18));
  const eventBytes = emitEvent('corpus-retired', 3, -2), event = JSON.parse(eventBytes), previousEventDigest = historyBytes.length ? JSON.parse(historyBytes.at(-1)).recordDigest : null;
  const holdState = variant === 'held' ? 'active' : variant === 'released' ? 'released' : 'none';
  const config = { version: 'steer-retirement-decision-context/v1', scope, recordId: selector.recordId, artifactRevision: selector.artifactRevision,
    corpusId: selector.corpusId, corpusVersion: selector.corpusVersion, eventId: event.eventId, eventDigest: event.recordDigest, historyDigest: sha256(jcs(historyBytes)), currentRegistryBytes: registryBytes };
  const configBytes = jcs(config), configDigest = sha256(configBytes), selectorDigest = sha256(jcs(selector));
  const head = { kind: 'retirement-history-head', source: 'authoritative-lifecycle-store', configDigest, policyDigest, registryDigest: sha256(registryBytes), historyDigest: config.historyDigest,
    historyComplete: true, previousEventDigest, holdState, recordedAt: at(-10), validThrough: until };
  for (const [name, field, value] of [['head-incomplete', 'historyComplete', false], ['head-policy', 'policyDigest', 'f'.repeat(64)], ['head-source', 'source', 'caller'],
    ['head-history', 'historyDigest', 'f'.repeat(64)], ['head-previous', 'previousEventDigest', 'f'.repeat(64)], ['head-hold', 'holdState', 'active'],
    ['head-after-decision', 'recordedAt', at(-5)], ['head-after-cas', 'recordedAt', at(-6)]]) if (variant === name) head[field] = value;
  const signedHead = seal(head, 'authority', future), bundle = makeHumanAuthorityBundle();
  const emit = (field, value, domain) => { const record = seal(value, domain, future); bundle[field] = jcs(record); return record; };
  const identity = emit('identityEvidenceBytes', { ...JSON.parse(bundle.identityEvidenceBytes), verifiedAt: at(-9), ...(variant === 'disabled-identity' ? { status: 'disabled' } : {}) }, 'provider');
  const qualification = emit('qualificationEvidenceBytes', { ...JSON.parse(bundle.qualificationEvidenceBytes), validThrough: until, ...(variant === 'unqualified' ? { qualification: 'not-qualified' } : {}) }, 'provider');
  const assignment = emit('assignmentEvidenceBytes', { ...JSON.parse(bundle.assignmentEvidenceBytes), validThrough: until, ...(variant === 'expired-assignment' ? { status: 'expired' } : {}) }, 'assignment');
  const inventory = emit('inventoryBytes', { ...JSON.parse(bundle.inventoryBytes), capturedAt: at(-9), items: [{ recordId: variant === 'wrong-selector' ? 'other-record' : selector.recordId,
    recordClass: selector.recordClass, artifactRevision: selector.artifactRevision, selectorDigest }] }, 'record');
  const eventBindingDigest = sha256(jcs(Object.fromEntries(Object.entries(event).filter(([k]) => !['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'].includes(k)))));
  const authority = { ...JSON.parse(bundle.authorityBytes), version: 'steer-qualified-retirement-decision/v1', authorityType: 'qualified-retirement-decision',
    identityEvidenceDigest: identity.recordDigest, qualificationEvidenceDigest: qualification.recordDigest, qualificationValidThrough: qualification.validThrough,
    assignmentEvidenceDigest: assignment.recordDigest, assignmentValidThrough: assignment.validThrough, authenticatedAt: at(-8), decidedAt: at(-6), validFrom: at(-15), expiresAt: until,
    selectorInventoryDigest: inventory.recordDigest, decisionKind: 'corpus-retired', eventId: event.eventId, eventBindingDigest, previousEventDigest, historyHeadDigest: signedHead.recordDigest,
    corpusId: selector.corpusId, corpusVersion: selector.corpusVersion, holdState,
    providerTrustAnchorDigest: sha256(registry.bindings.find(k => k.keyId === `human-provider-key-${future ? 'current' : 'v1'}`).publicKeyHex),
    conditions: [`event:${eventBindingDigest}`, `selector:${selectorDigest}`, `previous-event:${previousEventDigest ?? 'none'}`, `history-head:${signedHead.recordDigest}`, `policy:${policyDigest}`],
    safeguards: ['exact-record-scope', 'independent-provider-proof', 'current-qualified-owner', 'non-erasure-retirement'] };
  for (const field of ['copyInventoryDigest', 'referenceState', 'allowedCopyProviders', 'sourceOriginalExcluded', 'deadlineSeconds', 'eraseMethod', 'terminalEventId']) delete authority[field];
  for (const [name, field, value] of [['wrong-event-id', 'eventId', 'other-event'], ['wrong-event-binding', 'eventBindingDigest', 'f'.repeat(64)], ['wrong-corpus', 'corpusId', 'other-corpus'],
    ['wrong-previous', 'previousEventDigest', 'f'.repeat(64)], ['wrong-history-head', 'historyHeadDigest', 'f'.repeat(64)], ['false-hold', 'holdState', 'active'],
    ['wrong-conditions', 'conditions', ['wrong']], ['wrong-safeguards', 'safeguards', ['a', 'b', 'c', 'd']]]) if (variant === name) authority[field] = value;
  const provider = emit('providerProofBytes', { ...JSON.parse(bundle.providerProofBytes), authorityBindingDigest: humanAuthorityBindingDigest(authority), recordedAt: authority.decidedAt }, 'human-provider');
  const signedAuthority = emit('authorityBytes', { ...authority, providerProofDigest: provider.recordDigest }, 'authority');
  emit('replayLedgerBytes', { ...JSON.parse(bundle.replayLedgerBytes), snapshotAt: at(variant === 'replay-after-decision' ? -5 : -7), validThrough: until,
    ...(variant === 'replayed' ? { idempotencyKey: authority.idempotencyKey, status: 'committed', requestDigest: signedAuthority.recordDigest, resultDigest: 'e'.repeat(64) } : {}) }, 'replay-authority');
  emit('casHeadBytes', { ...JSON.parse(bundle.casHeadBytes), snapshotAt: at(variant === 'cas-after-decision' ? -5 : -7), validThrough: until }, 'cas-authority');
  emit('casReservationBytes', { ...JSON.parse(bundle.casReservationBytes), requestDigest: signedAuthority.recordDigest, authorityDigest: signedAuthority.recordDigest,
    recordedAt: at(variant === 'reservation-after-event' ? 1 : -5), validThrough: until, ...(variant === 'cas-loser' ? { winner: false, status: 'lost' } : {}) }, 'cas-authority');
  bundle.evaluationTime = evaluationTime;
  for (const field of proofFields) {
    if (variant === `missing-${field}`) bundle[field] = '';
    if (variant === `corrupt-${field}`) { const raw = JSON.parse(bundle[field]); raw.signature.valueBase64 = Buffer.alloc(64).toString('base64'); bundle[field] = jcs(raw); }
  }
  const envelope = { version: 'steer-retirement-decision/v1', policyDigest, configDigest, eventBytes, historyBytes, humanBundleBytes: jcs(bundle), historyHeadBytes: jcs(signedHead) };
  if (variant === 'missing-history') envelope.historyBytes = [];
  if (variant === 'missing-head') envelope.historyHeadBytes = '';
  if (variant === 'extra-field') envelope.executionAuthorized = true;
  return { config, configBytes, registryBytes, envelope, bytes: jcs(envelope), bundle, evaluationTime, human: createHumanAuthorityVerifier(registryBytes, 'qualified-retirement'), verifier: createRetirementDecisionVerifier(configBytes) };
}
