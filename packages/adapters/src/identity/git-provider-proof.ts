import { createHash } from 'node:crypto';
import { z } from 'zod';
import { principalSchema, briefSaveScopeSchema, artifactProjectionInputSchema } from '@steer/tool-registry';
import type { ArtifactReader } from '../code-host/github.ts';
import { gateProviderExpectedSchema, verifyGateProviderAttestation } from './gate-provider-proof.ts';
import { authorizationDocumentSchema } from './authorization.ts';
import { authorizationRecordSchema } from './oidc.ts';
import { parseUtcInstant } from '@steer/tool-registry/gate-policy';

const sha = z.string().length(40).regex(/^[a-f0-9]{40}$/), digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const path = artifactProjectionInputSchema.shape.path;
const configurationSchema = briefSaveScopeSchema.omit({ path: true }).extend({ trustPath: path, trustDigest: digest,
  proofPaths: z.array(path).min(1).max(100).refine((paths) => new Set(paths).size === paths.length),
  signerAuthorization: z.strictObject({ path, issuer: authorizationRecordSchema.shape.issuer }).optional(),
}).refine((value) => !value.proofPaths.includes(value.trustPath) && (!value.signerAuthorization ||
  (value.signerAuthorization.path !== value.trustPath && !value.proofPaths.includes(value.signerAuthorization.path))));
const inputSchema = z.strictObject({ sourceRevision: sha, proofPath: path, proofDigest: digest, expected: gateProviderExpectedSchema });
const signerInputSchema = inputSchema.extend({ authorizationRevision: sha });
type Attestation = NonNullable<ReturnType<typeof verifyGateProviderAttestation>>;
type SourceReference = Readonly<{ path: string; revision: string; contentDigest: string; blobSha: string }>;
type SignerAuthorization = Readonly<{ issuer: string; subject: string; hat: string;
  historicalSource: SourceReference; currentSource: SourceReference;
  historicalHatVerified: true; currentHatVerified: true;
  identityEvidenceVerificationRequired: true; qualificationVerificationRequired: true }>;
type Observation = Readonly<{ kind: 'git-provider-proof-observation'; organizationId: string; repository: string; branch: string;
  sourceRevision: string; trustSource: SourceReference; proofSource: SourceReference; attestation: Attestation;
  signerAuthorization?: SignerAuthorization; gateVerified: false; writeAuthorized: false }>;

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
  async function verify(rawInput: unknown, verifySigner: boolean): Promise<Observation> {
      if (stopping || active) throw failure();
      const parsed = (verifySigner ? signerInputSchema : inputSchema).safeParse(rawInput); if (!parsed.success) throw failure();
      const input = parsed.data;
      const authorizationRevision = 'authorizationRevision' in input ? sha.parse(input.authorizationRevision) : undefined;
      if (verifySigner && (!config.signerAuthorization || !authorizationRevision)) throw failure();
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
          return Object.freeze({ kind: 'git-provider-proof-observation', organizationId: config.organizationId,
            repository: config.repository, branch: config.branch, sourceRevision: input.sourceRevision,
            trustSource: trust.reference, proofSource: proof.reference, attestation,
            ...(signerAuthorization ? { signerAuthorization } : {}), gateVerified: false, writeAuthorized: false });
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
    verify: (rawInput: unknown) => verify(rawInput, false),
    async verifySigner(rawInput: unknown): Promise<Observation & { signerAuthorization: SignerAuthorization }> {
      const observation = await verify(rawInput, true);
      if (!observation.signerAuthorization) throw failure();
      return observation as Observation & { signerAuthorization: SignerAuthorization };
    },
    shutdown() {
      if (!shutdown) { stopping = true; const pending = active; shutdown = (async () => { try { await pending; } catch { /* Caller gets denial. */ } })(); }
      return shutdown;
    },
    status: () => ({ stopping, active: Boolean(active) }),
  };
}
