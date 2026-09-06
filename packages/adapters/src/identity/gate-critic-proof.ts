import { createHash, createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';
import { artifactProjectionInputSchema } from '@steer/tool-registry';
import { gatePolicyInputSchema, parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { authorizationRecordSchema } from './oidc.ts';

const identifier = z.string().min(1).max(200).refine(value => value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
const digest = gatePolicyInputSchema.shape.target.shape.decisionDigest;
const instant = z.string().max(30).refine(value => parseUtcInstant(value) !== null);
const scope = { organizationId: identifier, repository: identifier, gate: z.literal(2),
  reviewerProvider: identifier, reviewerTask: identifier, configurationRevision: identifier };
const bindings = z.strictObject({ ...scope, recordItem: identifier,
  artifactRevision: gatePolicyInputSchema.shape.target.shape.artifactRevision,
  reportPath: artifactProjectionInputSchema.shape.path, reportDigest: digest,
  builderTask: identifier, executionId: identifier, builderExecutionId: identifier, reviewedAt: instant });
const expectedSchema = bindings.extend({ proofDigest: digest });
const trustSchema = z.strictObject({ version: z.literal('steer-critic-runner-trust/v1'), ...scope,
  attestor: authorizationRecordSchema.shape.issuer, keyId: identifier, publicKeyHex: digest,
  notBefore: instant, notAfter: instant, revokedAt: instant.nullable() });
const payloadSchema = z.strictObject({ version: z.literal('steer-critic-runner-attestation/v1'),
  attestor: authorizationRecordSchema.shape.issuer, keyId: identifier, ...bindings.shape,
  startedAt: instant, recordedAt: instant, inheritedConversation: z.literal(false),
  priorConclusionsTreatedAsAuthority: z.literal(false), builderIndependent: z.literal(true) });
const envelopeSchema = z.strictObject({ version: z.literal('steer-critic-runner-proof/v1'),
  payload: z.string().min(1).max(16384), signatureBase64: z.string().length(88).regex(/^[A-Za-z0-9+/]{86}==$/) });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Internal Gate-2 Critic runner receipt contract, separate from domain reviewers
 * and human approvals. Verifies selected-key claims, not actual runner ownership,
 * trustworthy isolation or the correctness/passing disposition of a Critic. */
export function verifyCriticRunnerAttestation(rawEnvelope: unknown, rawTrust: unknown, rawExpected: unknown, evaluatedAt: unknown) {
  try {
    const envelope = envelopeSchema.parse(rawEnvelope), trust = trustSchema.parse(rawTrust);
    const expected = expectedSchema.parse(rawExpected), evaluation = instant.parse(evaluatedAt);
    const bytes = Buffer.from(envelope.payload, 'utf8');
    if (bytes.length > 16384 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== envelope.payload ||
      hash(JSON.stringify(envelope)) !== expected.proofDigest) return null;
    const payload = payloadSchema.parse(JSON.parse(envelope.payload));
    if (JSON.stringify(payload) !== envelope.payload || payload.attestor !== trust.attestor || payload.keyId !== trust.keyId ||
      Object.keys(scope).some(key => payload[key as keyof typeof payload] !== trust[key as keyof typeof trust]) ||
      Object.keys(bindings.shape).some(key => payload[key as keyof typeof payload] !== expected[key as keyof typeof expected]) ||
      payload.executionId === payload.builderExecutionId || payload.reviewerTask === payload.builderTask) return null;
    const at = parseUtcInstant(evaluation)!, start = parseUtcInstant(payload.startedAt)!;
    const reviewed = parseUtcInstant(payload.reviewedAt)!, recorded = parseUtcInstant(payload.recordedAt)!;
    const from = parseUtcInstant(trust.notBefore)!, until = parseUtcInstant(trust.notAfter)!;
    const revoked = trust.revokedAt === null ? null : parseUtcInstant(trust.revokedAt)!;
    if (from >= until || start < from || start > reviewed || reviewed > recorded || recorded > at ||
      recorded >= until || at < from || at >= until ||
      (revoked !== null && (revoked < from || revoked > until || revoked <= at))) return null;
    const signature = Buffer.from(envelope.signatureBase64, 'base64');
    if (signature.length !== 64 || signature.toString('base64') !== envelope.signatureBase64) return null;
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(trust.publicKeyHex, 'hex')]), format: 'der', type: 'spki' });
    if (!verify(null, Buffer.concat([Buffer.from('steer-critic-runner-attestation/v1\0'), bytes]), key, signature)) return null;
    return Object.freeze({ kind: 'verified-critic-runner-attestation' as const, claims: Object.freeze(payload),
      trustDigest: hash(JSON.stringify(trust)), proofDigest: expected.proofDigest, evaluatedAt: evaluation,
      validBefore: revoked !== null && revoked < until ? trust.revokedAt! : trust.notAfter,
      governedRunnerSelectionRequired: true as const, runnerIsolationVerificationRequired: true as const,
      currentSourceVerificationRequired: true as const, gateVerified: false as const, writeAuthorized: false as const });
  } catch { return null; }
}
