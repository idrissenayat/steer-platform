import { createHash } from 'node:crypto';
import { z } from 'zod';
import { principalSchema, briefSaveScopeSchema, artifactProjectionInputSchema } from '@steer/tool-registry';
import type { ArtifactReader } from '../code-host/github.ts';
import { gateProviderExpectedSchema, verifyGateProviderAttestation } from './gate-provider-proof.ts';

const sha = z.string().length(40).regex(/^[a-f0-9]{40}$/), digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const path = artifactProjectionInputSchema.shape.path;
const configurationSchema = briefSaveScopeSchema.omit({ path: true }).extend({ trustPath: path, trustDigest: digest,
  proofPaths: z.array(path).min(1).max(100).refine((paths) => new Set(paths).size === paths.length),
}).refine((value) => !value.proofPaths.includes(value.trustPath));
const inputSchema = z.strictObject({ sourceRevision: sha, proofPath: path, proofDigest: digest, expected: gateProviderExpectedSchema });
type Attestation = NonNullable<ReturnType<typeof verifyGateProviderAttestation>>;
type SourceReference = Readonly<{ path: string; revision: string; contentDigest: string; blobSha: string }>;
type Observation = Readonly<{ kind: 'git-provider-proof-observation'; organizationId: string; repository: string; branch: string;
  sourceRevision: string; trustSource: SourceReference; proofSource: SourceReference; attestation: Attestation;
  gateVerified: false; writeAuthorized: false }>;

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
  return {
    async verify(rawInput: unknown): Promise<Observation> {
      if (stopping || active) throw failure();
      const parsed = inputSchema.safeParse(rawInput); if (!parsed.success) throw failure();
      const input = parsed.data;
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
      const read = async (file: string, expectedDigest: string, maxBytes: number) => {
        time(); const snapshot = await reader.readArtifact(file, input.sourceRevision); time();
        if (typeof snapshot.content !== 'string') throw failure();
        const bytes = Buffer.from(snapshot.content, 'utf8');
        if (bytes.length > maxBytes || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== snapshot.content ||
          snapshot.organizationId !== config.organizationId || snapshot.repositoryId !== binding.repositoryId ||
          snapshot.path !== file || snapshot.revision !== input.sourceRevision || snapshot.contentDigest !== expectedDigest ||
          createHash('sha256').update(bytes).digest('hex') !== expectedDigest ||
          createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== snapshot.blobSha) throw failure();
        return Object.freeze({ content: snapshot.content, reference: Object.freeze({ path: file, revision: input.sourceRevision,
          contentDigest: expectedDigest, blobSha: snapshot.blobSha }) });
      };
      const work = (async (): Promise<Observation> => {
        try {
          const initial = await authenticate();
          if (sha.parse(await reader.readHead()) !== input.sourceRevision) throw failure(); time();
          const trust = await read(config.trustPath, config.trustDigest, 16384);
          const proof = await read(input.proofPath, input.proofDigest, 65536);
          const current = await authenticate();
          if (current.subject !== initial.subject || sha.parse(await reader.readHead()) !== input.sourceRevision) throw failure();
          const finished = time();
          if (Math.min(Date.parse(initial.expiresAt), Date.parse(current.expiresAt)) <= finished) throw failure();
          // Verify only after current-source/identity checks, at the final clock.
          const attestation = verifyGateProviderAttestation(JSON.parse(proof.content), JSON.parse(trust.content), input.expected, new Date(finished).toISOString());
          if (!attestation || attestation.proofDigest !== proof.reference.contentDigest || attestation.trustDigest !== trust.reference.contentDigest) throw failure();
          if (Math.min(Date.parse(initial.expiresAt), Date.parse(current.expiresAt)) <= time()) throw failure();
          return Object.freeze({ kind: 'git-provider-proof-observation', organizationId: config.organizationId,
            repository: config.repository, branch: config.branch, sourceRevision: input.sourceRevision,
            trustSource: trust.reference, proofSource: proof.reference, attestation, gateVerified: false, writeAuthorized: false });
        } catch { throw failure(); }
      })().finally(() => { active = undefined; });
      active = work;
      try {
        return await Promise.race([work, new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => { timedOut = true; reject(failure()); }, 15000);
        })]);
      } finally { clearTimeout(timer); }
    },
    shutdown() {
      if (!shutdown) { stopping = true; const pending = active; shutdown = (async () => { try { await pending; } catch { /* Caller gets denial. */ } })(); }
      return shutdown;
    },
    status: () => ({ stopping, active: Boolean(active) }),
  };
}
