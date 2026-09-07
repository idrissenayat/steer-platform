import { createHash, createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';
import { artifactProjectionInputSchema } from '@steer/tool-registry';
import { gatePolicyInputSchema, parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { authorizationRecordSchema } from './oidc.ts';

const identifier = z.string().min(1).max(200).refine(value => value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
const digest = gatePolicyInputSchema.shape.target.shape.decisionDigest;
const instant = z.string().max(30).refine(value => parseUtcInstant(value) !== null);
const scope = { organizationId: identifier, repository: identifier, branch: identifier, selectorSubject: identifier };
const selectorIdentity = { selectorIssuer: authorizationRecordSchema.shape.issuer.optional(), selectorType: z.enum(['human', 'agent']).optional() };
const selectorAuthorization = { selectorAuthorizationPath: artifactProjectionInputSchema.shape.path.optional(),
  selectorAuthorizationRevision: gatePolicyInputSchema.shape.target.shape.artifactRevision.optional(), selectorAuthorizationDigest: digest.optional() };
const bindings = z.strictObject({ ...scope, recordItem: identifier,
  platformRevision: gatePolicyInputSchema.shape.target.shape.artifactRevision, decisionDigest: digest,
  selectionPath: artifactProjectionInputSchema.shape.path, selectionDigest: digest, configurationDigest: digest,
  selectionId: identifier, selectedAt: instant });
const expectedSchema = bindings.extend({ trustDigest: digest, proofDigest: digest, ...selectorIdentity, ...selectorAuthorization });
const trustSchema = z.strictObject({ version: z.literal('steer-gate-selection-trust/v1'), ...scope,
  attestor: authorizationRecordSchema.shape.issuer, keyId: identifier, publicKeyHex: digest,
  notBefore: instant, notAfter: instant, revokedAt: instant.nullable(), ...selectorIdentity });
const payloadSchema = z.strictObject({ version: z.literal('steer-gate-selection-attestation/v1'),
  attestor: authorizationRecordSchema.shape.issuer, keyId: identifier, ...bindings.shape,
  recordedAt: instant, validBefore: instant, ...selectorIdentity, ...selectorAuthorization });
const envelopeSchema = z.strictObject({ version: z.literal('steer-gate-selection-proof/v1'),
  payload: z.string().min(1).max(16384), signatureBase64: z.string().length(88).regex(/^[A-Za-z0-9+/]{86}==$/) });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Internal selected-key evidence contract, not an approval or live trust bootstrap.
 * Expected facts and BOTH digests must be supplied independently of the envelope.
 * Content-addressed manifest binding avoids a self-referential proof/source commit.
 * A caller still must read current sources, establish authorized attestor/selector
 * ownership and verify review provenance and complete action-time write authority.
 * This does not convert existing provider-recorded commercial gate signatures. */
export function verifyGateSelectionAttestation(rawEnvelope: unknown, rawTrust: unknown, rawExpected: unknown, evaluatedAt: unknown) {
  try {
    const envelope = envelopeSchema.parse(rawEnvelope), trust = trustSchema.parse(rawTrust);
    const expected = expectedSchema.parse(rawExpected), evaluation = instant.parse(evaluatedAt);
    // Closed schema-ordered compact JSON, not a claim of general JSON canonicalization.
    if (JSON.stringify(envelope) !== JSON.stringify(rawEnvelope) || JSON.stringify(trust) !== JSON.stringify(rawTrust) ||
      hash(JSON.stringify(trust)) !== expected.trustDigest || hash(JSON.stringify(envelope)) !== expected.proofDigest) return null;
    const bytes = Buffer.from(envelope.payload, 'utf8');
    if (bytes.length > 16384 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== envelope.payload) return null;
    const payload = payloadSchema.parse(JSON.parse(envelope.payload));
    // Legacy subject-only evidence remains readable, but cannot enter the grant
    // composition. Identity-aware receipts bind BOTH coordinates independently.
    for (const value of [payload, trust, expected]) if ((value.selectorIssuer === undefined) !== (value.selectorType === undefined)) return null;
    for (const key of ['selectorIssuer', 'selectorType'] as const) if (payload[key] !== trust[key] || payload[key] !== expected[key]) return null;
    for (const key of ['selectorAuthorizationPath', 'selectorAuthorizationRevision', 'selectorAuthorizationDigest'] as const) {
      if ((payload[key] === undefined) !== (payload.selectorIssuer === undefined) ||
        (expected[key] === undefined) !== (expected.selectorIssuer === undefined) || payload[key] !== expected[key]) return null;
    }
    if (JSON.stringify(payload) !== envelope.payload || payload.attestor !== trust.attestor || payload.keyId !== trust.keyId ||
      Object.keys(scope).some(key => payload[key as keyof typeof payload] !== trust[key as keyof typeof trust]) ||
      Object.keys(bindings.shape).some(key => payload[key as keyof typeof payload] !== expected[key as keyof typeof expected])) return null;
    const at = parseUtcInstant(evaluation)!, selected = parseUtcInstant(payload.selectedAt)!;
    const recorded = parseUtcInstant(payload.recordedAt)!, validBefore = parseUtcInstant(payload.validBefore)!;
    const from = parseUtcInstant(trust.notBefore)!, until = parseUtcInstant(trust.notAfter)!;
    const revoked = trust.revokedAt === null ? null : parseUtcInstant(trust.revokedAt)!;
    if (from >= until || selected < from || selected > recorded || recorded > at ||
      recorded >= validBefore || validBefore > until || at < from || at >= validBefore ||
      (revoked !== null && (revoked < from || revoked > until || revoked <= at))) return null;
    const signature = Buffer.from(envelope.signatureBase64, 'base64');
    if (signature.length !== 64 || signature.toString('base64') !== envelope.signatureBase64) return null;
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(trust.publicKeyHex, 'hex')]), format: 'der', type: 'spki' });
    if (!verify(null, Buffer.concat([Buffer.from('steer-gate-selection-attestation/v1\0'), bytes]), key, signature)) return null;
    return Object.freeze({ kind: 'verified-gate-selection-attestation' as const, claims: Object.freeze(payload),
      trustDigest: expected.trustDigest, proofDigest: expected.proofDigest, evaluatedAt: evaluation,
      validBefore: revoked !== null && revoked < validBefore ? trust.revokedAt! : payload.validBefore,
      trustBootstrapVerificationRequired: true as const, selectorAuthorizationVerificationRequired: true as const,
      currentSourceVerificationRequired: true as const, reviewAuthenticityVerificationRequired: true as const,
      gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
