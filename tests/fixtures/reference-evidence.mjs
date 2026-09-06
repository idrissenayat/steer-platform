import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createReferenceContentVerifier, policyDigest } from '../../intent/0086/reference-content.candidate.mjs';
import { createReferenceRevocationVerifier, policyDigest as revocationPolicy } from '../../intent/0087/reference-revocation.candidate.mjs';
import { humanAuthorityBindingDigest } from '../../intent/0058/human-authority.candidate.mjs';
import { makeHumanAuthorityBundle, makeLifecycleEventBytes } from '../../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { TRUST_REGISTRY, RETENTION_POLICY_SHA, jcs, sha256 } from '../../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const keys = new Map();
function key(domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(`steer-0086-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  return keys.get(domain);
}
export function seal(record, domain) {
  const payload = Object.fromEntries(Object.entries(record).filter(([field]) => !['recordDigest', 'signature'].includes(field))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-current`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), key(domain)).toString('base64') } };
}
export function referenceContentFixture(edits = {}, year = 2033, options = {}) {
  const at = options.at ?? ((second) => `${year}-09-04T12:00:${String(second).padStart(2, '0')}Z`), edit = (name, value) => { edits[name]?.(value); return value; };
  const signRecord = options.seal ?? seal, until = options.until ?? at(59);
  const registry = structuredClone(options.registry ?? TRUST_REGISTRY);
  if (!options.registry) for (const domain of ['provider', 'record', 'authority', 'human-provider', 'assignment', 'replay-authority', 'cas-authority']) registry.bindings.push({ domain, keyId: `${domain}-key-current`, algorithm: 'Ed25519',
    publicKeyHex: createPublicKey(key(domain)).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: `${year}-01-01T00:00:00Z`, notAfter: `${year + 1}-01-01T00:00:00Z`, revokedAt: null });
  edit('registry', registry); const registryBytes = jcs(registry);
  const manifest = edit('manifest', { version: 'steer-reference-inventory/v1', organization: 'steer-platform', itemId: '0001-flight-deck-foundation',
    recordId: 'evidence-1', artifactRevision: 'b'.repeat(40), versions: [{ versionId: 'v1', objectSha256: sha256('object-one') }, { versionId: 'v2', objectSha256: sha256('object-two') }],
    references: [1, 2].map((index) => ({ referenceId: `ref-${index}`, sourceRepositoryId: 'steer-platform', sourceRevision: 'c'.repeat(40),
      sourcePath: `intent/0001/proof-${index}.md`, targetRecordId: 'evidence-1', targetArtifactRevision: 'b'.repeat(40),
      targetVersionId: `v${index}`, targetSha256: sha256(index === 1 ? 'object-one' : 'object-two') })) });
  const referenceManifestBytes = jcs(manifest), referenceManifestDigest = sha256(referenceManifestBytes);
  const bundle = edit('bundle', { version: 'steer-reference-verification-bundle/v1', referenceInventorySha256: referenceManifestDigest,
    records: manifest.references.map((reference, index) => ({ referenceId: reference.referenceId, verificationBytes: jcs(edit(`verification-${index}`, {
      version: 'steer-reference-verification/v1', referenceId: reference.referenceId, referenceSha256: sha256(jcs(reference)), method: 'sha256-reference-binding',
      targetVersionId: reference.targetVersionId, targetSha256: reference.targetSha256 })) })) });
  const verificationBundleBytes = jcs(bundle), verificationBundleDigest = sha256(verificationBundleBytes);
  const context = edit('context', { version: 'steer-reference-content-context/v1', organization: 'steer-platform', itemId: '0001-flight-deck-foundation', recordId: 'evidence-1',
    artifactRevision: 'b'.repeat(40), repositoryId: 'steer-platform', referenceManifestDigest, verificationBundleDigest,
    verificationArchive: { repositoryId: 'steer-platform', revision: 'd'.repeat(40), path: 'evidence/verification.json' }, currentRegistryBytes: registryBytes });
  const contextBytes = jcs(context), configDigest = sha256(contextBytes);
  const verificationInventoryDigest = sha256(jcs(bundle.records.map((row) => ({ referenceId: row.referenceId,
    referenceSha256: JSON.parse(row.verificationBytes).referenceSha256, verificationBytesDigest: sha256(row.verificationBytes) }))));
  const common = { configDigest, policyDigest, registryDigest: sha256(registryBytes), referenceManifestDigest, verificationBundleDigest,
    verificationInventoryDigest, versionCount: manifest.versions.length, referenceCount: manifest.references.length, validThrough: until };
  const inventory = signRecord(edit('inventory', { ...common, kind: 'reference-inventory-attestation', source: 'authoritative-reference-inventory',
    completeVersions: true, completeReferences: true, recordedAt: at(10) }), 'provider');
  const verification = signRecord(edit('verification', { ...common, kind: 'reference-verification-attestation', source: 'authoritative-reference-verifier',
    inventoryAttestationDigest: inventory.recordDigest, result: 'verified', recordedAt: at(11) }), 'record');
  const retention = signRecord(edit('retention', { ...common, kind: 'reference-verification-retention', source: 'authoritative-verification-archive',
    verificationAttestationDigest: verification.recordDigest, archiveReference: context.verificationArchive, retainedBytesDigest: verificationBundleDigest,
    complete: true, recordedAt: at(12) }), 'authority');
  const envelope = edit('envelope', { version: 'steer-reference-content/v1', policyDigest, referenceManifestBytes, verificationBundleBytes,
    inventoryAttestationBytes: jcs(inventory), verificationAttestationBytes: jcs(verification), retentionReceiptBytes: jcs(retention) });
  return { contextBytes, envelope, bytes: jcs(envelope), evaluationTime: options.evaluationTime ?? at(30), verifier: () => createReferenceContentVerifier(contextBytes) };
}

