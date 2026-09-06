import assert from 'node:assert/strict';
import { test } from 'node:test';
import { identityProofFixture } from './gate-identity-fixture.ts';
import { briefWriteAuthoritySchema } from '@steer/tool-registry';

test('real identity signature binds issuer, human and exact historical session without granting authority', () => {
  const f = identityProofFixture(), result = f.evaluate(); assert.ok(result);
  assert.equal(result.proofDigest, f.expected().identityEvidenceDigest); assert.equal(result.trustDigest, f.digest(f.trust));
  assert.equal(result.claims.subject, f.provider.expected.subject); assert.equal(result.claims.identityIssuer, f.trust.identityIssuer);
  assert.equal(result.currentSourceVerificationRequired, true); assert.equal(result.qualificationVerificationRequired, true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.claims));
  assert.equal(briefWriteAuthoritySchema.safeParse(result).success, false);
  // A historical session may have naturally expired after signing, before evaluation.
  assert.ok(String(result.claims.authenticationExpiresAt) < result.evaluatedAt);
});

test('authentic signatures cannot substitute issuer, subject, session, authentication time or evidence digest', () => {
  for (const change of [{ organizationId: 'foreign' }, { repository: 'github:2' }, { identityIssuer: 'https://other.synthetic.invalid' },
    { subject: 'other-human' }, { sessionId: 'other-session' }, { authenticatedAt: '2026-09-06T12:00:00.100000001Z' },
    { identityEvidenceDigest: 'f'.repeat(64) }]) {
    const f = identityProofFixture(); assert.equal(f.evaluate(f.encode(), { ...f.expected(), ...change }), null);
  }
});

test('scoped trust, key identity, tamper resistance and signature domain remain mandatory', () => {
  for (const change of [{ organizationId: 'foreign' }, { repository: 'github:2' }, { identityIssuer: 'https://foreign.synthetic.invalid' },
    { attestor: 'https://other.synthetic.invalid' }, { keyId: 'other-key' }, { publicKeyHex: 'f'.repeat(64) }]) {
    const f = identityProofFixture(); assert.equal(f.evaluate(f.encode(), f.expected(), { ...f.trust, ...change }), null);
  }
  const f = identityProofFixture(), original = f.encode();
  for (const proof of [{ ...original, payload: original.payload.replace('synthetic-human', 'tampered-human') },
    { ...original, signatureBase64: Buffer.alloc(64).toString('base64') }, f.raw(original.payload, 'steer-gate-provider-attestation/v1\0')]) {
    assert.equal(f.evaluate(proof, { ...f.expected(), identityEvidenceDigest: f.digest(proof) }), null);
  }
});

test('closed compact encoding excludes tokens, agents, duplicate keys and misleading canonicalization', () => {
  const f = identityProofFixture();
  for (const text of [JSON.stringify({ ...f.payload, type: 'agent' }), JSON.stringify({ ...f.payload, accessToken: 'synthetic-not-a-token' }),
    JSON.stringify(f.payload, null, 2), JSON.stringify(Object.fromEntries(Object.entries(f.payload).reverse())),
    JSON.stringify(f.payload).replace('"type":"human"', '"type":"agent","type":"human"'), '\ud800', 'x'.repeat(16385)]) {
    const proof = f.raw(text); assert.equal(f.evaluate(proof, { ...f.expected(), identityEvidenceDigest: f.digest(proof) }), null);
  }
  assert.equal(f.evaluate({ ...f.encode(), extra: true }), null); assert.equal(f.evaluate(null), null);
});

test('exact authentication and recording chronology includes half-open session expiry', () => {
  for (const [change, allowed] of [
    [{ authenticationExpiresAt: '2026-09-06T12:00:00.200000001Z' }, true],
    [{ authenticationExpiresAt: '2026-09-06T12:00:00.200000000Z' }, false],
    [{ authenticationExpiresAt: '2026-09-06T12:00:00.100000000Z' }, false],
    [{ recordedAt: '2026-09-06T12:00:00.099999999Z' }, false],
    [{ recordedAt: '2026-09-06T12:00:00.300000001Z' }, false],
    [{ recordedAt: '2026-09-06T12:00:00.350000000Z' }, false],
    [{ recordedAt: '2026-09-06T12:00:00.1500000001Z' }, false],
  ] as const) { const f = identityProofFixture(); Object.assign(f.payload, change); assert.equal(f.evaluate() !== null, allowed); }
  for (const change of [{ signedAt: '2026-09-06T12:00:00.099999999Z' }, { providerRecordedAt: '2026-09-06T12:00:00.199999999Z' },
    { providerRecordedAt: '2026-09-06T12:00:00.400000001Z' }]) {
    const f = identityProofFixture(); assert.equal(f.evaluate(f.encode(), { ...f.expected(), ...change }), null);
  }
});

test('pre-key authentication, key expiry and current revocation cannot borrow later trust', () => {
  for (const [change, allowed] of [
    [{ notBefore: '2026-09-06T12:00:00.100000000Z' }, true],
    [{ notBefore: '2026-09-06T12:00:00.100000001Z' }, false],
    [{ notAfter: '2026-09-06T12:00:00.400000000Z' }, false],
    [{ notAfter: '2026-09-06T12:00:00.400000001Z' }, true],
    [{ revokedAt: '2026-09-06T12:00:00.400000000Z' }, false],
    [{ revokedAt: '2026-09-06T12:00:00.400000001Z' }, true],
    [{ revokedAt: '2026-09-06T11:59:59Z' }, false],
    [{ revokedAt: '2026-09-06T12:02:00Z' }, false],
    [{ notBefore: '2026-09-06T12:02:00Z' }, false],
  ] as const) { const f = identityProofFixture(); assert.equal(f.evaluate(f.encode(), f.expected(), { ...f.trust, ...change }) !== null, allowed); }
});

test('timestamps, malformed keys and unrecognized receipt formats fail closed without leaking content', () => {
  const f = identityProofFixture();
  for (const time of [null, 123, '2026-02-30T12:00:00Z', '2026-09-06T12:00:00.4+00:00', '2026-09-06T12:00:00.4000000001Z']) {
    assert.equal(f.evaluate(f.encode(), f.expected(), f.trust, time), null);
  }
  for (const proof of [{ type: 'provider-recorded', provider: 'openai-codex' }, { ...f.encode(), signatureBase64: 'bad' },
    { ...f.encode(), version: 'steer-gate-provider-proof/v1' }]) assert.equal(f.evaluate(proof), null);
});
