// Test-only identity attestor. No runtime key, credential or receipt issuer.
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { providerProofFixture } from './gate-proof-fixture.ts';
import { verifyGateIdentityAttestation } from '../src/identity/gate-identity-proof.ts';
export function identityProofFixture(provider = providerProofFixture()) {
  const keys = generateKeyPairSync('ed25519'), identityIssuer = 'https://identity.synthetic.invalid';
  const trust = { version: 'steer-gate-identity-trust/v1', organizationId: provider.expected.organizationId,
    repository: provider.expected.repository, identityIssuer, attestor: 'https://attestor.synthetic.invalid', keyId: 'synthetic-identity-key',
    publicKeyHex: keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: '2026-09-06T12:00:00Z', notAfter: '2026-09-06T12:01:00Z', revokedAt: null as string | null };
  const payload: Record<string, unknown> = { version: 'steer-gate-identity-attestation/v1', organizationId: trust.organizationId,
    repository: trust.repository, identityIssuer, attestor: trust.attestor, keyId: trust.keyId, subject: provider.expected.subject,
    type: 'human', sessionId: provider.expected.sessionId, authenticatedAt: provider.expected.authenticatedAt,
    authenticationExpiresAt: '2026-09-06T12:00:00.350000000Z', recordedAt: '2026-09-06T12:00:00.150000000Z' };
  const raw = (text: string, prefix = 'steer-gate-identity-attestation/v1\0') => ({ version: 'steer-gate-identity-proof/v1', payload: text,
    signatureBase64: sign(null, Buffer.from(prefix + text), keys.privateKey).toString('base64') });
  const encode = () => raw(JSON.stringify(payload));
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const expected = () => ({ organizationId: provider.expected.organizationId, repository: provider.expected.repository, identityIssuer,
    subject: provider.expected.subject, sessionId: provider.expected.sessionId, authenticatedAt: provider.expected.authenticatedAt,
    signedAt: provider.expected.signedAt, identityEvidenceDigest: digest(encode()), providerRecordedAt: provider.payload.recordedAt });
  const evaluate = (proof: unknown = encode(), wanted: unknown = expected(), selected: unknown = trust, time: unknown = '2026-09-06T12:00:00.400000000Z') =>
    verifyGateIdentityAttestation(proof, selected, wanted, time);
  return { provider, trust, payload, raw, encode, digest, expected, evaluate };
}
