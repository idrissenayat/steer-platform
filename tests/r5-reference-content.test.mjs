import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createReferenceContentVerifier, policyDigest } from '../intent/0086/reference-content.candidate.mjs';
import { createReferenceRevocationVerifier, policyDigest as revocationPolicy } from '../intent/0087/reference-revocation.candidate.mjs';
import { humanAuthorityBindingDigest } from '../intent/0058/human-authority.candidate.mjs';
import { makeHumanAuthorityBundle, makeLifecycleEventBytes } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { TRUST_REGISTRY, RETENTION_POLICY_SHA, jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const keys = new Map();
function key(domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(`steer-0086-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  return keys.get(domain);
}
function seal(record, domain) {
  const payload = Object.fromEntries(Object.entries(record).filter(([field]) => !['recordDigest', 'signature'].includes(field))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-current`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), key(domain)).toString('base64') } };
}
function fixture(edits = {}, year = 2033) {
  const at = (second) => `${year}-09-04T12:00:${String(second).padStart(2, '0')}Z`, edit = (name, value) => { edits[name]?.(value); return value; };
  const registry = structuredClone(TRUST_REGISTRY);
  for (const domain of ['provider', 'record', 'authority', 'human-provider', 'assignment', 'replay-authority', 'cas-authority']) registry.bindings.push({ domain, keyId: `${domain}-key-current`, algorithm: 'Ed25519',
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
    verificationInventoryDigest, versionCount: manifest.versions.length, referenceCount: manifest.references.length, validThrough: at(59) };
  const inventory = seal(edit('inventory', { ...common, kind: 'reference-inventory-attestation', source: 'authoritative-reference-inventory',
    completeVersions: true, completeReferences: true, recordedAt: at(10) }), 'provider');
  const verification = seal(edit('verification', { ...common, kind: 'reference-verification-attestation', source: 'authoritative-reference-verifier',
    inventoryAttestationDigest: inventory.recordDigest, result: 'verified', recordedAt: at(11) }), 'record');
  const retention = seal(edit('retention', { ...common, kind: 'reference-verification-retention', source: 'authoritative-verification-archive',
    verificationAttestationDigest: verification.recordDigest, archiveReference: context.verificationArchive, retainedBytesDigest: verificationBundleDigest,
    complete: true, recordedAt: at(12) }), 'authority');
  const envelope = edit('envelope', { version: 'steer-reference-content/v1', policyDigest, referenceManifestBytes, verificationBundleBytes,
    inventoryAttestationBytes: jcs(inventory), verificationAttestationBytes: jcs(verification), retentionReceiptBytes: jcs(retention) });
  return { contextBytes, envelope, bytes: jcs(envelope), evaluationTime: at(30), verifier: () => createReferenceContentVerifier(contextBytes) };
}
function denied(value, evaluationTime = value.evaluationTime) {
  const result = value.verifier().verify(value.bytes, evaluationTime);
  assert.equal(result.state, 'blocked'); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
}

function revocationFixture(edits = {}, year = 2033) {
  const source = fixture(edits.content ?? {}, year), at = (second) => `${year}-09-04T12:00:${String(second).padStart(2, '0')}Z`;
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
  const providerProof = seal(edit('event-provider', { providerRecordId: event.providerRecordId, eventId: event.eventId, eventBindingDigest, recordedAt: event.occurredAt }), 'provider');
  const signedEvent = seal({ ...event, providerProofBytes: jcs(providerProof), providerProofDigest: providerProof.recordDigest }, 'record');
  const bundle = makeHumanAuthorityBundle(), emit = (field, record, domain) => { const signed = seal(edit(field, record), domain); bundle[field] = jcs(signed); return signed; };
  const identity = emit('identityEvidenceBytes', { ...JSON.parse(bundle.identityEvidenceBytes), verifiedAt: at(18) }, 'provider');
  const qualification = emit('qualificationEvidenceBytes', { ...JSON.parse(bundle.qualificationEvidenceBytes), validThrough: at(59) }, 'provider');
  const assignment = emit('assignmentEvidenceBytes', { ...JSON.parse(bundle.assignmentEvidenceBytes), validThrough: at(59) }, 'assignment');
  const inventory = emit('inventoryBytes', { ...JSON.parse(bundle.inventoryBytes), capturedAt: at(17), items: [{ recordId: selector.recordId,
    recordClass: selector.recordClass, artifactRevision: selector.artifactRevision, selectorDigest }] }, 'record');
  const authority = { ...JSON.parse(bundle.authorityBytes), version: 'steer-qualified-reference-decision/v1', authorityType: 'qualified-reference-decision',
    authorityId: 'reference-owner-1', identityEvidenceDigest: identity.recordDigest, qualificationEvidenceDigest: qualification.recordDigest,
    qualificationValidThrough: qualification.validThrough, assignmentEvidenceDigest: assignment.recordDigest, assignmentValidThrough: assignment.validThrough,
    authenticatedAt: at(19), decidedAt: at(20), validFrom: at(0), expiresAt: at(59), selectorInventoryDigest: inventory.recordDigest,
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
  emit('replayLedgerBytes', { ...JSON.parse(bundle.replayLedgerBytes), snapshotAt: at(20), validThrough: at(59) }, 'replay-authority');
  emit('casHeadBytes', { ...JSON.parse(bundle.casHeadBytes), snapshotAt: at(20), validThrough: at(59) }, 'cas-authority');
  const reservation = emit('casReservationBytes', { ...JSON.parse(bundle.casReservationBytes), authorityDigest: signedAuthority.recordDigest,
    requestDigest: signedAuthority.recordDigest, recordedAt: at(21), validThrough: at(59) }, 'cas-authority');
  bundle.evaluationTime = source.evaluationTime; edit('human-bundle', bundle);
  const common = { configDigest, policyDigest: revocationPolicy, eventDigest: signedEvent.recordDigest, authorityDigest: signedAuthority.recordDigest,
    reservationDigest: reservation.recordDigest, referenceManifestDigest: contentContext.referenceManifestDigest, verificationBundleDigest: contentContext.verificationBundleDigest,
    tombstoneRecordId: context.tombstoneRecordId, validThrough: at(59) };
  const manifest = JSON.parse(source.envelope.referenceManifestBytes);
  const receipts = manifest.references.map((reference, index) => seal(edit(`receipt-${index}`, { ...common, kind: 'reference-removal-receipt', source: 'authoritative-reference-store',
    receiptId: `receipt-${index}`, referenceId: reference.referenceId, referenceSha256: sha256(jcs(reference)), afterRevision: 'e'.repeat(40), status: 'removed', remainingMatches: 0,
    recordedAt: at(24 + index) }), 'provider'));
  const completion = seal(edit('completion', { ...common, kind: 'reference-revocation-completion', source: 'authoritative-reference-state', receiptDigests: receipts.map((record) => record.recordDigest),
    referenceCount: receipts.length, referenceState: 'cleared', remainingReferenceIds: [], recordedAt: at(26) }), 'record');
  const envelope = edit('envelope', { version: 'steer-reference-revocation/v1', policyDigest: revocationPolicy, contentBytes: source.bytes, eventBytes: jcs(signedEvent),
    humanBundleBytes: jcs(bundle), referenceReceiptBytes: receipts.map(jcs), completionBytes: jcs(completion) });
  return { contextBytes, source, envelope, bytes: jcs(envelope), evaluationTime: source.evaluationTime, verifier: () => createReferenceRevocationVerifier(contextBytes) };
}

test('0087: qualified owner, actual event and exact-set removal compose with retained reference content', () => {
  for (const year of [2027, 2029, 2033]) {
    const value = revocationFixture({}, year), result = value.verifier().verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'verified-reference-revocation'); assert.equal(result.referenceCount, 2); assert.equal(result.tombstoneRecordId, 'tombstone-evidence-1');
    assert.equal(result.factOnly, true); assert.equal(result.currentActionAuthorityRequired, true); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
  }
  const held = revocationFixture({ authority: (record) => { record.holdState = 'active'; } });
  assert.equal(held.verifier().verify(held.bytes, held.evaluationTime).holdState, 'active');
});

test('0087: every content, event/provider and full human proof remains required in composition', () => {
  for (const field of ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes', 'assignmentEvidenceBytes',
    'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes']) denied(revocationFixture({ 'human-bundle': (bundle) => { bundle[field] = '{}'; } }));
  for (const field of ['contentBytes', 'eventBytes', 'humanBundleBytes', 'completionBytes']) denied(revocationFixture({ envelope: (record) => { record[field] = '{}'; } }));
  denied(revocationFixture({ envelope: (record) => {
    const event = JSON.parse(record.eventBytes), provider = JSON.parse(event.providerProofBytes); provider.signature.valueBase64 = Buffer.alloc(64).toString('base64');
    event.providerProofBytes = jcs(provider); record.eventBytes = jcs(seal(event, 'record'));
  } }));
  denied(revocationFixture({ content: { inventory: (record) => { record.completeReferences = false; } } }));
});

