import { z } from 'zod';
import { principalSchema } from '@steer/tool-registry';
import { gatePolicyInputSchema, parseUtcInstant } from '@steer/tool-registry/gate-policy';
import { createGitGateObserver, gitGateSourceConfigurationSchema } from './gate-observation.ts';
import { createGitProviderProofReader, gitProviderSourceConfigurationSchema, gitSignerIdentityInputSchema } from '../identity/git-provider-proof.ts';
import type { RepositoryReader } from './github.ts';

const signatureSchema = gatePolicyInputSchema.shape.record.shape.signatures.element;
const declaredSignatureSchema = signatureSchema.pick({ subject: true, hat: true, sequence: true, signedAt: true }).extend({
  type: z.literal('human').optional(), sessionId: signatureSchema.shape.sessionId.optional(),
  authenticatedAt: signatureSchema.shape.authenticatedAt.optional(), qualifiedDomains: signatureSchema.shape.qualifiedDomains.optional(),
});
const recordSchema = z.object({ decision: gatePolicyInputSchema.shape.record.shape.decision,
  signatures: z.array(declaredSignatureSchema).min(1).max(100) });
const configurationSchema = z.strictObject({ gateSource: gitGateSourceConfigurationSchema,
  signers: z.array(z.strictObject({ source: gitProviderSourceConfigurationSchema,
    proof: gitSignerIdentityInputSchema.omit({ sourceRevision: true }) })).min(1).max(100) });
const inputSchema = z.strictObject({ sourceRevision: z.string().length(40).regex(/^[a-f0-9]{40}$/),
  decisionDigest: z.string().length(64).regex(/^[a-f0-9]{64}$/) });

/** Exact canonical record/artifact collection joined to actual signer verifiers.
 * Trusted startup selects proof facts, trust roots and domain requirements. These
 * are not HTTP input. Full gate policy and fresh source revalidation remain
 * mandatory downstream: this evidence collection never authorizes a write. */
