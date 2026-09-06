import { createHash } from 'node:crypto';
import { z } from 'zod';
import { principalSchema, briefSaveScopeSchema, briefSaveReferenceSchema, artifactProjectionInputSchema } from '@steer/tool-registry';
import { authorizationDocumentSchema } from './authorization.ts';
import { authorizationRecordSchema } from './oidc.ts';
import type { ArtifactReader } from '../code-host/github.ts';

const sha = z.string().length(40).regex(/^[a-f0-9]{40}$/);
const digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const instant = z.iso.datetime({ precision: 3 });
const configurationSchema = briefSaveScopeSchema.omit({ path: true }).extend({
  issuer: authorizationRecordSchema.shape.issuer, authorizationPath: artifactProjectionInputSchema.shape.path,
  paths: z.array(briefSaveScopeSchema.shape.path).min(1).max(100).refine((paths) => new Set(paths).size === paths.length),
});
const inputSchema = briefSaveReferenceSchema.extend({ expectedHead: sha, requestDigest: digest });
const sessionSchema = z.strictObject({ issuer: authorizationRecordSchema.shape.issuer, establishedAt: instant,
  principal: principalSchema.extend({ expiresAt: instant }),
});
const requiredGrants = ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Membership prerequisite only. Never satisfies BriefWriteAuthority or a gate.
 * authenticate must freshly verify the real request's issuer/session and principal;
 * no caller-supplied session envelope, browser role header or normalized gate facts.
 * This stricter first profile uses millisecond instants without silent rounding. */
export function createGitWriteMembershipVerifier(reader: ArtifactReader, rawConfiguration: unknown, dependencies: {
  authenticate: () => Promise<unknown>; now?: () => Date;
}) {
  const config = configurationSchema.parse(rawConfiguration), binding = { ...reader.binding };
  if (binding.organizationId !== config.organizationId || `github:${binding.repositoryId}` !== config.repository ||
      binding.branch !== config.branch || typeof dependencies.authenticate !== 'function') throw new Error('Invalid write membership source.');
  const clock = dependencies.now ?? (() => new Date()); let active = false;
  const failure = () => new Error('Current write membership could not be verified.');
  return async (rawInput: unknown) => {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success || active) throw failure();
    const input = parsed.data;
    if (input.organizationId !== config.organizationId || input.repository !== config.repository || input.branch !== config.branch ||
        !config.paths.includes(input.path)) throw failure();
    let started: number;
    try { started = clock().getTime(); if (!Number.isFinite(started)) throw failure(); } catch { throw failure(); }
    active = true; let timedOut = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const currentTime = () => {
      const time = clock().getTime();
      if (timedOut || !Number.isFinite(started) || !Number.isFinite(time) || time < started || time - started >= 15000) throw failure();
      return time;
    };
    const authenticate = async () => {
      currentTime(); const session = sessionSchema.parse(await dependencies.authenticate()); const now = currentTime();
      const principal = session.principal;
      if (session.issuer !== config.issuer || principal.subject !== input.subject || principal.organizationId !== input.organizationId ||
          principal.type !== 'human' || new Set(principal.toolGrants).size !== principal.toolGrants.length ||
          new Set(principal.hats).size !== principal.hats.length || !requiredGrants.every((grant) => principal.toolGrants.includes(grant)) ||
          Date.parse(session.establishedAt) > now || Date.parse(principal.expiresAt) <= now ||
          Date.parse(session.establishedAt) >= Date.parse(principal.expiresAt)) throw failure();
      return session;
    };
    const work = (async () => {
      try {
        const initial = await authenticate();
        if (sha.parse(await reader.readHead()) !== input.expectedHead) throw failure(); currentTime();
        const artifact = await reader.readArtifact(config.authorizationPath, input.expectedHead); currentTime();
        if (typeof artifact.content !== 'string') throw failure();
        const bytes = Buffer.from(artifact.content, 'utf8');
        if (bytes.length > 512 * 1024 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== artifact.content ||
            artifact.organizationId !== config.organizationId || artifact.repositoryId !== binding.repositoryId ||
            artifact.path !== config.authorizationPath || artifact.revision !== input.expectedHead ||
            hash(artifact.content) !== artifact.contentDigest ||
            createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== artifact.blobSha) throw failure();
        const document = authorizationDocumentSchema.parse(JSON.parse(artifact.content));
        if (document.organizationId !== config.organizationId) throw failure();
        const identities = new Set<string>();
        for (const record of document.records) {
          const key = JSON.stringify([record.issuer, record.subject]);
          if (record.organizationId !== config.organizationId || identities.has(key)) throw failure();
          identities.add(key);
        }
        const grant = document.records.find((record) => record.issuer === config.issuer && record.subject === input.subject);
        if (!grant || !grant.active || grant.type !== 'human' || !requiredGrants.every((name) => grant.toolGrants.includes(name)) ||
            new Set(grant.hats).size !== grant.hats.length || new Set(grant.toolGrants).size !== grant.toolGrants.length) throw failure();
        const validAfter = Date.parse(instant.parse(grant.validAfter)), grantExpiry = Date.parse(instant.parse(grant.expiresAt));
        const fresh = await authenticate();
        if (fresh.establishedAt !== initial.establishedAt || validAfter > Date.parse(initial.establishedAt) ||
            validAfter >= grantExpiry || [...initial.principal.hats, ...fresh.principal.hats].some((hat) => !grant.hats.includes(hat)) ||
            [...initial.principal.toolGrants, ...fresh.principal.toolGrants].some((name) => !grant.toolGrants.includes(name))) throw failure();
        if (sha.parse(await reader.readHead()) !== input.expectedHead) throw failure();
        const finished = currentTime();
        const validThrough = Math.min(finished + 5000, Date.parse(initial.principal.expiresAt), Date.parse(fresh.principal.expiresAt), grantExpiry);
        if (validThrough <= finished) throw failure();
        return Object.freeze({ ...input, kind: 'git-write-membership-observation' as const,
          issuer: config.issuer, sessionEstablishedAt: initial.establishedAt,
          authorizationPath: config.authorizationPath, authorizationRevision: input.expectedHead,
          authorizationDigest: artifact.contentDigest, authorizationBlobSha: artifact.blobSha,
          evaluatedAt: new Date(finished).toISOString(), validThrough: new Date(validThrough).toISOString(),
          gateVerified: false as const, writeAuthorized: false as const,
        });
      } catch { throw failure(); }
      finally { active = false; }
    })();
    // A timed-out source cannot accumulate concurrent reads or later return a
    // usable observation. Admission remains busy until that underlying read ends.
    try { return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { timedOut = true; reject(failure()); }, 15000);
    })]); } finally { if (timer) clearTimeout(timer); }
  };
}