export function revocationFixture(edits = {}, year = 2033, options = {}) {
  const source = referenceContentFixture(edits.content ?? {}, year, options), at = options.at ?? ((second) => `${year}-09-04T12:00:${String(second).padStart(2, '0')}Z`);
  const signRecord = options.seal ?? seal, until = options.until ?? at(59);
  const edit = (name, value) => { edits[name]?.(value); return value; }, contentContext = JSON.parse(source.contextBytes);
  const context = edit('context', { version: 'steer-reference-revocation-context/v1', contentContextBytes: source.contextBytes, environmentId: null, tombstoneRecordId: 'tombstone-evidence-1' });
  const contextBytes = jcs(context), configDigest = sha256(contextBytes), selector = { organization: contentContext.organization, itemId: contentContext.itemId,
    environmentId: context.environmentId, recordId: contentContext.recordId, recordClass: 'RC-REFERENCED-EVIDENCE', artifactRevision: contentContext.artifactRevision };
  const selectorDigest = sha256(jcs(selector));
  const event = edit('event', { ...JSON.parse(makeLifecycleEventBytes('reference-revocation-authorized', 1)), ...selector, policySha256: RETENTION_POLICY_SHA,
    actorId: 'human:records-owner', actorAuthority: 'privacy-legal-records-owner', occurredAt: at(23), providerRecordId: 'reference-event-provider-1',
    authorizationRecordId: 'reference-owner-1', referenceInventorySha256: contentContext.referenceManifestDigest,
    verificationBundleSha256: contentContext.verificationBundleDigest, tombstoneRecordId: context.tombstoneRecordId });
  const eventBindingDigest = sha256(jcs(Object.fromEntries(Object.entries(event).filter(([field]) => !['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'].includes(field)))));
  const providerProof = signRecord(edit('event-provider', { providerRecordId: event.providerRecordId, eventId: event.eventId, eventBindingDigest, recordedAt: event.occurredAt }), 'provider');
  const signedEvent = signRecord({ ...event, providerProofBytes: jcs(providerProof), providerProofDigest: providerProof.recordDigest }, 'record');
  const bundle = makeHumanAuthorityBundle(), emit = (field, record, domain) => { const signed = signRecord(edit(field, record), domain); bundle[field] = jcs(signed); return signed; };
  const identity = emit('identityEvidenceBytes', { ...JSON.parse(bundle.identityEvidenceBytes), verifiedAt: at(18) }, 'provider');
  const qualification = emit('qualificationEvidenceBytes', { ...JSON.parse(bundle.qualificationEvidenceBytes), validThrough: until }, 'provider');
  const assignment = emit('assignmentEvidenceBytes', { ...JSON.parse(bundle.assignmentEvidenceBytes), validThrough: until }, 'assignment');
  const inventory = emit('inventoryBytes', { ...JSON.parse(bundle.inventoryBytes), capturedAt: at(17), items: [{ recordId: selector.recordId,
    recordClass: selector.recordClass, artifactRevision: selector.artifactRevision, selectorDigest }] }, 'record');
  const authority = { ...JSON.parse(bundle.authorityBytes), version: 'steer-qualified-reference-decision/v1', authorityType: 'qualified-reference-decision',
    authorityId: 'reference-owner-1', identityEvidenceDigest: identity.recordDigest, qualificationEvidenceDigest: qualification.recordDigest,
    qualificationValidThrough: qualification.validThrough, assignmentEvidenceDigest: assignment.recordDigest, assignmentValidThrough: assignment.validThrough,
    authenticatedAt: at(19), decidedAt: at(20), validFrom: at(0), expiresAt: until, selectorInventoryDigest: inventory.recordDigest,
    decisionKind: 'reference-revocation-authorized', eventId: event.eventId, eventBindingDigest, referenceInventoryDigest: contentContext.referenceManifestDigest,
    verificationBundleDigest: contentContext.verificationBundleDigest, tombstoneRecordId: context.tombstoneRecordId, referenceState: 'active', holdState: 'none',
    providerTrustAnchorDigest: sha256(JSON.parse(contentContext.currentRegistryBytes).bindings.find((entry) => entry.keyId === 'human-provider-key-current').publicKeyHex),
    conditions: [`event:${eventBindingDigest}`, `selector:${selectorDigest}`, `references:${contentContext.referenceManifestDigest}`,
      `verification:${contentContext.verificationBundleDigest}`, `tombstone:${context.tombstoneRecordId}`],
    safeguards: ['exact-record-scope', 'independent-provider-proof', 'retained-verification', 'separate-disposition-authority'] };
  for (const field of ['copyInventoryDigest', 'allowedCopyProviders', 'sourceOriginalExcluded', 'deadlineSeconds', 'eraseMethod', 'terminalEventId']) delete authority[field];
  edit('authority', authority);
  const humanProvider = emit('providerProofBytes', { ...JSON.parse(bundle.providerProofBytes), authorityBindingDigest: humanAuthorityBindingDigest(authority), recordedAt: authority.decidedAt }, 'human-provider');
  const signedAuthority = emit('authorityBytes', { ...authority, providerProofDigest: humanProvider.recordDigest }, 'authority');
  emit('replayLedgerBytes', { ...JSON.parse(bundle.replayLedgerBytes), snapshotAt: at(20), validThrough: until }, 'replay-authority');
  emit('casHeadBytes', { ...JSON.parse(bundle.casHeadBytes), snapshotAt: at(20), validThrough: until }, 'cas-authority');
  const reservation = emit('casReservationBytes', { ...JSON.parse(bundle.casReservationBytes), authorityDigest: signedAuthority.recordDigest,
    requestDigest: signedAuthority.recordDigest, recordedAt: at(21), validThrough: until }, 'cas-authority');
  bundle.evaluationTime = source.evaluationTime; edit('human-bundle', bundle);
  const common = { configDigest, policyDigest: revocationPolicy, eventDigest: signedEvent.recordDigest, authorityDigest: signedAuthority.recordDigest,
    reservationDigest: reservation.recordDigest, referenceManifestDigest: contentContext.referenceManifestDigest, verificationBundleDigest: contentContext.verificationBundleDigest,
    tombstoneRecordId: context.tombstoneRecordId, validThrough: until };
  const manifest = JSON.parse(source.envelope.referenceManifestBytes);
  const receipts = manifest.references.map((reference, index) => signRecord(edit(`receipt-${index}`, { ...common, kind: 'reference-removal-receipt', source: 'authoritative-reference-store',
    receiptId: `receipt-${index}`, referenceId: reference.referenceId, referenceSha256: sha256(jcs(reference)), afterRevision: 'e'.repeat(40), status: 'removed', remainingMatches: 0,
    recordedAt: at(24 + index) }), 'provider'));
  const completion = signRecord(edit('completion', { ...common, kind: 'reference-revocation-completion', source: 'authoritative-reference-state', receiptDigests: receipts.map((record) => record.recordDigest),
    referenceCount: receipts.length, referenceState: 'cleared', remainingReferenceIds: [], recordedAt: at(26) }), 'record');
  const envelope = edit('envelope', { version: 'steer-reference-revocation/v1', policyDigest: revocationPolicy, contentBytes: source.bytes, eventBytes: jcs(signedEvent),
    humanBundleBytes: jcs(bundle), referenceReceiptBytes: receipts.map(jcs), completionBytes: jcs(completion) });
  return { contextBytes, source, envelope, bytes: jcs(envelope), evaluationTime: source.evaluationTime, verifier: () => createReferenceRevocationVerifier(contextBytes) };
}
