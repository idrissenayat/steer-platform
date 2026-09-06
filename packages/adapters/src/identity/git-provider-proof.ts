import { createHash } from 'node:crypto';
import { z } from 'zod';
import { principalSchema, briefSaveScopeSchema, artifactProjectionInputSchema } from '@steer/tool-registry';
import type { ArtifactReader } from '../code-host/github.ts';
import { gateProviderExpectedSchema, verifyGateProviderAttestation } from './gate-provider-proof.ts';
import { authorizationDocumentSchema } from './authorization.ts';
import { authorizationRecordSchema } from './oidc.ts';
import { gatePolicyInputSchema, parseUtcInstant, type GatePolicyInput } from '@steer/tool-registry/gate-policy';
import { verifyGateIdentityAttestation } from './gate-identity-proof.ts';
import { qualificationDomainsSchema, verifyGateQualificationAttestation } from './gate-qualification-proof.ts';

const sha = z.string().length(40).regex(/^[a-f0-9]{40}$/), digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const path = artifactProjectionInputSchema.shape.path;
const configurationSchema = briefSaveScopeSchema.omit({ path: true }).extend({ trustPath: path, trustDigest: digest,
  proofPaths: z.array(path).min(1).max(100).refine((paths) => new Set(paths).size === paths.length),
  signerAuthorization: z.strictObject({ path, issuer: authorizationRecordSchema.shape.issuer }).optional(),
  signerIdentity: z.strictObject({ trustPath: path, trustDigest: digest,
    proofPaths: z.array(path).min(1).max(100).refine((paths) => new Set(paths).size === paths.length) }).optional(),
  specialistQualification: z.strictObject({ trustPath: path, trustDigest: digest, proofPath: path, proofDigest: digest,
    requiredDomains: qualificationDomainsSchema }).optional(),
}).refine((value) => !value.proofPaths.includes(value.trustPath) && (!value.signerAuthorization ||
  (value.signerAuthorization.path !== value.trustPath && !value.proofPaths.includes(value.signerAuthorization.path))))
  .refine((value) => {
    if (!value.signerIdentity) return true;
    const paths = [value.trustPath, ...value.proofPaths, value.signerAuthorization?.path,
      value.signerIdentity.trustPath, ...value.signerIdentity.proofPaths];
    return Boolean(value.signerAuthorization) && new Set(paths).size === paths.length;
  }).refine((value) => {
    if (!value.specialistQualification) return true;
    if (!value.signerAuthorization || !value.signerIdentity) return false;
    const paths = [value.trustPath, ...value.proofPaths, value.signerAuthorization.path,
      value.signerIdentity.trustPath, ...value.signerIdentity.proofPaths,
      value.specialistQualification.trustPath, value.specialistQualification.proofPath];
    return new Set(paths).size === paths.length;
  });
const inputSchema = z.strictObject({ sourceRevision: sha, proofPath: path, proofDigest: digest, expected: gateProviderExpectedSchema });
const signerInputSchema = inputSchema.extend({ authorizationRevision: sha });
const identityInputSchema = signerInputSchema.extend({ identityProofPath: path });
export { configurationSchema as gitProviderSourceConfigurationSchema, identityInputSchema as gitSignerIdentityInputSchema };
type Attestation = NonNullable<ReturnType<typeof verifyGateProviderAttestation>>;
type SourceReference = Readonly<{ path: string; revision: string; contentDigest: string; blobSha: string }>;
type SignerAuthorization = Readonly<{ issuer: string; subject: string; hat: string;
  historicalSource: SourceReference; currentSource: SourceReference;
  historicalHatVerified: true; currentHatVerified: true;
  identityEvidenceVerificationRequired: true; qualificationVerificationRequired: true }>;
type SignerIdentity = Readonly<{ trustSource: SourceReference; proofSource: SourceReference;
  attestation: NonNullable<ReturnType<typeof verifyGateIdentityAttestation>> }>;
type SpecialistQualification = Readonly<{ trustSource: SourceReference; proofSource: SourceReference;
  attestation: NonNullable<ReturnType<typeof verifyGateQualificationAttestation>>;
  policySignature: Readonly<GatePolicyInput['record']['signatures'][number]> }>;
type Observation = Readonly<{ kind: 'git-provider-proof-observation'; organizationId: string; repository: string; branch: string;
  sourceRevision: string; trustSource: SourceReference; proofSource: SourceReference; attestation: Attestation;
  signerAuthorization?: SignerAuthorization; signerIdentity?: SignerIdentity;
  specialistQualification?: SpecialistQualification; gateVerified: false; writeAuthorized: false }>;