test('0087: event actor/hat, exact owner selector and inventory/bundle/tombstone identities cannot diverge', () => {
  for (const [name, field, replacement] of [
    ['event', 'actorId', 'human:other'], ['event', 'actorAuthority', 'other'], ['event', 'authorizationRecordId', 'other'],
    ['event', 'referenceInventorySha256', 'f'.repeat(64)], ['event', 'verificationBundleSha256', 'f'.repeat(64)], ['event', 'tombstoneRecordId', 'other'],
    ['event', 'recordId', 'other'], ['event', 'artifactRevision', 'f'.repeat(40)], ['event', 'policySha256', 'f'.repeat(64)],
    ['authority', 'eventBindingDigest', 'f'.repeat(64)], ['authority', 'referenceState', 'cleared'], ['authority', 'referenceInventoryDigest', 'f'.repeat(64)],
    ['authority', 'verificationBundleDigest', 'f'.repeat(64)], ['authority', 'tombstoneRecordId', 'other'],
    ['authority', 'conditions', ['other']], ['authority', 'safeguards', ['one', 'two', 'three', 'four']],
  ]) denied(revocationFixture({ [name]: (record) => { record[field] = replacement; } }));
  denied(revocationFixture({ inventoryBytes: (record) => { record.items[0].selectorDigest = 'f'.repeat(64); } }));
  denied(revocationFixture({ inventoryBytes: (record) => { record.items[0].recordId = 'other'; } }));
});

