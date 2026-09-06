import { createHash, createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';
import { gatePolicyInputSchema, parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { authorizationRecordSchema } from './oidc.ts';

const identifier = z.string().min(1).max(200).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
const digest = z.string().length(64).regex(/^[a-f0-9]{64}$/), issuer = authorizationRecordSchema.shape.issuer;
const instant = z.string().max(30).refine((value) => parseUtcInstant(value) !== null);
const domain = gatePolicyInputSchema.shape.policy.shape.activatedDomains.element;
export const qualificationDomainsSchema = z.array(domain).min(1).max(7)
  .refine((values) => new Set(values).size === values.length && values.every((value, index) => index === 0 || values[index - 1]! < value));
const trustSchema = z.strictObject({ version: z.literal('steer-gate-qualification-trust/v1'),
  organizationId: identifier, repository: identifier, identityIssuer: issuer, attestor: issuer, keyId: identifier,
  publicKeyHex: digest, domains: qualificationDomainsSchema, notBefore: instant, notAfter: instant, revokedAt: instant.nullable() });
const payloadSchema = z.strictObject({ version: z.literal('steer-gate-qualification-attestation/v1'),
  organizationId: identifier, repository: identifier, identityIssuer: issuer, attestor: issuer, keyId: identifier,
  qualificationId: identifier, subject: identifier, type: z.literal('human'), domains: qualificationDomainsSchema,
  validAfter: instant, validThrough: instant, recordedAt: instant, revokedAt: instant.nullable() });
const envelopeSchema = z.strictObject({ version: z.literal('steer-gate-qualification-proof/v1'),
  payload: z.string().min(1).max(16384), signatureBase64: z.string().length(88).regex(/^[A-Za-z0-9+/]{86}==$/) });
const expectedSchema = z.strictObject({ organizationId: identifier, repository: identifier, identityIssuer: issuer,
  subject: identifier, signedAt: instant, requiredDomains: qualificationDomainsSchema, qualificationEvidenceDigest: digest });
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

/** A scoped qualification authority's assertion, not a credential issuer or
 * independent assessment of a person's professional competence. Trust, domains
 * and evidence pin must be selected by governed source composition, not a caller. */
export function verifyGateQualificationAttestation(rawEnvelope: unknown, rawTrust: unknown, rawExpected: unknown, evaluatedAt: unknown) {
  try {
    const envelope = envelopeSchema.parse(rawEnvelope), trust = trustSchema.parse(rawTrust);
    const expected = expectedSchema.parse(rawExpected), evaluation = instant.parse(evaluatedAt);
    const bytes = Buffer.from(envelope.payload, 'utf8');
    if (bytes.length > 16384 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== envelope.payload) return null;
    const payload = payloadSchema.parse(JSON.parse(envelope.payload));
    if (JSON.stringify(payload) !== envelope.payload || hash(JSON.stringify(envelope)) !== expected.qualificationEvidenceDigest ||
      ['organizationId', 'repository', 'identityIssuer', 'attestor', 'keyId'].some((key) => payload[key as keyof typeof payload] !== trust[key as keyof typeof trust]) ||
      ['organizationId', 'repository', 'identityIssuer', 'subject'].some((key) => payload[key as keyof typeof payload] !== expected[key as keyof typeof expected]) ||
      payload.domains.some((value) => !trust.domains.includes(value)) || expected.requiredDomains.some((value) => !payload.domains.includes(value))) return null;
    const at = parseUtcInstant(evaluation)!, signed = parseUtcInstant(expected.signedAt)!;
    const after = parseUtcInstant(payload.validAfter)!, through = parseUtcInstant(payload.validThrough)!, recorded = parseUtcInstant(payload.recordedAt)!;
    const from = parseUtcInstant(trust.notBefore)!, until = parseUtcInstant(trust.notAfter)!;
    if (from >= until || after >= through || recorded < from || recorded >= until || recorded < after || recorded > signed ||
      signed < after || signed >= through || signed > at || at >= through || at < from || at >= until) return null;
    for (const [raw, lower, upper] of [[trust.revokedAt, from, until], [payload.revokedAt, after, through]] as const) {
      const revoked = raw === null ? null : parseUtcInstant(raw)!;
      if (revoked !== null && (revoked < lower || revoked > upper || revoked <= at)) return null;
    }
    const signature = Buffer.from(envelope.signatureBase64, 'base64');
    if (signature.length !== 64 || signature.toString('base64') !== envelope.signatureBase64) return null;
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(trust.publicKeyHex, 'hex')]), format: 'der', type: 'spki' });
    if (!verify(null, Buffer.concat([Buffer.from('steer-gate-qualification-attestation/v1\0'), bytes]), key, signature)) return null;
    Object.freeze(payload.domains);
    return Object.freeze({ kind: 'verified-gate-qualification-attestation' as const, claims: Object.freeze(payload),
      qualifiedDomains: Object.freeze([...expected.requiredDomains]), trustDigest: hash(JSON.stringify(trust)), proofDigest: hash(JSON.stringify(envelope)),
      evaluatedAt: evaluation, currentSourceVerificationRequired: true as const, gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
