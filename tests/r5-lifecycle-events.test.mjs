import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { correctedLifecycleEventDecision as corrected, correctionPolicyDigest } from '../intent/0059/lifecycle-events.candidate.mjs';
import { makeLifecycleEventBytes, mutateLifecycleEventBytes, makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { lifecycleEventDecision as frozen, LIFECYCLE_EVENT_EXTRAS } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, sealRecord, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

const context = (eventBytes, historyBytes = []) => ({ version: 'steer-r5-001-events/v1', policyDigest: correctionPolicyDigest,
  scope: { organization: 'steer-platform', itemId: '0001-flight-deck-foundation', environmentId: null }, eventBytes, historyBytes, evaluationTime: '2026-09-04T13:00:00Z' });
const envelope = (eventBytes, historyBytes = []) => jcs(context(eventBytes, historyBytes));
// Private synthetic provider signer. Ordinary-event signer is the frozen test-only capability.
const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update('steer-r3-r1-provider').digest()]), format: 'der', type: 'pkcs8' });
function signedEvent(bytes, patch = {}, proofPatch = {}) {
  const event = { ...JSON.parse(bytes), ...patch };
  const payload = Object.fromEntries(Object.entries(event).filter(([field]) => !['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'].includes(field)));
  const proof = { providerRecordId: event.providerRecordId, eventId: event.eventId, eventBindingDigest: sha256(jcs(payload)), recordedAt: event.occurredAt, ...proofPatch };
  const digest = sha256(jcs(proof)); proof.recordDigest = digest;
  proof.signature = { algorithm: 'Ed25519', keyId: 'provider-key-v1', signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') };
  event.providerProofBytes = jcs(proof); event.providerProofDigest = digest; return jcs(sealRecord(event));
}

test('R5-001: corrupted historical provider proof passes frozen history but is rejected by the successor', () => {
  const previous = JSON.parse(makeLifecycleEventBytes('record-committed', 1)), current = makeLifecycleEventBytes('record-committed', 2);
  const proof = JSON.parse(previous.providerProofBytes); proof.signature.valueBase64 = Buffer.alloc(64).toString('base64');
  previous.providerProofBytes = jcs(proof); const corrupt = jcs(sealRecord(previous));
  assert.equal(frozen(current, jcs([corrupt])).state, 'validated-trigger');
  const result = corrected(envelope(current, [corrupt])); assert.equal(result.state, 'blocked-policy-conflict'); assert.deepEqual(result.effects, zeroEffects());
  const valid = corrected(envelope(current, [makeLifecycleEventBytes('record-committed', 1)]));
  assert.equal(valid.state, 'validated-trigger'); assert.equal(valid.verifiedHistoryCount, 1);
});

test('all 27 closed event kinds and five prior negative kinds retain expected outcomes', () => {
  let index = 1; assert.equal(Object.keys(LIFECYCLE_EVENT_EXTRAS).length, 27);
  for (const type of Object.keys(LIFECYCLE_EVENT_EXTRAS)) assert.equal(corrected(envelope(makeLifecycleEventBytes(type, index++))).state, 'validated-trigger', type);
  const controls = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/CONTROL-FIXTURES.candidate.json', import.meta.url)));
  assert.equal(controls.lifecycleNegativeKinds.length, 5);
  for (const kind of controls.lifecycleNegativeKinds) assert.equal(corrected(envelope(mutateLifecycleEventBytes(makeLifecycleEventBytes('record-committed'), kind))).state, 'blocked-policy-conflict', kind);
  const surrogate = JSON.parse(makeLifecycleGraph('RC-FAILED-RUN', 'complete')).triggerBytes;
  assert.equal(corrected(envelope(surrogate)).firstError, 'EVENT_SCHEMA_INVALID');
});

test('every historical entry requires exact schema, scope, full provider binding and explicit proof time', () => {
  const current = makeLifecycleEventBytes('record-committed', 10), first = makeLifecycleEventBytes('record-committed', 1), middle = makeLifecycleEventBytes('record-committed', 2);
  const cases = [
    signedEvent(middle, {}, { eventBindingDigest: 'f'.repeat(64) }),
    signedEvent(middle, {}, { recordedAt: '2000-01-01T00:00:00Z' }),
    signedEvent(middle, {}, { providerRecordId: 'other-provider-id' }),
    signedEvent(middle, { organization: 'other-organization' }),
    signedEvent(middle, { itemId: 'other-item' }),
    signedEvent(middle, { environmentId: 'other-environment' }),
    signedEvent(middle, {}, { extra: true }),
    mutateLifecycleEventBytes(middle, 'extra-field'),
  ];
  for (const prior of cases) assert.equal(corrected(envelope(current, [first, prior])).state, 'blocked-policy-conflict');
});

test('event/proof reuse, time reversal, expired evaluation and envelope bounds cannot bypass history checks', () => {
  const first = makeLifecycleEventBytes('record-committed', 1), second = makeLifecycleEventBytes('record-committed', 2), current = makeLifecycleEventBytes('record-committed', 3);
  for (const history of [[first, first], [second, first], [current], [first, signedEvent(second, { providerRecordId: JSON.parse(first).providerRecordId })]])
    assert.equal(corrected(envelope(current, history)).state, 'blocked-policy-conflict');
  assert.equal(corrected(envelope(current, [first, signedEvent(second, { eventId: JSON.parse(first).eventId })])).firstError, 'EVENT_REPLAY');
  assert.equal(corrected(envelope(current, [first, signedEvent(second, { providerRecordId: JSON.parse(first).providerRecordId })])).firstError, 'EVENT_REPLAY');
  for (const patch of [{ evaluationTime: '2027-09-01T00:00:00Z' }, { evaluationTime: '2026-09-04T12:00:00Z' },
    { evaluationTime: 'invalid' }, { extra: true }, { policyDigest: '0'.repeat(64) }, { historyBytes: Array(129).fill(first) }, { eventBytes: 'x'.repeat(65537) }])
    assert.equal(corrected(jcs({ ...context(current), ...patch })).state, 'blocked-policy-conflict');
  for (const value of [null, {}, current, envelope(current) + ' ', 'x'.repeat(8388609)]) assert.equal(corrected(value).state, 'blocked-policy-conflict');
});
