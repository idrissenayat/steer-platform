import assert from 'node:assert/strict';
import test from 'node:test';
import { referenceContentFixture as fixture, revocationFixture, seal } from './fixtures/reference-evidence.mjs';
import { jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
function denied(value, evaluationTime = value.evaluationTime) {
  const result = value.verifier().verify(value.bytes, evaluationTime);
  assert.equal(result.state, 'blocked'); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
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