test('0087: approval follows retained verification and reservation precedes committed event exactly', () => {
  denied(revocationFixture({ content: { retention: (record) => { record.recordedAt = '2033-09-04T12:00:22Z'; } } }));
  denied(revocationFixture({ casReservationBytes: (record) => { record.recordedAt = '2033-09-04T12:00:23.000000001Z'; } }));
  denied(revocationFixture({ inventoryBytes: (record) => { record.capturedAt = '2033-09-04T12:00:09Z'; } }));
  const equal = revocationFixture({ casReservationBytes: (record) => { record.recordedAt = '2033-09-04T12:00:23Z'; } });
  assert.equal(equal.verifier().verify(equal.bytes, equal.evaluationTime).state, 'verified-reference-revocation');
  const value = revocationFixture(); assert.equal(value.verifier().verify(value.bytes).state, 'blocked'); denied(value, '2033-09-04T12:00:59Z');
});

test('0087: every exact reference removal and independent completion must be present and current', () => {
  for (const mutate of [(record) => record.referenceReceiptBytes.pop(), (record) => record.referenceReceiptBytes.reverse(),
    (record) => record.referenceReceiptBytes.push(record.referenceReceiptBytes[0]), (record) => { record.referenceReceiptBytes[1] = record.referenceReceiptBytes[0]; }])
    denied(revocationFixture({ envelope: mutate }));
  for (const [name, field, replacement] of [
    ['receipt-0', 'status', 'pending'], ['receipt-1', 'remainingMatches', 1], ['receipt-1', 'receiptId', 'receipt-0'],
    ['receipt-0', 'afterRevision', 'c'.repeat(40)], ['receipt-0', 'referenceSha256', 'f'.repeat(64)], ['receipt-0', 'referenceId', 'other'],
    ['receipt-0', 'eventDigest', 'f'.repeat(64)], ['receipt-1', 'authorityDigest', 'f'.repeat(64)], ['receipt-1', 'reservationDigest', 'f'.repeat(64)],
    ['completion', 'referenceCount', 1], ['completion', 'referenceState', 'active'], ['completion', 'remainingReferenceIds', ['ref-1']],
    ['completion', 'receiptDigests', []], ['completion', 'source', 'caller'],
  ]) denied(revocationFixture({ [name]: (record) => { record[field] = replacement; } }));
  for (const field of ['completionBytes', 'referenceReceiptBytes']) denied(revocationFixture({ envelope: (input) => {
    const bytes = field === 'referenceReceiptBytes' ? input[field][1] : input[field], record = JSON.parse(bytes);
    record.signature.valueBase64 = Buffer.alloc(64).toString('base64');
    if (field === 'referenceReceiptBytes') input[field][1] = jcs(record); else input[field] = jcs(record);
  } }));
  denied(revocationFixture({ envelope: (input) => { input.completionBytes = jcs(seal(JSON.parse(input.completionBytes), 'provider')); } }));
});

