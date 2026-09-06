import { createHash, createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';
import { parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { gateProviderExpectedSchema } from './gate-provider-proof.ts';
import { authorizationRecordSchema } from './oidc.ts';

const identifier = z.string().min(1).max(200).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
const digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const instant = z.string().max(30).refine((value) => parseUtcInstant(value) !== null);
const issuer = authorizationRecordSchema.shape.issuer;
const expectedSchema = gateProviderExpectedSchema.pick({ organizationId: true, repository: true, subject: true,
  sessionId: true, authenticatedAt: true, signedAt: true, identityEvidenceDigest: true }).extend({
  identityIssuer: issuer, providerRecordedAt: instant,
});
const trustSchema = z.strictObject({ version: z.literal('steer-gate-identity-trust/v1'),
  organizationId: identifier, repository: identifier, identityIssuer: issuer, attestor: issuer,
  keyId: identifier, publicKeyHex: digest, notBefore: instant, notAfter: instant, revokedAt: instant.nullable(),
});
const payloadSchema = z.strictObject({ version: z.literal('steer-gate-identity-attestation/v1'),
  organizationId: identifier, repository: identifier, identityIssuer: issuer, attestor: issuer, keyId: identifier,
  subject: identifier, type: z.literal('human'), sessionId: identifier,
  authenticatedAt: instant, authenticationExpiresAt: instant, recordedAt: instant,
});
const envelopeSchema = z.strictObject({ version: z.literal('steer-gate-identity-proof/v1'),
  payload: z.string().min(1).max(16384), signatureBase64: z.string().length(88).regex(/^[A-Za-z0-9+/]{86}==$/),
});
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

/** Verifies a historical identity service's signed, scoped session assertion.
 * Trust selection must separately authorize that service to attest this issuer.
 * Never issues receipts, reads/stores bearer tokens, proves a human's qualification,
 * or substitutes this development profile for existing commercial provider records. */
export function verifyGateIdentityAttestation(rawEnvelope: unknown, rawTrust: unknown, rawExpected: unknown, evaluatedAt: unknown) {
  try {
    const envelope = envelopeSchema.parse(rawEnvelope), trust = trustSchema.parse(rawTrust);
    const expected = expectedSchema.parse(rawExpected), evaluation = instant.parse(evaluatedAt);
    const bytes = Buffer.from(envelope.payload, 'utf8');
    if (bytes.length > 16384 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== envelope.payload) return null;
    const payload = payloadSchema.parse(JSON.parse(envelope.payload));
    if (JSON.stringify(payload) !== envelope.payload || hash(JSON.stringify(envelope)) !== expected.identityEvidenceDigest ||
      ['organizationId', 'repository', 'identityIssuer', 'attestor', 'keyId'].some((key) =>
        payload[key as keyof typeof payload] !== trust[key as keyof typeof trust]) ||
      ['organizationId', 'repository', 'identityIssuer', 'subject', 'sessionId', 'authenticatedAt'].some((key) =>
        payload[key as keyof typeof payload] !== expected[key as keyof typeof expected])) return null;
    const at = parseUtcInstant(evaluation)!, authenticated = parseUtcInstant(payload.authenticatedAt)!;
    const expires = parseUtcInstant(payload.authenticationExpiresAt)!, recorded = parseUtcInstant(payload.recordedAt)!;
    const signed = parseUtcInstant(expected.signedAt)!, providerRecorded = parseUtcInstant(expected.providerRecordedAt)!;
    const from = parseUtcInstant(trust.notBefore)!, until = parseUtcInstant(trust.notAfter)!;
    const revoked = trust.revokedAt === null ? null : parseUtcInstant(trust.revokedAt)!;
    if (from >= until || authenticated < from || authenticated >= expires || authenticated > recorded || recorded >= expires ||
      authenticated > signed || signed >= expires || recorded > providerRecorded || signed > providerRecorded || providerRecorded > at ||
      recorded >= until || at < from || at >= until ||
      (revoked !== null && (revoked < from || revoked > until || revoked <= at))) return null;
    const signature = Buffer.from(envelope.signatureBase64, 'base64');
    if (signature.length !== 64 || signature.toString('base64') !== envelope.signatureBase64) return null;
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(trust.publicKeyHex, 'hex')]),
      format: 'der', type: 'spki' });
    if (!verify(null, Buffer.concat([Buffer.from('steer-gate-identity-attestation/v1\0'), bytes]), key, signature)) return null;
    return Object.freeze({ kind: 'verified-gate-identity-attestation' as const,
      trustDigest: hash(JSON.stringify(trust)), proofDigest: hash(JSON.stringify(envelope)), claims: Object.freeze(payload), evaluatedAt: evaluation,
      currentSourceVerificationRequired: true as const, qualificationVerificationRequired: true as const,
      gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
