import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { correctedLifecycleEventDecision as corrected, correctionPolicyDigest } from '../intent/0059/lifecycle-events.candidate.mjs';
import { makeLifecycleEventBytes, mutateLifecycleEventBytes, makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { lifecycleEventDecision as frozen, LIFECYCLE_EVENT_EXTRAS } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, sealRecord, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { lifecycleEventFollows, eventOrderPolicyDigest } from '../intent/0071/event-order.candidate.mjs';

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

const ranked = [['hold-applied', 10], ['hold-released', 10], ['record-superseded', 15], ['corpus-version-superseded', 15],
  ['corpus-retired', 15], ['environment-retired', 15], ['expiry-due', 20], ['deletion-requested', 30], ['deletion-completed', 40], ['tombstone-committed', 50]];
const tiedAt = '2026-09-04T12:00:00.123456789Z';
const tied = (type, index, patch = {}, proofPatch = {}) => signedEvent(makeLifecycleEventBytes(type, index), { occurredAt: tiedAt, ...patch }, proofPatch);

test('0071: all 200 signed equal-time rank/UUID pairings follow the policy tuple, never caller array order', () => {
  for (const [leftType, leftRank] of ranked) for (const [rightType, rightRank] of ranked) for (const ascendingId of [true, false]) {
    const left = tied(leftType, ascendingId ? 1 : 2), right = tied(rightType, ascendingId ? 2 : 1);
    const expected = rightRank > leftRank || (rightRank === leftRank && ascendingId);
    const result = corrected(envelope(right, [left]));
    assert.equal(result.state, expected ? 'validated-trigger' : 'blocked-policy-conflict', `${leftType}/${rightType}/${ascendingId}`);
    assert.deepEqual(result.effects, zeroEffects());
  }
  const timeline = ranked.map(([type], index) => tied(type, index + 1));
  assert.equal(corrected(envelope(timeline.at(-1), timeline.slice(0, -1))).verifiedHistoryCount, 9);
  assert.match(eventOrderPolicyDigest, /^[0-9a-f]{64}$/);
});

test('0071: ties never waive exact signatures, closed schemas, provider proofs or UUID replay checks', () => {
  const first = tied('hold-applied', 1), next = tied('expiry-due', 2);
  for (const prior of [tied('hold-applied', 1, { ordinal: 0 }), tied('hold-applied', 1, {}, { eventBindingDigest: 'f'.repeat(64) }),
    tied('hold-applied', 1, {}, { recordedAt: '2026-09-04T12:00:00.123456788Z' }), tied('hold-applied', 1, { organization: 'foreign' })])
    assert.equal(corrected(envelope(next, [prior])).state, 'blocked-policy-conflict');
  const corrupted = JSON.parse(first); corrupted.signature.valueBase64 = Buffer.alloc(64).toString('base64');
  assert.equal(corrected(envelope(next, [jcs(corrupted)])).state, 'blocked-policy-conflict');
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const lower = tied('hold-applied', 1, { eventId: id });
  for (const occurredAt of [tiedAt, '2026-09-04T12:00:00.123456790Z']) {
    const upper = tied('expiry-due', 2, { eventId: id.toUpperCase(), occurredAt });
    assert.equal(corrected(envelope(upper, [lower])).firstError, 'EVENT_REPLAY');
  }
  const original = [...schemaSafeTypes()];
  for (const type of original.filter((type) => !ranked.some(([name]) => name === type))) {
    assert.equal(corrected(envelope(tied(type, 2), [first])).firstError, 'EVENT_ORDER_INVALID', type);
    assert.equal(corrected(envelope(next, [tied(type, 1)])).firstError, 'EVENT_ORDER_INVALID', type);
  }
});
function schemaSafeTypes() { return Object.keys(LIFECYCLE_EVENT_EXTRAS); }

test('0071: exact instants precede rank, mixed zero fractions compare equally and capacity remains bounded', () => {
  const earlier = tied('tombstone-committed', 1), later = tied('hold-applied', 2, { occurredAt: '2026-09-04T12:00:00.123456790Z' });
  assert.equal(corrected(envelope(later, [earlier])).state, 'validated-trigger');
  assert.equal(corrected(envelope(earlier, [later])).firstError, 'EVENT_ORDER_INVALID');
  const zero = tied('hold-applied', 1, { occurredAt: '2026-09-04T12:00:00Z' });
  assert.equal(corrected(envelope(tied('expiry-due', 2, { occurredAt: '2026-09-04T12:00:00.000000000Z' }), [zero])).state, 'validated-trigger');
  const maximum = Array.from({ length: 129 }, (_, index) => tied('hold-applied', index + 1));
  assert.equal(corrected(envelope(maximum.at(-1), maximum.slice(0, -1))).verifiedHistoryCount, 128);
  assert.equal(corrected(envelope(tied('expiry-due', 130), maximum)).firstError, 'EVENT_ENVELOPE_INVALID');
  for (const bad of [undefined, {}, { eventId: 'bad', eventType: 'hold-applied', occurredAt: tiedAt }]) {
    assert.equal(lifecycleEventFollows(null, bad), false);
    assert.equal(lifecycleEventFollows(bad, JSON.parse(later)), false);
  }
});