test('0087: removal/completion chronology, source revision consistency and retention horizon cannot drift', () => {
  for (const [name, field, replacement] of [['receipt-0', 'recordedAt', '2033-09-04T12:00:22Z'], ['receipt-1', 'recordedAt', '2033-09-04T12:00:23Z'],
    ['completion', 'recordedAt', '2033-09-04T12:00:24Z'], ['receipt-1', 'validThrough', '2033-09-04T12:01:00Z'],
    ['completion', 'validThrough', '2033-09-04T12:01:00Z'], ['receipt-1', 'validThrough', '2033-09-04T12:00:58Z']])
    denied(revocationFixture({ [name]: (record) => { record[field] = replacement; } }));
  denied(revocationFixture({ content: { manifest: (record) => { record.references[1].sourcePath = record.references[0].sourcePath; } },
    'receipt-1': (record) => { record.afterRevision = 'f'.repeat(40); } }));
});

test('0087: trusted context, closed envelope and explicit bounds cannot grant a different operation', () => {
  for (const mutate of [(record) => { record.extra = true; }, (record) => { record.tombstoneRecordId = '*'; }])
    assert.throws(revocationFixture({ context: mutate }).verifier, /REFERENCE_REVOCATION_CONFIGURATION_INVALID/);
  for (const mutate of [(record) => { record.extra = true; }, (record) => { record.policyDigest = 'f'.repeat(64); },
    (record) => { record.version = 'steer-lifecycle-graph/current-v5'; }]) denied(revocationFixture({ envelope: mutate }));
  const value = revocationFixture(); assert.equal(value.verifier().verify(' '.repeat(8388609), value.evaluationTime).state, 'blocked');
});

test('0086: complete multi-version reference content and independent retained verification pass without effects', () => {
  for (const year of [2027, 2029, 2033]) {
    const value = fixture({}, year), result = value.verifier().verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'verified-reference-content'); assert.equal(result.referenceCount, 2); assert.equal(result.versionCount, 2);
    assert.equal(result.factOnly, true); assert.equal(result.qualifiedRevocationRequired, true); assert.equal(result.currentActionAuthorityRequired, true);
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
  }
});

test('0086: exact target/pins and complete sorted version/reference tuples cannot be substituted', () => {
  for (const field of ['referenceManifestDigest', 'verificationBundleDigest']) denied(fixture({ context: (record) => { record[field] = 'f'.repeat(64); } }));
  for (const mutate of [(record) => { record.recordId = 'other'; }, (record) => { record.versions = []; }, (record) => { record.references = []; },
    (record) => { record.versions.reverse(); }, (record) => { record.references.reverse(); },
    (record) => { record.references[1] = { ...record.references[0], referenceId: 'ref-2' }; },
    (record) => { record.versions.push(record.versions[0]); }, (record) => { record.references.push(record.references[0]); },
    (record) => { record.references[0].targetRecordId = 'other'; }, (record) => { record.references[0].targetVersionId = 'missing'; },
    (record) => { record.references[0].targetSha256 = 'f'.repeat(64); }, (record) => { record.references[0].sourceRevision = 'f'.repeat(39); },
    (record) => { record.references[0].sourceRepositoryId = 'other'; }, (record) => { record.references[0].sourcePath = '../file'; },
    (record) => { record.references[0].referenceId = '*'; }, (record) => { record.references[0].extra = true; }, (record) => { record.extra = true; },
  ]) denied(fixture({ manifest: mutate }));
});

test('0086: every reference has exactly one complete matching verification record, not a digest-only placeholder', () => {
  for (const mutate of [(record) => record.records.pop(), (record) => record.records.reverse(), (record) => record.records.push(record.records[0]),
    (record) => { record.records[0].referenceId = 'orphan'; }, (record) => { record.records[0].extra = true; },
    (record) => { record.referenceInventorySha256 = 'f'.repeat(64); }, (record) => { record.extra = true; },
  ]) denied(fixture({ bundle: mutate }));
  for (const [field, replacement] of [['referenceId', 'other'], ['referenceSha256', 'f'.repeat(64)], ['targetSha256', 'f'.repeat(64)],
    ['targetVersionId', 'other'], ['method', 'caller-assertion'], ['version', 'unknown']]) denied(fixture({ 'verification-1': (record) => { record[field] = replacement; } }));
  denied(fixture({ 'verification-0': (record) => { record.extra = true; } }));
  denied(fixture({ envelope: (record) => { record.verificationBundleBytes = sha256(record.verificationBundleBytes); } }));
});