/** Authenticated read-through composition only. The trust pin must be selected
 * by an authorized bootstrap outside this module; Git existence is not approval.
 * Expected signer facts/digests come from the governed record, not HTTP input.
 * No production key/source, provider format conversion or writer is installed. */
export function createGitProviderProofReader(reader: ArtifactReader, rawConfiguration: unknown, dependencies: {
  authenticate: () => Promise<unknown>; now?: () => Date;
}) {
  const config = configurationSchema.parse(rawConfiguration), binding = { ...reader.binding };
  if (config.organizationId !== binding.organizationId || config.repository !== `github:${binding.repositoryId}` ||
    config.branch !== binding.branch || typeof dependencies.authenticate !== 'function') throw new Error('Invalid provider proof source.');
  const clock = dependencies.now ?? (() => new Date());
  const failure = () => new Error('Provider proof source could not be verified.');
  let active: Promise<Observation> | undefined, stopping = false, shutdown: Promise<void> | undefined;
  async function verify(rawInput: unknown, mode: 'provider' | 'hat' | 'identity' | 'specialist'): Promise<Observation> {
      const verifySigner = mode !== 'provider', verifyIdentity = mode === 'identity' || mode === 'specialist', verifyQualification = mode === 'specialist';
      if (stopping || active) throw failure();
      const parsed = (verifyIdentity ? identityInputSchema : verifySigner ? signerInputSchema : inputSchema).safeParse(rawInput); if (!parsed.success) throw failure();
      const input = parsed.data;
      if (verifyQualification && (!config.specialistQualification || input.expected.hat !== 'specialist')) throw failure();
      const authorizationRevision = 'authorizationRevision' in input ? sha.parse(input.authorizationRevision) : undefined;
      if (verifySigner && (!config.signerAuthorization || !authorizationRevision)) throw failure();
      const identityProofPath = 'identityProofPath' in input ? path.parse(input.identityProofPath) : undefined;
      if (verifyIdentity && (!verifySigner || !config.signerIdentity || !identityProofPath || !config.signerIdentity.proofPaths.includes(identityProofPath))) throw failure();
      if (input.expected.organizationId !== config.organizationId || input.expected.repository !== config.repository ||
        !config.proofPaths.includes(input.proofPath)) throw failure();
      let started: number;
      try { started = clock().getTime(); if (!Number.isFinite(started)) throw failure(); } catch { throw failure(); }
      let timedOut = false, last = started, timer: ReturnType<typeof setTimeout> | undefined;
      const time = () => {
        const value = clock().getTime();
        if (timedOut || !Number.isFinite(value) || value < last || value - started >= 15000) throw failure();
        last = value;
        return value;
      };
      const authenticate = async () => {
        time(); const principal = principalSchema.parse(await dependencies.authenticate()); const now = time();
        if (principal.organizationId !== config.organizationId || principal.type !== 'agent' || principal.hats.length ||
          !principal.toolGrants.includes('gate.observe') || Date.parse(principal.expiresAt) <= now) throw failure();
        return principal;
      };
      const read = async (file: string, expectedDigest: string | undefined, maxBytes: number, revision = input.sourceRevision) => {
        time(); const snapshot = await reader.readArtifact(file, revision); time();
        if (typeof snapshot.content !== 'string') throw failure();
        const bytes = Buffer.from(snapshot.content, 'utf8');
        if (bytes.length > maxBytes || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== snapshot.content ||
          snapshot.organizationId !== config.organizationId || snapshot.repositoryId !== binding.repositoryId ||
          snapshot.path !== file || snapshot.revision !== revision || (expectedDigest !== undefined && snapshot.contentDigest !== expectedDigest) ||
          createHash('sha256').update(bytes).digest('hex') !== digest.parse(snapshot.contentDigest) ||
          createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== snapshot.blobSha) throw failure();
        return Object.freeze({ content: snapshot.content, reference: Object.freeze({ path: file, revision,
          contentDigest: snapshot.contentDigest, blobSha: snapshot.blobSha }) });
      };
      const verifyHat = (content: string, from: string, until: string) => {
        const document = authorizationDocumentSchema.parse(JSON.parse(content));
        if (document.organizationId !== config.organizationId) throw failure();
        const identities = new Set<string>();
        for (const record of document.records) {
          const key = JSON.stringify([record.issuer, record.subject]);
          if (record.organizationId !== config.organizationId || identities.has(key) ||
            new Set(record.hats).size !== record.hats.length || new Set(record.toolGrants).size !== record.toolGrants.length) throw failure();
          identities.add(key);
        }
        const grant = document.records.find((record) => record.issuer === config.signerAuthorization!.issuer && record.subject === input.expected.subject);
        if (!grant || !grant.active || grant.type !== 'human' || !grant.hats.includes(input.expected.hat)) throw failure();
        const start = parseUtcInstant(grant.validAfter), end = parseUtcInstant(grant.expiresAt);
        const first = parseUtcInstant(from), last = parseUtcInstant(until);
        if (start === null || end === null || first === null || last === null || start >= end || first > last || first < start || last >= end) throw failure();
      };
      const work = (async (): Promise<Observation> => {
        try {
          const initial = await authenticate();
          if (sha.parse(await reader.readHead()) !== input.sourceRevision) throw failure(); time();
          const trust = await read(config.trustPath, config.trustDigest, 16384);
          const proof = await read(input.proofPath, input.proofDigest, 65536);
          // This path deliberately reads both eras, even when they share a revision.
          // The historical digest is covered by the provider signature below.
          const historical = verifySigner ? await read(config.signerAuthorization!.path,
            input.expected.authorizationEvidenceDigest, 512 * 1024, authorizationRevision!) : undefined;
          const currentGrant = verifySigner ? await read(config.signerAuthorization!.path, undefined, 512 * 1024) : undefined;
          const identityTrust = verifyIdentity ? await read(config.signerIdentity!.trustPath, config.signerIdentity!.trustDigest, 16384) : undefined;
          const identityProof = verifyIdentity ? await read(identityProofPath!, input.expected.identityEvidenceDigest, 65536) : undefined;
          const qualificationTrust = verifyQualification ? await read(config.specialistQualification!.trustPath, config.specialistQualification!.trustDigest, 16384) : undefined;
          const qualificationProof = verifyQualification ? await read(config.specialistQualification!.proofPath, config.specialistQualification!.proofDigest, 65536) : undefined;
          const current = await authenticate();
          if (current.subject !== initial.subject || sha.parse(await reader.readHead()) !== input.sourceRevision) throw failure();
          const finished = time();
          if (Math.min(Date.parse(initial.expiresAt), Date.parse(current.expiresAt)) <= finished) throw failure();
          // Verify only after current-source/identity checks, at the final clock.
          const attestation = verifyGateProviderAttestation(JSON.parse(proof.content), JSON.parse(trust.content), input.expected, new Date(finished).toISOString());
          if (!attestation || attestation.proofDigest !== proof.reference.contentDigest || attestation.trustDigest !== trust.reference.contentDigest) throw failure();
          const evaluatedAt = new Date(time()).toISOString();
          let signerAuthorization: SignerAuthorization | undefined;
          if (historical && currentGrant) {
            verifyHat(historical.content, attestation.claims.authenticatedAt, attestation.claims.signedAt);
            verifyHat(currentGrant.content, evaluatedAt, evaluatedAt);
            signerAuthorization = Object.freeze({ issuer: config.signerAuthorization!.issuer, subject: attestation.claims.subject,
              hat: attestation.claims.hat, historicalSource: historical.reference, currentSource: currentGrant.reference,
              historicalHatVerified: true, currentHatVerified: true,
              identityEvidenceVerificationRequired: true, qualificationVerificationRequired: true });
          }
          const finalTime = time();
          if (currentGrant) verifyHat(currentGrant.content, new Date(finalTime).toISOString(), new Date(finalTime).toISOString());
          if (Math.min(Date.parse(initial.expiresAt), Date.parse(current.expiresAt)) <= finalTime) throw failure();
          let signerIdentity: SignerIdentity | undefined;
          if (identityTrust && identityProof) {
            const claims = attestation.claims;
            const identity = verifyGateIdentityAttestation(JSON.parse(identityProof.content), JSON.parse(identityTrust.content), {
              organizationId: claims.organizationId, repository: claims.repository, identityIssuer: config.signerAuthorization!.issuer,
              subject: claims.subject, sessionId: claims.sessionId, authenticatedAt: claims.authenticatedAt, signedAt: claims.signedAt,
              identityEvidenceDigest: claims.identityEvidenceDigest, providerRecordedAt: claims.recordedAt,
            }, new Date(finalTime).toISOString());
            if (!identity || identity.trustDigest !== identityTrust.reference.contentDigest || identity.proofDigest !== identityProof.reference.contentDigest) throw failure();
            signerIdentity = Object.freeze({ trustSource: identityTrust.reference, proofSource: identityProof.reference, attestation: identity });
          }
          let specialistQualification: SpecialistQualification | undefined;
          if (qualificationTrust && qualificationProof) {
            const claims = attestation.claims, qualification = verifyGateQualificationAttestation(JSON.parse(qualificationProof.content), JSON.parse(qualificationTrust.content), {
              organizationId: claims.organizationId, repository: claims.repository, identityIssuer: config.signerAuthorization!.issuer,
              subject: claims.subject, signedAt: claims.signedAt, requiredDomains: config.specialistQualification!.requiredDomains,
              qualificationEvidenceDigest: config.specialistQualification!.proofDigest,
            }, new Date(finalTime).toISOString());
            if (!qualification || qualification.trustDigest !== qualificationTrust.reference.contentDigest || qualification.proofDigest !== qualificationProof.reference.contentDigest) throw failure();
            const policySignature = gatePolicyInputSchema.shape.record.shape.signatures.element.parse({
              subject: claims.subject, type: 'human', hat: claims.hat, sequence: claims.sequence, sessionId: claims.sessionId,
              authenticatedAt: claims.authenticatedAt, signedAt: claims.signedAt, qualifiedDomains: [...qualification.qualifiedDomains] });
            Object.freeze(policySignature.qualifiedDomains); Object.freeze(policySignature);
            specialistQualification = Object.freeze({ trustSource: qualificationTrust.reference, proofSource: qualificationProof.reference,
              attestation: qualification, policySignature });
          }
          const completedAt = time();
          if (Math.min(Date.parse(initial.expiresAt), Date.parse(current.expiresAt)) <= completedAt) throw failure();
          if (currentGrant) verifyHat(currentGrant.content, new Date(completedAt).toISOString(), new Date(completedAt).toISOString());
          // Cryptographic/schema work must not carry an observation past a key
          // expiry or revocation that arrived after the first evaluation clock.
          for (const source of [trust, ...(identityTrust ? [identityTrust] : []), ...(qualificationTrust ? [qualificationTrust] : [])]) {
            const selected = JSON.parse(source.content), at = parseUtcInstant(new Date(completedAt).toISOString())!;
            const until = parseUtcInstant(selected.notAfter), revoked = selected.revokedAt === null ? null : parseUtcInstant(selected.revokedAt);
            if (until === null || until <= at || (selected.revokedAt !== null && (revoked === null || revoked <= at))) throw failure();
          }
          if (specialistQualification) {
            const claims = specialistQualification.attestation.claims, at = parseUtcInstant(new Date(completedAt).toISOString())!;
            if (parseUtcInstant(claims.validThrough)! <= at || (claims.revokedAt !== null && parseUtcInstant(claims.revokedAt)! <= at)) throw failure();
          }
          return Object.freeze({ kind: 'git-provider-proof-observation', organizationId: config.organizationId,
            repository: config.repository, branch: config.branch, sourceRevision: input.sourceRevision,
            trustSource: trust.reference, proofSource: proof.reference, attestation,
            ...(signerAuthorization ? { signerAuthorization } : {}), ...(signerIdentity ? { signerIdentity } : {}),
            ...(specialistQualification ? { specialistQualification } : {}),
            gateVerified: false, writeAuthorized: false });
        } catch { throw failure(); }
      })().finally(() => { active = undefined; });
      active = work;
      try {
        return await Promise.race([work, new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => { timedOut = true; reject(failure()); }, 15000);
        })]);
      } finally { clearTimeout(timer); }
  }
  return {
    verify: (rawInput: unknown) => verify(rawInput, 'provider'),
    async verifySigner(rawInput: unknown): Promise<Observation & { signerAuthorization: SignerAuthorization }> {
      const observation = await verify(rawInput, 'hat');
      if (!observation.signerAuthorization) throw failure();
      return observation as Observation & { signerAuthorization: SignerAuthorization };
    },
    async verifySignerIdentity(rawInput: unknown): Promise<Observation & { signerAuthorization: SignerAuthorization; signerIdentity: SignerIdentity }> {
      const observation = await verify(rawInput, 'identity');
      if (!observation.signerAuthorization || !observation.signerIdentity) throw failure();
      return observation as Observation & { signerAuthorization: SignerAuthorization; signerIdentity: SignerIdentity };
    },
    async verifySpecialist(rawInput: unknown): Promise<Observation & { signerAuthorization: SignerAuthorization; signerIdentity: SignerIdentity; specialistQualification: SpecialistQualification }> {
      const observation = await verify(rawInput, 'specialist');
      if (!observation.signerAuthorization || !observation.signerIdentity || !observation.specialistQualification) throw failure();
      return observation as Observation & { signerAuthorization: SignerAuthorization; signerIdentity: SignerIdentity; specialistQualification: SpecialistQualification };
    },
    shutdown() {
      if (!shutdown) { stopping = true; const pending = active; shutdown = (async () => { try { await pending; } catch { /* Caller gets denial. */ } })(); }
      return shutdown;
    },
    status: () => ({ stopping, active: Boolean(active) }),
  };
}
