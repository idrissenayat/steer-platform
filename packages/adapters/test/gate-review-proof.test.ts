import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewRunnerFixture } from './gate-review-fixture.ts';

test('actual runner signature binds the complete native report and selected execution without issuing authority', () => {
  const f = reviewRunnerFixture(), result = f.evaluate(); assert.ok(result);
  assert.deepEqual(result.claims, f.payload); assert.equal(result.proofDigest, f.expected().proofDigest);
  assert.equal(result.trustDigest, f.digest(f.trust)); assert.equal(result.validBefore, f.trust.notAfter);
  for (const key of ['governedRunnerSelectionRequired', 'runnerIsolationVerificationRequired', 'currentSourceVerificationRequired'] as const) assert.equal(result[key], true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.claims));
});

test('every external target, reviewer, configuration, Builder, run and original byte binding is mandatory', () => {
  const f = reviewRunnerFixture();
  for (const key of Object.keys(f.expected()) as (keyof ReturnType<typeof f.expected>)[]) {
    const wanted = { ...f.expected(), [key]: key === 'artifactRevision' ? 'd'.repeat(40) : key.endsWith('Digest') ? 'd'.repeat(64) :
      key === 'domain' ? 'security' : key === 'reportPath' ? 'other.json' : key === 'reviewedAt' ? '2026-09-06T12:00:00.200000001Z' : 'foreign' };
    assert.equal(f.evaluate(f.encode(), wanted), null, key);
  }
  for (const change of [{ domain: 'security' }, { organizationId: 'other' }, { repository: 'github:2' }, { reviewerSubject: 'different-agent' },
    { configurationRevision: 'different-config' }, { attestor: 'https://other.synthetic.invalid' }, { keyId: 'other-key' }, { publicKeyHex: 'f'.repeat(64) }]) {
    assert.equal(f.evaluate(f.encode(), f.expected(), { ...f.trust, ...change }), null);
  }
});

test('tampered signatures and foreign signature domains reject even after proof repinning', () => {
  const f = reviewRunnerFixture(), proof = f.encode();
  for (const candidate of [{ ...proof, payload: proof.payload.replace('review-run-1', 'review-run-2') },
    { ...proof, signatureBase64: Buffer.alloc(64).toString('base64') }, f.raw(proof.payload, 'steer-gate-identity-attestation/v1\0')]) {
    assert.equal(f.evaluate(candidate, { ...f.expected(), proofDigest: f.digest(candidate) }), null);
  }
});

test('authenticated contrary independence claims and identical agent or execution identities cannot pass', () => {
  for (const change of [{ inheritedConversation: true }, { priorConclusionsTreatedAsAuthority: true }, { builderIndependent: false },
    { builderSubject: 'reviewer-agent' }, { builderExecutionId: 'review-run-1' }]) {
    const f = reviewRunnerFixture(); Object.assign(f.payload, change); assert.equal(f.evaluate(), null);
  }
});

test('exact runner chronology and current half-open trust windows include nanosecond boundaries', () => {
  for (const [change, allowed] of [
    [{ startedAt: '2026-09-06T11:59:59.999999999Z' }, false],
    [{ startedAt: '2026-09-06T12:00:00.200000001Z' }, false],
    [{ startedAt: '2026-09-06T12:00:00.200000000Z' }, true],
    [{ recordedAt: '2026-09-06T12:00:00.199999999Z' }, false],
    [{ recordedAt: '2026-09-06T12:00:00.400000001Z' }, false],
    [{ recordedAt: '2026-09-06T12:00:00.400000000Z' }, true],
  ] as const) { const f = reviewRunnerFixture(); Object.assign(f.payload, change); assert.equal(f.evaluate() !== null, allowed); }
  for (const [change, allowed] of [
    [{ notBefore: '2026-09-06T12:00:00.100000001Z' }, false],
    [{ notAfter: '2026-09-06T12:00:00.400000000Z' }, false],
    [{ notAfter: '2026-09-06T12:00:00.400000001Z' }, true],
    [{ revokedAt: '2026-09-06T12:00:00.400000000Z' }, false],
    [{ revokedAt: '2026-09-06T12:00:00.400000001Z' }, true],
    [{ revokedAt: '2026-09-06T11:00:00Z' }, false],
    [{ revokedAt: '2026-09-06T13:00:00Z' }, false],
  ] as const) { const f = reviewRunnerFixture(); assert.equal(f.evaluate(f.encode(), f.expected(), { ...f.trust, ...change }) !== null, allowed); }
  const f = reviewRunnerFixture(); f.trust.revokedAt = '2026-09-06T12:00:00.400000001Z';
  assert.equal(f.evaluate()!.validBefore, f.trust.revokedAt);
});

test('closed schema-ordered UTF-8 profile cannot carry duplicate fields, credentials, authority or native unsigned records', () => {
  const f = reviewRunnerFixture();
  for (const value of [JSON.stringify(f.payload, null, 2), JSON.stringify(Object.fromEntries(Object.entries(f.payload).reverse())),
    JSON.stringify({ ...f.payload, accessToken: 'not-a-real-token' }), JSON.stringify({ ...f.payload, gateVerified: true }),
    JSON.stringify(f.payload).replace('"inheritedConversation":false', '"inheritedConversation":true,"inheritedConversation":false'),
    '\ud800', 'x'.repeat(16385)]) {
    const proof = f.raw(value); assert.equal(f.evaluate(proof, { ...f.expected(), proofDigest: f.digest(proof) }), null);
  }
  for (const proof of [null, { version: 'steer-domain-review-record/v1' }, { ...f.encode(), extra: true }]) assert.equal(f.evaluate(proof), null);
  for (const value of [null, '2026-02-30T12:00:00Z', '2026-09-06T12:00:00.4000000001Z']) assert.equal(f.evaluate(f.encode(), f.expected(), f.trust, value), null);
});
