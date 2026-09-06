import assert from 'node:assert/strict';
import { test } from 'node:test';
import { briefWriteAuthoritySchema } from '@steer/tool-registry';
import { qualificationProofFixture } from './gate-qualification-fixture.ts';

test('real scoped qualification signature yields only required verified domains and never gate authority', () => {
  const f = qualificationProofFixture(), result = f.evaluate(); assert.ok(result);
  assert.deepEqual(result.qualifiedDomains, ['privacy']); assert.deepEqual(result.claims.domains, ['privacy', 'security']);
  assert.equal(result.proofDigest, f.expected().qualificationEvidenceDigest);
  assert.equal(result.currentSourceVerificationRequired, true); assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  for (const value of [result, result.claims, result.claims.domains, result.qualifiedDomains]) assert.ok(Object.isFrozen(value));
  assert.equal(briefWriteAuthoritySchema.safeParse(result).success, false);
});

test('authentic signatures cannot qualify another human, issuer, organization or repository', () => {
  for (const change of [{ subject: 'other' }, { identityIssuer: 'https://other.invalid' }, { organizationId: 'foreign' },
    { repository: 'github:2' }, { qualificationEvidenceDigest: 'f'.repeat(64) }]) {
    const f = qualificationProofFixture(); assert.equal(f.evaluate(f.encode(), { ...f.expected(), ...change }), null);
  }
  const f = qualificationProofFixture(); f.payload.type = 'agent'; assert.equal(f.evaluate(), null);
});

test('domain authority is bounded, nonempty, unique and ordered without unsupported qualification claims', () => {
  for (const domains of [[], ['privacy', 'privacy'], ['security', 'privacy'], ['money'], ['unsupported']]) {
    const f = qualificationProofFixture(); f.payload.domains = domains; assert.equal(f.evaluate(), null);
  }
  const f = qualificationProofFixture();
  assert.equal(f.evaluate(f.encode(), { ...f.expected(), requiredDomains: ['money'] }), null);
  assert.equal(f.evaluate(f.encode(), { ...f.expected(), requiredDomains: [] }), null);
  assert.equal(f.evaluate(f.encode(), f.expected(), { ...f.trust, domains: ['privacy'] }), null); // May not sign security at all.
});

test('qualification existed before signing and remains current at exact nanosecond boundaries', () => {
  for (const [change, allowed] of [
    [{ recordedAt: '2026-09-06T12:00:00.200000000Z' }, true],
    [{ recordedAt: '2026-09-06T12:00:00.200000001Z' }, false],
    [{ validAfter: '2026-09-06T12:00:00.150000001Z' }, false],
    [{ validThrough: '2026-09-06T12:00:00.400000000Z' }, false],
    [{ validThrough: '2026-09-06T12:00:00.400000001Z' }, true],
    [{ validThrough: '2026-09-06T12:00:00.200000000Z' }, false],
    [{ validAfter: '2026-09-06T12:01:00Z' }, false],
    [{ revokedAt: '2026-09-06T12:00:00.400000000Z' }, false],
    [{ revokedAt: '2026-09-06T12:00:00.400000001Z' }, true],
    [{ revokedAt: '2026-09-06T11:59:59Z' }, false],
    [{ revokedAt: '2026-09-06T12:00:31Z' }, false],
  ] as const) { const f = qualificationProofFixture(); Object.assign(f.payload, change); assert.equal(f.evaluate() !== null, allowed); }
});

test('key activation, expiry, revocation, identity and actual cryptographic signature cannot be bypassed', () => {
  for (const change of [{ notBefore: '2026-09-06T12:00:00.150000001Z' }, { notAfter: '2026-09-06T12:00:00.400Z' },
    { revokedAt: '2026-09-06T12:00:00.399999999Z' }, { publicKeyHex: 'f'.repeat(64) }, { keyId: 'another-key' },
    { attestor: 'https://other.invalid' }, { identityIssuer: 'https://other.invalid' }]) {
    const f = qualificationProofFixture(); assert.equal(f.evaluate(f.encode(), f.expected(), { ...f.trust, ...change }), null);
  }
  const f = qualificationProofFixture();
  for (const proof of [{ ...f.encode(), signatureBase64: Buffer.alloc(64).toString('base64') }, f.raw(JSON.stringify(f.payload), 'steer-gate-identity-attestation/v1\0')]) {
    assert.equal(f.evaluate(proof, { ...f.expected(), qualificationEvidenceDigest: f.digest(proof) }), null);
  }
});

test('closed encoding, source limits and exact timestamp grammar cannot hide extra fields or unsupported records', () => {
  const f = qualificationProofFixture();
  for (const text of [JSON.stringify(f.payload, null, 2), JSON.stringify({ ...f.payload, approve: true }),
    JSON.stringify(f.payload).replace('"type":"human"', '"type":"agent","type":"human"'), '\ud800', 'x'.repeat(16385)]) {
    const proof = f.raw(text); assert.equal(f.evaluate(proof, { ...f.expected(), qualificationEvidenceDigest: f.digest(proof) }), null);
  }
  for (const time of [null, '2026-02-30T12:00:00Z', '2026-09-06T12:00:00.4000000001Z', '2026-09-06T12:00:00.1Z']) assert.equal(f.evaluate(f.encode(), f.expected(), f.trust, time), null);
  assert.equal(f.evaluate({ type: 'provider-recorded', provider: 'openai-codex' }), null);
});
