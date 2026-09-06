import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createReferenceContentVerifier, policyDigest } from '../intent/0086/reference-content.candidate.mjs';
import { TRUST_REGISTRY, jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
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
  for (const domain of ['provider', 'record', 'authority']) registry.bindings.push({ domain, keyId: `${domain}-key-current`, algorithm: 'Ed25519',
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
