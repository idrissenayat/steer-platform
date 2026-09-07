import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectionProofFixture } from './gate-selection-proof-fixture.ts';
import { criticRunnerFixture } from './gate-critic-proof-fixture.ts';

test('selected-key proof binds exact policy selection without approving bootstrap, selector, reviews or writes', () => {
  const f = selectionProofFixture(), result = f.evaluate(); assert.ok(result);
  assert.deepEqual(result.claims, f.payload); assert.equal(result.trustDigest, f.expected().trustDigest);
  assert.equal(result.proofDigest, f.expected().proofDigest); assert.equal(result.validBefore, f.payload.validBefore);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.claims));
  for (const key of ['trustBootstrapVerificationRequired', 'selectorAuthorizationVerificationRequired',
    'currentSourceVerificationRequired', 'reviewAuthenticityVerificationRequired'] as const) assert.equal(result[key], true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
});

test('every externally expected selection coordinate and both independent digest pins are mandatory', () => {
  const f = selectionProofFixture();
  for (const key of Object.keys(f.expected())) {
    const value = key === 'platformRevision' ? 'e'.repeat(40) : key.endsWith('Digest') ? 'e'.repeat(64) :
      key === 'selectedAt' ? '2026-09-07T12:00:00.100000001Z' : 'foreign';
    assert.equal(f.evaluate(f.encode(), { ...f.expected(), [key]: value }), null, key);
    const missing = { ...f.expected() } as Record<string, unknown>; delete missing[key]; assert.equal(f.evaluate(f.encode(), missing), null, key);
  }
});

test('repinned foreign trust scope, issuer, selector, key or public key cannot substitute the selected attestor', () => {
  const f = selectionProofFixture();
  for (const change of [{ organizationId: 'foreign' }, { repository: 'github:2' }, { branch: 'other' },
    { selectorSubject: 'other' }, { attestor: 'https://other.synthetic.invalid' }, { keyId: 'other' }, { publicKeyHex: 'f'.repeat(64) }]) {
    const trust = { ...f.trust, ...change };
    assert.equal(f.evaluate(f.encode(), { ...f.expected(), trustDigest: f.digest(trust) }, trust), null);
  }
  const altered = { ...f.trust, notAfter: '2026-09-07T12:02:00Z' };
  assert.equal(f.evaluate(f.encode(), f.expected(), altered), null, 'even a valid extended key window needs a new independent pin');
});

test('tampering, foreign signature domains, invalid encodings and Critic receipts cannot become selection authority', () => {
  const f = selectionProofFixture(), original = f.encode();
  for (const proof of [{ ...original, payload: original.payload.replace('synthetic-selection-1', 'synthetic-selection-2') },
    { ...original, signatureBase64: Buffer.alloc(64).toString('base64') },
    { ...original, signatureBase64: original.signatureBase64.slice(0, -2) },
    f.raw(original.payload, 'steer-critic-runner-attestation/v1\0'), criticRunnerFixture().encode()]) {
    assert.equal(f.evaluate(proof, { ...f.expected(), proofDigest: f.digest(proof) }), null);
  }
});

test('selection event chronology, proof expiry and current trust use exact nanosecond half-open boundaries', () => {
  for (const [change, allowed] of [
    [{ selectedAt: '2026-09-07T11:59:59.999999999Z' }, false], [{ selectedAt: '2026-09-07T12:00:00.200000001Z' }, false],
    [{ selectedAt: '2026-09-07T12:00:00.200000000Z' }, true], [{ recordedAt: '2026-09-07T12:00:00.099999999Z' }, false],
    [{ recordedAt: '2026-09-07T12:00:00.300000001Z' }, false], [{ recordedAt: '2026-09-07T12:00:00.300000000Z' }, true],
    [{ validBefore: '2026-09-07T12:00:00.300000000Z' }, false], [{ validBefore: '2026-09-07T12:00:00.300000001Z' }, true],
    [{ validBefore: '2026-09-07T12:01:00.000000001Z' }, false], [{ validBefore: '2026-09-07T12:01:00Z' }, true],
  ] as const) { const f = selectionProofFixture(); Object.assign(f.payload, change); assert.equal(f.evaluate() !== null, allowed, JSON.stringify(change)); }
  for (const [change, allowed] of [
    [{ notBefore: '2026-09-07T12:00:00.100000001Z' }, false], [{ notAfter: '2026-09-07T12:00:29.999999999Z' }, false],
    [{ notAfter: '2026-09-07T12:00:30Z' }, true], [{ notAfter: '2026-09-07T12:00:00Z' }, false],
    [{ revokedAt: '2026-09-07T12:00:00.300000000Z' }, false], [{ revokedAt: '2026-09-07T12:00:00.300000001Z' }, true],
    [{ revokedAt: '2026-09-07T11:59:59Z' }, false], [{ revokedAt: '2026-09-07T12:01:00.000000001Z' }, false],
  ] as const) { const f = selectionProofFixture(); Object.assign(f.trust, change); assert.equal(f.evaluate() !== null, allowed, JSON.stringify(change)); }
  const f = selectionProofFixture(); f.trust.revokedAt = '2026-09-07T12:00:00.300000001Z';
  assert.equal(f.evaluate()!.validBefore, f.trust.revokedAt);
  assert.equal(f.evaluate(f.encode(), f.expected(), f.trust, '2026-09-07T12:00:00.300000001Z'), null);
});

test('strict bounded encodings reject duplicate fields, extra authority, malformed Unicode and reordered records', () => {
  const f = selectionProofFixture();
  for (const content of [JSON.stringify(f.payload, null, 2), JSON.stringify(Object.fromEntries(Object.entries(f.payload).reverse())),
    JSON.stringify({ ...f.payload, approved: true }), JSON.stringify({ ...f.payload, accessToken: 'synthetic-not-a-token' }),
    JSON.stringify(f.payload).replace('{', '{"selectionId":"discarded",'), '\ud800', 'x'.repeat(16385),
    JSON.stringify({ ...f.payload, selectorSubject: 'synthetic\u0000selector' }),
    JSON.stringify({ ...f.payload, selectionPath: '../outside.json' })]) {
    const proof = f.raw(content); assert.equal(f.evaluate(proof, { ...f.expected(), proofDigest: f.digest(proof) }), null);
  }
  for (const proof of [null, {}, { ...f.encode(), extra: true }, Object.fromEntries(Object.entries(f.encode()).reverse())]) assert.equal(f.evaluate(proof), null);
  for (const trust of [null, {}, { ...f.trust, approved: true }, Object.fromEntries(Object.entries(f.trust).reverse())]) {
    assert.equal(f.evaluate(f.encode(), { ...f.expected(), trustDigest: f.digest(trust) }, trust), null);
  }
  for (const at of [null, 1, '2026-02-30T00:00:00Z', '2026-09-07T12:00:00.3000000001Z', '2026-09-07T11:59:59Z']) assert.equal(f.evaluate(f.encode(), f.expected(), f.trust, at), null);
});
