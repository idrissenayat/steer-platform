import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createHistoricalEventVerifier, policyDigest } from '../intent/0078/historical-events.candidate.mjs';
import { correctedLifecycleEventDecision, correctionPolicyDigest as eventPolicy } from '../intent/0059/lifecycle-events.candidate.mjs';
import { makeLifecycleEventBytes } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { LIFECYCLE_EVENT_EXTRAS } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, RETENTION_POLICY_SHA, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const keys = new Map();
function key(domain, fresh = false) {
  const id = `${domain}:${fresh}`;
  if (!keys.has(id)) keys.set(id, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(fresh ? `steer-0078-future-${domain}` : `steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  return keys.get(id);
}
function seal(input, domain, fresh = false) {
  const payload = Object.fromEntries(Object.entries(input).filter(([field]) => !['recordDigest', 'signature'].includes(field))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-${fresh ? 'future' : 'v1'}`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), key(domain, fresh)).toString('base64') } };
}
function fixture(options = {}) {
  const edit = (name, value) => { options.edits?.[name]?.(value); return value; }, year = options.year ?? 2033;
  const at = (second) => `${year}-09-04T12:00:${String(second).padStart(2, '0')}Z`, evaluationTime = at(50);
  const config = { version: 'steer-historical-event-context/v1', scope: { organization: 'steer-platform', itemId: '0001-flight-deck-foundation', environmentId: null },
    recordId: 'retained-record-1', recordClass: 'RC-DECISION-PROOF', artifactRevision: 'b'.repeat(40),
    archiveReference: { repositoryId: 'steer-platform', revision: 'd'.repeat(40), path: 'evidence/retained-history.json' },
    historyDigest: '', observedAt: '2026-09-04T13:00:00Z', currentRegistryBytes: '' };
  const allBytes = (options.types ?? ['record-committed', 'item-closed']).map((type, index) => {
    const event = edit(`event-${index}`, { ...JSON.parse(makeLifecycleEventBytes(type, index + 1)), recordId: config.recordId,
      recordClass: config.recordClass, artifactRevision: config.artifactRevision, policySha256: RETENTION_POLICY_SHA });
    const payload = Object.fromEntries(Object.entries(event).filter(([field]) => !['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'].includes(field)));
    const proof = seal(edit(`proof-${index}`, { providerRecordId: event.providerRecordId, eventId: event.eventId, eventBindingDigest: sha256(jcs(payload)), recordedAt: event.occurredAt }), 'provider');
    event.providerProofBytes = jcs(proof); event.providerProofDigest = proof.recordDigest;
    return jcs(seal(event, 'record'));
  });
  config.historyDigest = sha256(jcs(allBytes));
  const registry = structuredClone(TRUST_REGISTRY);
  for (const domain of ['authority', 'provider']) registry.bindings.push({ domain, keyId: `${domain}-key-future`, algorithm: 'Ed25519',
    publicKeyHex: createPublicKey(key(domain, true)).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: `${year}-01-01T00:00:00Z`, notAfter: `${year + 1}-01-01T00:00:00Z`, revokedAt: null });
  edit('registry', registry); config.currentRegistryBytes = jcs(registry); edit('config', config);
  const configBytes = jcs(config), configDigest = sha256(configBytes);
  const inventory = allBytes.map((bytes) => { const event = JSON.parse(bytes), proof = JSON.parse(event.providerProofBytes); return {
    eventId: event.eventId, bytesDigest: sha256(bytes), recordDigest: event.recordDigest, providerBytesDigest: sha256(event.providerProofBytes), providerDigest: proof.recordDigest, occurredAt: event.occurredAt,
  }; });
  const common = { configDigest, policyDigest, registryDigest: sha256(config.currentRegistryBytes), historyDigest: config.historyDigest,
    inventoryDigest: sha256(jcs(inventory)), archiveReference: config.archiveReference, observedAt: config.observedAt, recordCount: allBytes.length,
    recordedAt: at(30), validThrough: `${year}-09-04T12:02:00Z` };
  const attestation = seal(edit('attestation', { ...common, kind: 'historical-event-attestation', source: 'authoritative-history-revalidator', decision: 'historical-facts-verified' }), 'authority', true);
  const receipt = seal(edit('receipt', { ...common, recordedAt: at(31), kind: 'historical-event-retention', source: 'authoritative-archive-store',
    attestationDigest: attestation.recordDigest, retainedBytesDigest: config.historyDigest, complete: true }), 'provider', true);
  const envelope = edit('envelope', { version: 'steer-historical-events/v1', policyDigest, eventBytes: allBytes.at(-1), historyBytes: allBytes.slice(0, -1),
    attestationBytes: jcs(attestation), retentionReceiptBytes: jcs(receipt) });
  return { config, configBytes, envelope, bytes: jcs(envelope), evaluationTime, verifier: () => createHistoricalEventVerifier(configBytes) };
}
function denied(value, now = value.evaluationTime) {
  const result = value.verifier().verify(value.bytes, now);
  assert.equal(result.state, 'blocked'); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
}

