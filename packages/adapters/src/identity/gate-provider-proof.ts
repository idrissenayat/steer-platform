import { createHash, createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';
import { gatePolicyInputSchema, parseUtcInstant } from '@steer/tool-registry/gate-policy';

const identifier = z.string().min(1).max(200).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
const digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const instant = z.string().max(30).refine((value) => parseUtcInstant(value) !== null);
const provider = z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/);
const issuer = z.string().url().max(500).refine((value) => {
  const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search;
});
const signature = gatePolicyInputSchema.shape.record.shape.signatures.element;
const expectedSchema = gatePolicyInputSchema.shape.target.extend({
  subject: identifier, hat: signature.shape.hat, sequence: signature.shape.sequence,
  sessionId: identifier, authenticatedAt: instant, signedAt: instant,
  providerRecordId: identifier, identityEvidenceDigest: digest, authorizationEvidenceDigest: digest,
  decision: gatePolicyInputSchema.shape.record.shape.decision,
});
const trustSchema = z.strictObject({ version: z.literal('steer-gate-provider-trust/v1'),
  organizationId: identifier, repository: identifier, provider, issuer, keyId: identifier,
  publicKeyHex: digest, notBefore: instant, notAfter: instant, revokedAt: instant.nullable(),
});
const payloadSchema = z.strictObject({ version: z.literal('steer-gate-provider-attestation/v1'),
  provider, issuer, keyId: identifier, ...expectedSchema.shape, type: z.literal('human'), recordedAt: instant,
});
const envelopeSchema = z.strictObject({ version: z.literal('steer-gate-provider-proof/v1'),
  payload: z.string().min(1).max(16384), signatureBase64: z.string().length(88).regex(/^[A-Za-z0-9+/]{86}==$/),
});
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Verifies a provider's signed assertion under an explicitly selected trust
 * snapshot. Does NOT fetch/approve that snapshot, authenticate the human afresh,
 * verify qualification or independent review, or authorize any gate/write.
 * No production trust keys/provider bindings are installed here. Expected facts
 * and trust must come from trusted source verification, never HTTP request facts.
 * The existing openai-codex provider-recorded gate is NOT converted by this helper. */
export function verifyGateProviderAttestation(rawEnvelope: unknown, rawTrust: unknown, rawExpected: unknown, evaluatedAt: unknown) {
  try {
    const envelope = envelopeSchema.parse(rawEnvelope), trust = trustSchema.parse(rawTrust);
    const expected = expectedSchema.parse(rawExpected), evaluation = instant.parse(evaluatedAt);
    const bytes = Buffer.from(envelope.payload, 'utf8');
    if (bytes.length > 16384 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== envelope.payload) return null;
    const payload = payloadSchema.parse(JSON.parse(envelope.payload));
    // This profile uses schema-ordered compact JSON, not an RFC 8785/JCS claim.
    // Reject duplicate/unknown keys, whitespace/order changes and coercion.
    if (JSON.stringify(payload) !== envelope.payload || payload.provider !== trust.provider || payload.issuer !== trust.issuer ||
      payload.keyId !== trust.keyId || payload.organizationId !== trust.organizationId || payload.repository !== trust.repository ||
      Object.entries(expected).some(([key, value]) => payload[key as keyof typeof payload] !== value)) return null;
    const at = parseUtcInstant(evaluation)!, recorded = parseUtcInstant(payload.recordedAt)!;
    const signed = parseUtcInstant(payload.signedAt)!, authenticated = parseUtcInstant(payload.authenticatedAt)!;
    const from = parseUtcInstant(trust.notBefore)!, until = parseUtcInstant(trust.notAfter)!;
    const revoked = trust.revokedAt === null ? null : parseUtcInstant(trust.revokedAt)!;
    if (from >= until || (revoked !== null && (revoked < from || revoked > until)) ||
      authenticated > signed || signed > recorded || recorded > at || recorded < from || recorded >= until ||
      at < from || at >= until || (revoked !== null && revoked <= at)) return null;
    const signatureBytes = Buffer.from(envelope.signatureBase64, 'base64');
    if (signatureBytes.length !== 64 || signatureBytes.toString('base64') !== envelope.signatureBase64) return null;
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(trust.publicKeyHex, 'hex')]),
      format: 'der', type: 'spki' });
    if (!verify(null, Buffer.concat([Buffer.from('steer-gate-provider-attestation/v1\0'), bytes]), key, signatureBytes)) return null;
    return Object.freeze({ kind: 'verified-provider-attestation' as const, provider: trust.provider, issuer: trust.issuer, keyId: trust.keyId,
      trustDigest: hash(JSON.stringify(trust)), proofDigest: hash(JSON.stringify(envelope)), payloadDigest: hash(envelope.payload),
      claims: Object.freeze(payload), evaluatedAt: evaluation,
      currentSourceVerificationRequired: true as const, qualificationVerificationRequired: true as const,
      gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
