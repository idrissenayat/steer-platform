import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criticRunnerFixture } from './gate-critic-proof-fixture.ts';
import { reviewRunnerFixture } from './gate-review-fixture.ts';

test('actual Critic runner signature binds exact report and execution claims but never grants gate or isolation authority', () => {
  const f = criticRunnerFixture(), result = f.evaluate(); assert.ok(result);
  assert.deepEqual(result.claims, f.payload); assert.equal(result.proofDigest, f.expected().proofDigest);
  assert.equal(result.trustDigest, f.digest(f.trust)); assert.equal(result.validBefore, f.trust.notAfter);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.claims));
  for (const key of ['governedRunnerSelectionRequired', 'runnerIsolationVerificationRequired', 'currentSourceVerificationRequired'] as const) assert.equal(result[key], true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
});

test('every selected Critic scope, provider, task, configuration, Builder and byte binding must match independently', () => {
  const f = criticRunnerFixture();
  for (const key of Object.keys(f.expected())) {
    const value = key === 'gate' ? 3 : key === 'artifactRevision' ? 'c'.repeat(40) : key.endsWith('Digest') ? 'c'.repeat(64) :
      key === 'reviewedAt' ? '2026-09-06T12:00:00.200000001Z' : 'foreign';
    assert.equal(f.evaluate(f.encode(), { ...f.expected(), [key]: value }), null, key);
  }
  for (const change of [{ organizationId: 'foreign' }, { repository: 'github:2' }, { gate: 3 }, { reviewerProvider: 'foreign' },
    { reviewerTask: '/foreign' }, { configurationRevision: 'other' }, { keyId: 'other' },
    { attestor: 'https://foreign.synthetic.invalid' }, { publicKeyHex: 'f'.repeat(64) }]) assert.equal(f.evaluate(f.encode(), f.expected(), { ...f.trust, ...change }), null);
});

test('tampering, wrong signature domains and domain-review receipts cannot substitute Critic provenance', () => {
  const f = criticRunnerFixture(), original = f.encode();
  for (const proof of [{ ...original, payload: original.payload.replace('critic-run-1', 'critic-run-2') },
    { ...original, signatureBase64: Buffer.alloc(64).toString('base64') }, f.raw(original.payload, 'steer-domain-review-runner-attestation/v1\0'),
    reviewRunnerFixture().encode()]) assert.equal(f.evaluate(proof, { ...f.expected(), proofDigest: f.digest(proof) }), null);
});

test('signed contradictory context claims, same Builder task and shared execution IDs fail closed', () => {
  for (const change of [{ inheritedConversation: true }, { priorConclusionsTreatedAsAuthority: true }, { builderIndependent: false },
    { builderTask: '/synthetic/critic' }, { builderExecutionId: 'critic-run-1' }]) {
    const f = criticRunnerFixture(); Object.assign(f.payload, change); assert.equal(f.evaluate(), null);
  }
});

test('Critic runner chronology and current trust use exact nanosecond half-open boundaries', () => {
  for (const [change, allowed] of [
    [{ startedAt: '2026-09-06T11:59:59.999999999Z' }, false], [{ startedAt: '2026-09-06T12:00:00.200000000Z' }, true],
    [{ startedAt: '2026-09-06T12:00:00.200000001Z' }, false], [{ recordedAt: '2026-09-06T12:00:00.199999999Z' }, false],
    [{ recordedAt: '2026-09-06T12:00:00.400000000Z' }, true], [{ recordedAt: '2026-09-06T12:00:00.400000001Z' }, false],
  ] as const) { const f = criticRunnerFixture(); Object.assign(f.payload, change); assert.equal(f.evaluate() !== null, allowed); }
  for (const [change, allowed] of [
    [{ notBefore: '2026-09-06T12:00:00.100000001Z' }, false], [{ notAfter: '2026-09-06T12:00:00.400000000Z' }, false],
    [{ notAfter: '2026-09-06T12:00:00.400000001Z' }, true], [{ revokedAt: '2026-09-06T12:00:00.400000000Z' }, false],
    [{ revokedAt: '2026-09-06T12:00:00.400000001Z' }, true], [{ revokedAt: '2026-09-06T11:00:00Z' }, false],
    [{ revokedAt: '2026-09-06T13:00:00Z' }, false],
  ] as const) { const f = criticRunnerFixture(); assert.equal(f.evaluate(f.encode(), f.expected(), { ...f.trust, ...change }) !== null, allowed); }
  const f = criticRunnerFixture(); f.trust.revokedAt = '2026-09-06T12:00:00.400000001Z'; assert.equal(f.evaluate()!.validBefore, f.trust.revokedAt);
});

test('strict compact bounded encoding rejects unknown authority, duplicate fields, malformed UTF-8 and unsigned native metadata', () => {
  const f = criticRunnerFixture();
  for (const content of [JSON.stringify(f.payload, null, 2), JSON.stringify(Object.fromEntries(Object.entries(f.payload).reverse())),
    JSON.stringify({ ...f.payload, accessToken: 'synthetic-not-a-token' }), JSON.stringify({ ...f.payload, passed: true }),
    JSON.stringify(f.payload).replace('"gate":2', '"gate":3,"gate":2'), '\ud800', 'x'.repeat(16385)]) {
    const proof = f.raw(content); assert.equal(f.evaluate(proof, { ...f.expected(), proofDigest: f.digest(proof) }), null);
  }
  for (const proof of [null, { version: 'steer-critic-review/v1' }, { ...f.encode(), extra: true }]) assert.equal(f.evaluate(proof), null);
  for (const at of [null, 1, '2026-02-30T00:00:00Z', '2026-09-06T12:00:00.4000000001Z']) assert.equal(f.evaluate(f.encode(), f.expected(), f.trust, at), null);
});