test('0078: one-, three- and seven-year historical events require new current attestations, not extended original keys', () => {
  for (const year of [2027, 2029, 2033]) {
    const value = fixture({ year }), original = jcs({ version: 'steer-r5-001-events/v1', policyDigest: eventPolicy, scope: value.config.scope,
      eventBytes: value.envelope.eventBytes, historyBytes: value.envelope.historyBytes, evaluationTime: value.evaluationTime });
    assert.equal(correctedLifecycleEventDecision(original).state, 'blocked-policy-conflict');
    const result = value.verifier().verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'verified-historical-events'); assert.equal(result.verifiedEventCount, 2);
    assert.equal(result.factOnly, true); assert.equal(result.currentActionAuthorityRequired, true);
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    for (const old of TRUST_REGISTRY.bindings) assert.deepEqual(JSON.parse(value.config.currentRegistryBytes).bindings.find((entry) => entry.domain === old.domain && entry.keyId === old.keyId), old);
  }
});

test('0078: all 27 closed kinds retain complete original signature/schema verification after rotation', () => {
  for (const type of Object.keys(LIFECYCLE_EVENT_EXTRAS)) {
    const value = fixture({ types: [type] }); assert.equal(value.verifier().verify(value.bytes, value.evaluationTime).state, 'verified-historical-events', type);
  }
  for (const [name, field, replacement] of [['event-0', 'recordId', 'other'], ['event-0', 'recordClass', 'RC-REBUILDABLE'], ['event-0', 'artifactRevision', 'c'.repeat(40)],
    ['event-0', 'policySha256', 'f'.repeat(64)], ['proof-0', 'eventBindingDigest', 'f'.repeat(64)], ['proof-0', 'recordedAt', '2026-09-04T12:00:00Z']])
    denied(fixture({ edits: { [name]: (record) => { record[field] = replacement; } } }));
});

test('0078: original anchors cannot be replaced, omitted or extended through the trusted-current configuration seam', () => {
  for (const mutate of [
    (registry) => { registry.bindings[0].notAfter = '2040-01-01T00:00:00Z'; },
    (registry) => { registry.bindings[0].notBefore = '2000-01-01T00:00:00Z'; },
    (registry) => { registry.bindings[0].publicKeyHex = 'a'.repeat(64); },
    (registry) => { registry.bindings.shift(); },
    (registry) => { registry.bindings.push(registry.bindings[0]); },
  ]) assert.throws(fixture({ edits: { registry: mutate } }).verifier, /HISTORICAL_EVENT_CONFIGURATION_INVALID/);
  for (const mutate of [(config) => { config.extra = true; }, (config) => { config.archiveReference.path = '../outside'; },
    (config) => { config.historyDigest = 'bad'; }, (config) => { config.currentRegistryBytes = '{}'; }])
    assert.throws(fixture({ edits: { config: mutate } }).verifier, /HISTORICAL_EVENT_CONFIGURATION_INVALID/);
});

test('0078: historical compromise revocation denies even after a valid original observation', () => {
  for (const domain of ['record', 'provider']) {
    for (const revokedAt of ['2026-09-04T12:00:00Z', '2028-01-01T00:00:00Z', '2033-09-04T12:00:50Z'])
      denied(fixture({ edits: { registry: (registry) => { registry.bindings.find((key) => key.domain === domain && key.keyId.endsWith('v1')).revokedAt = revokedAt; } } }));
    const value = fixture({ edits: { registry: (registry) => { registry.bindings.find((key) => key.domain === domain && key.keyId.endsWith('v1')).revokedAt = '2033-09-04T12:00:50.000000001Z'; } } });
    assert.equal(value.verifier().verify(value.bytes, value.evaluationTime).state, 'verified-historical-events');
  }
});

