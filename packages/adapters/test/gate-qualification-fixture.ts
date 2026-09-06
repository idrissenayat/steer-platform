// Synthetic qualification authority only; never imported by runtime code.
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { verifyGateQualificationAttestation } from '../src/identity/gate-qualification-proof.ts';
export function qualificationProofFixture() {
  const keys = generateKeyPairSync('ed25519');
  const trust = { version: 'steer-gate-qualification-trust/v1', organizationId: 'synthetic', repository: 'github:1',
    identityIssuer: 'https://identity.synthetic.invalid', attestor: 'https://qualification.synthetic.invalid', keyId: 'synthetic-qualification-key',
    publicKeyHex: keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'), domains: ['privacy', 'security'],
    notBefore: '2026-09-06T12:00:00Z', notAfter: '2026-09-06T12:01:00Z', revokedAt: null as string | null };
  const payload: Record<string, unknown> = { version: 'steer-gate-qualification-attestation/v1', organizationId: trust.organizationId,
    repository: trust.repository, identityIssuer: trust.identityIssuer, attestor: trust.attestor, keyId: trust.keyId,
    qualificationId: 'synthetic-qualification-1', subject: 'synthetic-human', type: 'human', domains: ['privacy', 'security'],
    validAfter: '2026-09-06T12:00:00Z', validThrough: '2026-09-06T12:00:30Z', recordedAt: '2026-09-06T12:00:00.150000000Z', revokedAt: null };
  const raw = (text: string, prefix = 'steer-gate-qualification-attestation/v1\0') => ({ version: 'steer-gate-qualification-proof/v1', payload: text,
    signatureBase64: sign(null, Buffer.from(prefix + text), keys.privateKey).toString('base64') });
  const encode = () => raw(JSON.stringify(payload)), digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const expected = () => ({ organizationId: trust.organizationId, repository: trust.repository, identityIssuer: trust.identityIssuer,
    subject: 'synthetic-human', signedAt: '2026-09-06T12:00:00.200000000Z', requiredDomains: ['privacy'], qualificationEvidenceDigest: digest(encode()) });
  const evaluate = (envelope: unknown = encode(), wanted: unknown = expected(), selected: unknown = trust, time: unknown = '2026-09-06T12:00:00.400000000Z') =>
    verifyGateQualificationAttestation(envelope, selected, wanted, time);
  return { trust, payload, raw, encode, digest, expected, evaluate };
}