test('0086: each independent current source signature and exact completeness/retention binding is required', () => {
  for (const field of ['inventoryAttestationBytes', 'verificationAttestationBytes', 'retentionReceiptBytes']) for (const corrupt of [false, true]) denied(fixture({ envelope: (input) => {
    if (!corrupt) input[field] = '{}'; else { const record = JSON.parse(input[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); input[field] = jcs(record); }
  } }));
  for (const [name, field, replacement] of [['inventory', 'completeVersions', false], ['inventory', 'completeReferences', false], ['inventory', 'source', 'caller'],
    ['verification', 'result', 'unknown'], ['verification', 'inventoryAttestationDigest', 'f'.repeat(64)], ['verification', 'referenceCount', 1],
    ['verification', 'verificationInventoryDigest', 'f'.repeat(64)], ['retention', 'complete', false], ['retention', 'retainedBytesDigest', 'f'.repeat(64)],
    ['retention', 'verificationAttestationDigest', 'f'.repeat(64)], ['retention', 'archiveReference', { repositoryId: 'steer-platform', revision: 'd'.repeat(40), path: 'other.json' }]])
    denied(fixture({ [name]: (record) => { record[field] = replacement; } }));
  denied(fixture({ envelope: (input) => { input.retentionReceiptBytes = jcs(seal(JSON.parse(input.retentionReceiptBytes), 'provider')); } }));
});

test('0086: source observations are current, ordered and exactly half-open at expiry', () => {
  for (const [name, field, replacement] of [['verification', 'recordedAt', '2033-09-04T12:00:09Z'], ['retention', 'recordedAt', '2033-09-04T12:00:10Z'],
    ['inventory', 'recordedAt', '2033-09-04T11:55:29Z'], ['retention', 'recordedAt', '2033-09-04T12:00:31Z'],
    ['verification', 'validThrough', '2033-09-04T12:01:00Z'], ['retention', 'validThrough', '2033-09-04T12:01:00Z']])
    denied(fixture({ [name]: (record) => { record[field] = replacement; } }));
  const value = fixture(); assert.equal(value.verifier().verify(value.bytes, '2033-09-04T12:00:58.999999999Z').state, 'verified-reference-content');
  denied(value, '2033-09-04T12:00:59Z'); assert.equal(value.verifier().verify(value.bytes).state, 'blocked');
});

test('0086: selected trust cannot alias roles, renew old keys or accept currently revoked source evidence', () => {
  for (const domain of ['provider', 'record', 'authority']) denied(fixture({ registry: (record) => {
    record.bindings.find((entry) => entry.keyId === `${domain}-key-current`).revokedAt = '2033-09-04T12:00:30Z';
  } }));
  assert.throws(fixture({ registry: (record) => { record.bindings.find((entry) => entry.keyId === 'authority-key-current').publicKeyHex =
    record.bindings.find((entry) => entry.keyId === 'record-key-current').publicKeyHex; } }).verifier, /REFERENCE_CONTENT_CONFIGURATION_INVALID/);
  assert.throws(fixture({ registry: (record) => { record.bindings[0].notAfter = '2040-01-01T00:00:00Z'; } }).verifier, /REFERENCE_CONTENT_CONFIGURATION_INVALID/);
});

test('0086: context/envelopes are closed and limits are measured in UTF-8 bytes', () => {
  const bounded = (count) => fixture({ manifest: (manifest) => {
    const seed = manifest.references[0];
    manifest.references = Array.from({ length: count }, (_, index) => ({ ...seed, referenceId: `ref-${String(index).padStart(3, '0')}`,
      sourcePath: `proof/${index}.json` }));
  } });
  const maximum = bounded(128); assert.equal(maximum.verifier().verify(maximum.bytes, maximum.evaluationTime).state, 'verified-reference-content');
  denied(bounded(129));
  for (const mutate of [(record) => { record.extra = true; }, (record) => { record.verificationArchive.path = '../bundle.json'; },
    (record) => { record.verificationArchive.repositoryId = 'other'; }]) assert.throws(fixture({ context: mutate }).verifier, /REFERENCE_CONTENT_CONFIGURATION_INVALID/);
  for (const mutate of [(record) => { record.extra = true; }, (record) => { record.policyDigest = 'f'.repeat(64); },
    (record) => { record.referenceManifestBytes += ' '; }, (record) => { record.verificationBundleBytes = ' '.repeat(2097153); }]) denied(fixture({ envelope: mutate }));
  const value = fixture(), verifier = value.verifier();
  assert.equal(verifier.verify('é'.repeat(2097153), value.evaluationTime).state, 'blocked');
  assert.equal(verifier.verify(' '.repeat(4194305), value.evaluationTime).state, 'blocked');
});