test('0078: fresh current attestation and retained-byte receipt are independently timed and exact-bound', () => {
  for (const name of ['attestation', 'receipt']) for (const [field, replacement] of [
    ['configDigest', 'f'.repeat(64)], ['policyDigest', 'f'.repeat(64)], ['registryDigest', 'f'.repeat(64)], ['historyDigest', 'f'.repeat(64)], ['inventoryDigest', 'f'.repeat(64)],
    ['recordCount', 1], ['observedAt', '2026-09-04T14:00:00Z'], ['source', 'caller'], ['recordedAt', '2033-09-04T12:00:51Z'], ['validThrough', '2033-09-04T12:00:50Z'],
    ['validThrough', '2033-09-04T12:10:00Z'], ['archiveReference', { repositoryId: 'other', revision: 'd'.repeat(40), path: 'other.json' }],
  ]) denied(fixture({ edits: { [name]: (record) => { record[field] = replacement; } } }));
  for (const [field, replacement] of [['attestationDigest', 'f'.repeat(64)], ['retainedBytesDigest', 'f'.repeat(64)], ['complete', false], ['recordedAt', '2033-09-04T12:00:29.999999999Z']])
    denied(fixture({ edits: { receipt: (record) => { record[field] = replacement; } } }));
  const value = fixture(); denied(value, '2033-09-04T12:02:00Z'); denied(value, '2033-09-04T12:05:51Z');
  assert.equal(value.verifier().verify(value.bytes, '2033-09-04T12:01:59.999999999Z').state, 'verified-historical-events');
});

test('0078: wrong-domain, forged, expired and non-independent current keys cannot attest historical validity', () => {
  for (const field of ['attestationBytes', 'retentionReceiptBytes']) for (const domain of ['authority', 'provider'])
    if ((field === 'attestationBytes') !== (domain === 'authority')) denied(fixture({ edits: { envelope: (input) => { input[field] = jcs(seal(JSON.parse(input[field]), domain, true)); } } }));
  for (const field of ['attestationBytes', 'retentionReceiptBytes']) denied(fixture({ edits: { envelope: (input) => {
    const record = JSON.parse(input[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); input[field] = jcs(record);
  } } }));
  for (const domain of ['authority', 'provider']) for (const field of ['notAfter', 'revokedAt']) denied(fixture({ edits: { registry: (registry) => {
    registry.bindings.find((key) => key.domain === domain && key.keyId.endsWith('future'))[field] = '2033-09-04T12:00:50Z';
  } } }));
  // Same public key in two role labels is not independent evidence.
  denied(fixture({ edits: { registry: (registry) => { registry.bindings.find((key) => key.keyId === 'provider-key-future').publicKeyHex =
    registry.bindings.find((key) => key.keyId === 'authority-key-future').publicKeyHex; }, envelope: (input) => {
    const receipt = seal(JSON.parse(input.retentionReceiptBytes), 'authority', true); receipt.signature.keyId = 'provider-key-future'; input.retentionReceiptBytes = jcs(receipt);
  } } }));
});

test('0078: truncation, reordered or substituted archive bytes and digest-only evidence fail closed', () => {
  for (const mutate of [
    (input) => { input.historyBytes = []; }, (input) => { input.historyBytes.push(input.eventBytes); },
    (input) => { const original = input.eventBytes; input.eventBytes = input.historyBytes[0]; input.historyBytes[0] = original; },
    (input) => { input.historyBytes[0] += ' '; }, (input) => { input.attestationBytes = '{}'; },
    (input) => { input.retentionReceiptBytes = '{}'; }, (input) => { input.extra = true; },
    (input) => { input.currentRegistryBytes = jcs(TRUST_REGISTRY); }, (input) => { input.version = 'steer-r5-001-events/v1'; },
  ]) denied(fixture({ edits: { envelope: mutate } }));
  denied(fixture({ edits: { config: (config) => { config.historyDigest = 'f'.repeat(64); } } }));
});

test('0078: original observation and bounded history remain explicit, not future action authority', () => {
  for (const observedAt of ['2026-09-04T12:00:00Z', '2027-09-01T00:00:00Z', '2034-01-01T00:00:00Z'])
    denied(fixture({ edits: { config: (config) => { config.observedAt = observedAt; } } }));
  const maximum = fixture({ types: Array(129).fill('record-committed') });
  assert.equal(maximum.verifier().verify(maximum.bytes, maximum.evaluationTime).verifiedEventCount, 129);
  denied(fixture({ types: Array(130).fill('record-committed') }));
  const value = fixture(); denied({ ...value, bytes: ' '.repeat(12582913) });
  denied(fixture({ edits: { envelope: (input) => { input.attestationBytes = ' '.repeat(65537); } } }));
});
