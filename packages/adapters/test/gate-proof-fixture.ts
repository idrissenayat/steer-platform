// Synthetic test-only signing fixture. Never imported by production code.
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyGateProviderAttestation } from '../src/identity/gate-provider-proof.ts';
const base = '2026-09-06T12:00:00', at = (fraction: string) => `${base}.${fraction}Z`;
export function providerProofFixture(decisionDigest = 'c'.repeat(64)) {
  const keys = generateKeyPairSync('ed25519');
  const expected = { organizationId: 'synthetic', repository: 'github:1', itemId: 'intent/0130', gate: 2,
    artifactRevision: 'a'.repeat(40), decisionDigest, subject: 'synthetic-human', hat: 'tech-lead', sequence: 1,
    sessionId: 'synthetic-session', authenticatedAt: at('100000000'), signedAt: at('200000000'),
    providerRecordId: 'synthetic-observation-1', identityEvidenceDigest: 'd'.repeat(64), authorizationEvidenceDigest: 'e'.repeat(64), decision: 'approved' };
  const trust = { version: 'steer-gate-provider-trust/v1', organizationId: expected.organizationId, repository: expected.repository,
    provider: 'synthetic-provider', issuer: 'https://provider.synthetic.invalid', keyId: 'synthetic-key',
    publicKeyHex: keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    notBefore: `${base}Z`, notAfter: '2026-09-06T12:01:00Z', revokedAt: null as string | null };
  const payload: Record<string, unknown> = { version: 'steer-gate-provider-attestation/v1', provider: trust.provider,
    issuer: trust.issuer, keyId: trust.keyId, ...expected, type: 'human', recordedAt: at('300000000') };
  const raw = (text: string, prefix = 'steer-gate-provider-attestation/v1\0') => ({ version: 'steer-gate-provider-proof/v1', payload: text,
    signatureBase64: sign(null, Buffer.from(prefix + text), keys.privateKey).toString('base64') });
  const encode = (value = payload) => raw(JSON.stringify(value));
  const evaluate = (envelope: unknown = encode(), selected: unknown = trust, wanted: unknown = expected, time: unknown = at('400000000')) =>
    verifyGateProviderAttestation(envelope, selected, wanted, time);
  return { expected, trust, payload, raw, encode, evaluate };
}
