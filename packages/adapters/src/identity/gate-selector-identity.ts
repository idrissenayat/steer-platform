import { createHash, createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';
import { parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { authorizationRecordSchema } from './oidc.ts';

const identifier = z.string().min(1).max(200).refine(value => value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
const digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const instant = z.string().max(30).refine(value => parseUtcInstant(value) !== null);
const scope = { organizationId: identifier, repository: identifier, branch: identifier, identityIssuer: authorizationRecordSchema.shape.issuer };
const trustSchema = z.strictObject({ version: z.literal('steer-selector-identity-trust/v1'), ...scope,
  attestor: authorizationRecordSchema.shape.issuer, keyId: identifier, publicKeyHex: digest,
  notBefore: instant, notAfter: instant, revokedAt: instant.nullable() });
const payloadSchema = z.strictObject({ version: z.literal('steer-selector-identity-attestation/v1'), ...scope,
  attestor: authorizationRecordSchema.shape.issuer, keyId: identifier, subject: identifier,
  type: authorizationRecordSchema.shape.type, sessionId: identifier, authenticatedAt: instant,
  authenticationExpiresAt: instant, recordedAt: instant });
const envelopeSchema = z.strictObject({ version: z.literal('steer-selector-identity-proof/v1'),
  payload: z.string().min(1).max(16384), signatureBase64: z.string().length(88).regex(/^[A-Za-z0-9+/]{86}==$/) });
const expectedSchema = z.strictObject({ ...scope, subject: identifier, type: authorizationRecordSchema.shape.type,
  sessionId: identifier, authenticatedAt: instant, selectedAt: instant, selectionRecordedAt: instant,
  trustDigest: digest, proofDigest: digest });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Historical selector session evidence, never a live login or approved trust installation.
 * Separate signature domain permits explicitly scoped agents without weakening the
 * human-only gate identity contract. Pins and expected selection facts are external.
 * Session expiry after selection is normal; current attestor revocation still denies. */
export function verifySelectorIdentityAttestation(rawProof: unknown, rawTrust: unknown, rawExpected: unknown, evaluatedAt: unknown) {
  try {
    const proof = envelopeSchema.parse(rawProof), trust = trustSchema.parse(rawTrust), expected = expectedSchema.parse(rawExpected);
    const evaluation = instant.parse(evaluatedAt), bytes = Buffer.from(proof.payload, 'utf8');
    if (JSON.stringify(proof) !== JSON.stringify(rawProof) || JSON.stringify(trust) !== JSON.stringify(rawTrust) ||
      hash(proof) !== expected.proofDigest || hash(trust) !== expected.trustDigest || bytes.length > 16384 ||
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== proof.payload) return null;
    const payload = payloadSchema.parse(JSON.parse(proof.payload));
    if (JSON.stringify(payload) !== proof.payload || payload.attestor !== trust.attestor || payload.keyId !== trust.keyId ||
      (Object.keys(scope) as (keyof typeof scope)[]).some(key => payload[key] !== trust[key] || payload[key] !== expected[key]) ||
      (['subject', 'type', 'sessionId', 'authenticatedAt'] as const).some(key => payload[key] !== expected[key])) return null;
    const at = parseUtcInstant(evaluation)!, authenticated = parseUtcInstant(payload.authenticatedAt)!;
    const expires = parseUtcInstant(payload.authenticationExpiresAt)!, recorded = parseUtcInstant(payload.recordedAt)!;
    const selected = parseUtcInstant(expected.selectedAt)!, selectionRecorded = parseUtcInstant(expected.selectionRecordedAt)!;
    const from = parseUtcInstant(trust.notBefore)!, until = parseUtcInstant(trust.notAfter)!;
    const revoked = trust.revokedAt === null ? null : parseUtcInstant(trust.revokedAt)!;
    if (from >= until || authenticated < from || authenticated >= expires || authenticated > recorded || recorded >= expires ||
      authenticated > selected || selected >= expires || recorded > selectionRecorded || selected > selectionRecorded ||
      selectionRecorded > at || recorded >= until || at < from || at >= until ||
      (revoked !== null && (revoked < from || revoked > until || revoked <= at))) return null;
    const signature = Buffer.from(proof.signatureBase64, 'base64');
    if (signature.length !== 64 || signature.toString('base64') !== proof.signatureBase64) return null;
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(trust.publicKeyHex, 'hex')]), format: 'der', type: 'spki' });
    if (!verify(null, Buffer.concat([Buffer.from('steer-selector-identity-attestation/v1\0'), bytes]), key, signature)) return null;
    return Object.freeze({ kind: 'verified-selector-identity-attestation' as const, claims: Object.freeze(payload),
      trustDigest: expected.trustDigest, proofDigest: expected.proofDigest, evaluatedAt: evaluation,
      validBefore: revoked !== null && revoked < until ? trust.revokedAt! : trust.notAfter,
      trustBootstrapVerificationRequired: true as const, currentSourceVerificationRequired: true as const,
      selectorAuthorizationVerificationRequired: true as const, gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