export function createGitGateSignerCollector(reader: RepositoryReader, rawConfiguration: unknown, authenticate: () => Promise<unknown>) {
  const config = configurationSchema.parse(rawConfiguration), binding = Object.freeze({ ...reader.binding });
  const scope = config.gateSource.scope;
  if (typeof authenticate !== 'function' || scope.organizationId !== binding.organizationId || scope.repository !== `github:${binding.repositoryId}`) throw new Error('Invalid gate signer sources.');
  const pairs = new Set<string>();
  for (const [index, signer] of config.signers.entries()) {
    const expected = signer.proof.expected, key = JSON.stringify([expected.subject, expected.hat]);
    if (!signer.source.signerAuthorization || !signer.source.signerIdentity ||
      (expected.hat === 'specialist' && !signer.source.specialistQualification) ||
      expected.organizationId !== scope.organizationId || expected.repository !== scope.repository || expected.itemId !== scope.itemId ||
      expected.gate !== config.gateSource.gate || expected.artifactRevision !== config.gateSource.artifactRevision ||
      expected.sequence !== index + 1 || pairs.has(key)) throw new Error('Invalid gate signer sources.');
    pairs.add(key);
  }
  const failure = () => new Error('Gate signer collection could not be verified.');
  let check: () => number = () => { throw failure(); }, subject: string | undefined, identityExpiry = Infinity;
  const authorization = async () => {
    check(); const principal = principalSchema.parse(await authenticate()); const now = check();
    if (principal.type !== 'agent' || principal.hats.length || !principal.toolGrants.includes('gate.observe') ||
      principal.organizationId !== scope.organizationId || Date.parse(principal.expiresAt) <= now ||
      (subject !== undefined && subject !== principal.subject)) throw failure();
    subject = principal.subject; identityExpiry = Math.min(identityExpiry, Date.parse(principal.expiresAt));
    return principal;
  };
  const guarded: RepositoryReader = { binding,
    readHead: async () => { check(); const value = await reader.readHead(); check(); return value; },
    readArtifact: async (...args) => { check(); const value = await reader.readArtifact(...args); check(); return value; },
    readInventory: async (...args) => { check(); const value = await reader.readInventory(...args); check(); return value; },
  };
  const gate = createGitGateObserver(guarded, config.gateSource, authorization);
  const sources = config.signers.map((signer) => createGitProviderProofReader(guarded, signer.source, { authenticate: authorization }));
  let active: Promise<unknown> | undefined, stopping = false, shutdown: Promise<void> | undefined;
  return {
    async collect(rawInput: unknown) {
      if (stopping || active) throw failure();
      const parsed = inputSchema.safeParse(rawInput); if (!parsed.success) throw failure();
      const input = parsed.data;
      if (config.signers.some((signer) => signer.proof.expected.decisionDigest !== input.decisionDigest)) throw failure();
      const started = Date.now(); if (!Number.isFinite(started)) throw failure();
      let last = started, expired = false, timer: ReturnType<typeof setTimeout> | undefined;
      subject = undefined; identityExpiry = Infinity;
      check = () => { const now = Date.now();
        if (expired || !Number.isFinite(now) || now < last || now - started >= 15000 || now >= identityExpiry) throw failure();
        last = now; return now;
      };
      const work = (async () => {
        try {
          const bundle = await gate.collect(input), record = recordSchema.parse(JSON.parse(bundle.record.content));
          if (record.signatures.length !== config.signers.length) throw failure();
          // Validate the entire roster before any signer-specific evidence lookup.
          for (const [index, declared] of record.signatures.entries()) {
            const expected = config.signers[index]!.proof.expected;
            if (record.decision !== expected.decision || declared.subject !== expected.subject || declared.hat !== expected.hat ||
              declared.sequence !== expected.sequence || declared.signedAt !== expected.signedAt ||
              (declared.sessionId !== undefined && declared.sessionId !== expected.sessionId) ||
              (declared.authenticatedAt !== undefined && declared.authenticatedAt !== expected.authenticatedAt)) throw failure();
          }
          const signatures = [], observations = [];
          for (const [index, source] of sources.entries()) {
            check(); const selected = config.signers[index]!, proof = { ...selected.proof, sourceRevision: input.sourceRevision };
            const observation = selected.proof.expected.hat === 'specialist' ? await source.verifySpecialist(proof) : await source.verifySignerIdentity(proof);
            check(); const claims = observation.attestation.claims;
            const domains = observation.specialistQualification?.policySignature.qualifiedDomains ?? [];
            const declaredDomains = record.signatures[index]!.qualifiedDomains;
            if (declaredDomains && (declaredDomains.length !== domains.length || declaredDomains.some((value) => !domains.includes(value)))) throw failure();
            const signature = signatureSchema.parse({ subject: claims.subject, type: claims.type, hat: claims.hat, sequence: claims.sequence,
              signedAt: claims.signedAt, sessionId: claims.sessionId, authenticatedAt: claims.authenticatedAt, qualifiedDomains: [...domains] });
            Object.freeze(signature.qualifiedDomains); signatures.push(Object.freeze(signature)); observations.push(observation);
          }
          // Recollect the exact canonical source/artifact set after all signers.
          // Check every signer's known validity bounds at ONE completion instant,
          // after the final source recollection. Never let a later signer refresh
          // an earlier key/grant/qualification's expiry or scheduled revocation.
          await gate.collect(input); const evaluatedAt = new Date(check()).toISOString(), at = parseUtcInstant(evaluatedAt)!;
          const bounds = observations.map((observation) => {
            const validity = observation.currentEvidenceValidity;
            if (parseUtcInstant(validity.evaluatedAt)! > at || parseUtcInstant(validity.validBefore)! <= at) throw failure();
            return validity.validBefore;
          });
          const validBefore = bounds.reduce((earliest, value) => parseUtcInstant(value)! < parseUtcInstant(earliest)! ? value : earliest);
          return Object.freeze({ kind: 'git-gate-signers-observation' as const, bundle,
            record: Object.freeze({ organizationId: scope.organizationId, repository: scope.repository, itemId: scope.itemId,
              gate: config.gateSource.gate, artifactRevision: config.gateSource.artifactRevision, decisionDigest: input.decisionDigest,
              decision: record.decision, signatures: Object.freeze(signatures) }),
            signerObservations: Object.freeze(observations), evaluatedAt,
            currentEvidenceValidity: Object.freeze({ evaluatedAt, validBefore, sourceRevalidationRequired: true as const }),
            currentSignerRevalidationRequired: true as const, policyVerificationRequired: true as const,
            gateVerified: false as const, writeAuthorized: false as const });
        } catch {
          // A child can return its timeout before its actual provider read ends.
          // Close this collector and retain ownership until every child drains;
          // never reset the shared clock/actor guard underneath an old continuation.
          stopping = true;
          await Promise.all([gate.shutdown(), ...sources.map((source) => source.shutdown())]);
          throw failure();
        }
      })().finally(() => { active = undefined; });
      active = work;
      try { return await Promise.race([work, new Promise<never>((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(failure()); }, 15000);
      })]); } finally { clearTimeout(timer); }
    },
    shutdown() {
      if (!shutdown) { stopping = true; const pending = active; shutdown = (async () => {
        try { await pending; } catch { /* Caller receives sanitized denial. */ }
        await Promise.all([gate.shutdown(), ...sources.map((source) => source.shutdown())]);
      })(); } return shutdown;
    },
    status: () => ({ stopping, active: Boolean(active) }),
  };
}
