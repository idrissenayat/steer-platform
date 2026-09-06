import { createHash } from 'node:crypto';
import { z } from 'zod';
import { principalSchema, artifactProjectionInputSchema, reconciliationScopeSchema } from '@steer/tool-registry';
import type { ArtifactSnapshot, RepositoryReader } from './github.ts';

const sha = z.string().length(40).regex(/^[a-f0-9]{40}$/);
const collectionSchema = z.strictObject({ sourceRevision: sha, decisionDigest: z.string().length(64).regex(/^[a-f0-9]{64}$/) });
const path = artifactProjectionInputSchema.shape.path;
const configurationSchema = z.strictObject({ scope: reconciliationScopeSchema, gate: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  artifactRevision: sha, artifactPaths: z.array(path).min(1).max(10), recordPath: path, recordItem: z.string().min(1).max(200),
}).refine((value) => new Set(value.artifactPaths).size === value.artifactPaths.length && !value.artifactPaths.includes(value.recordPath));
// Format/provenance only. These fields do NOT verify a human, qualified hat or signature policy.
const recordSchema = z.object({ version: z.literal('steer-gate-signature/v1'), organization: z.string(), productHome: z.string(), item: z.string(),
  gate: z.union([z.literal(1), z.literal(2), z.literal(3)]), artifactRevision: sha, decision: z.string().min(1).max(64),
  artifacts: z.array(z.object({ path, revision: sha })).min(1).max(10),
  signatures: z.array(z.object({ subject: z.string().min(1).max(200), hat: z.string().min(1).max(100), sequence: z.number().int().positive().safe(), signedAt: z.iso.datetime() })).min(1).max(100),
});

/** Read-only provenance observation, NOT canonical signature-policy verification or authority to act. */
export function createGitGateObserver(reader: RepositoryReader, rawConfiguration: unknown, authenticate: () => Promise<unknown>) {
  const configuration = configurationSchema.parse(rawConfiguration);
  const binding = { ...reader.binding };
  if (configuration.scope.organizationId !== binding.organizationId || configuration.scope.repository !== `github:${binding.repositoryId}`) throw new Error('Invalid gate source binding.');
  type SourceResult = { sourceRevision: string; artifactRevision: string; decisionDigest: string | null;
    record: Readonly<ArtifactSnapshot> | null; artifacts: Readonly<ArtifactSnapshot>[] };
  let active: Promise<SourceResult> | undefined;
  let stopping = false; let shutdown: Promise<void> | undefined;
  const failure = () => new Error('Gate source observation could not be verified.');
  // Only one underlying run owns this clock guard, even after its caller times out.
  let currentTime = () => Date.now();
  const authorize = async () => {
    currentTime(); const principal = principalSchema.parse(await authenticate()); const now = currentTime();
    if (principal.organizationId !== binding.organizationId || principal.type !== 'agent' || principal.hats.length ||
      !principal.toolGrants.includes('gate.observe') || Date.parse(principal.expiresAt) <= now) throw new Error();
    return principal;
  };
  const read = async (file: string, revision: string) => {
    currentTime(); const value = await reader.readArtifact(file, revision); currentTime();
    const bytes = Buffer.from(value.content, 'utf8');
    if (bytes.length > 512 * 1024 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== value.content ||
      value.organizationId !== binding.organizationId || value.repositoryId !== binding.repositoryId || value.path !== file || value.revision !== revision ||
      createHash('sha256').update(bytes).digest('hex') !== value.contentDigest || createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== value.blobSha) throw new Error();
    // Copy only verified fields. A source adapter cannot mutate the retained
    // snapshot through an alias or smuggle unrelated fields into the bundle.
    return Object.freeze({ organizationId: value.organizationId, repositoryId: value.repositoryId,
      path: file, revision, content: value.content, contentDigest: value.contentDigest, blobSha: value.blobSha });
  };
  const run = (expected?: z.infer<typeof collectionSchema>): Promise<SourceResult> => {
      if (stopping || active) return Promise.reject(new Error('Gate observer is not accepting work.'));
      let started: number;
      try { started = Date.now(); if (!Number.isFinite(started)) throw failure(); } catch { return Promise.reject(failure()); }
      let last = started, expired = false, timer: ReturnType<typeof setTimeout> | undefined;
      currentTime = () => {
        const now = Date.now();
        if (expired || !Number.isFinite(now) || now < last || now - started >= 15000) throw failure();
        last = now; return now;
      };
      active = (async () => {
        try {
          const initial = await authorize(); const head = sha.parse(await reader.readHead()); currentTime();
          if (expected && head !== expected.sourceRevision) throw new Error();
          const artifacts: Readonly<ArtifactSnapshot>[] = [];
          let changed = false;
          for (const file of configuration.artifactPaths) {
            const original = await read(file, configuration.artifactRevision), current = await read(file, head);
            if (original.blobSha !== current.blobSha) changed = true;
            artifacts.push(original);
          }
          let decisionDigest: string | null = null;
          let recordSnapshot: Readonly<ArtifactSnapshot> | null = null;
          if (!changed) {
            const parts = configuration.recordPath.split('/'); const fileName = parts.pop()!;
            currentTime();
            const inventory = await reader.readInventory({ roots: [parts.join('/')], fileNames: [fileName] }, head);
            currentTime();
            if (inventory.organizationId !== binding.organizationId || inventory.repositoryId !== binding.repositoryId || inventory.revision !== head ||
              !sha.safeParse(inventory.treeSha).success || inventory.entries.length > 100 || new Set(inventory.entries.map((entry) => entry.path)).size !== inventory.entries.length) throw new Error();
            const entry = inventory.entries.find((value) => value.path === configuration.recordPath);
            if (entry) {
              const snapshot = await read(configuration.recordPath, head);
              if (snapshot.blobSha !== entry.blobSha) throw new Error();
              const record = recordSchema.parse(JSON.parse(snapshot.content));
              if (record.organization !== binding.organizationId || record.productHome !== `https://github.com/${binding.owner}/${binding.repository}` ||
                record.item !== configuration.recordItem || record.gate !== configuration.gate) throw new Error();
              if (record.artifactRevision === configuration.artifactRevision) {
                if (record.artifacts.length !== configuration.artifactPaths.length || new Set(record.artifacts.map((artifact) => artifact.path)).size !== record.artifacts.length ||
                  record.artifacts.some((artifact) => artifact.revision !== configuration.artifactRevision || !configuration.artifactPaths.includes(artifact.path))) throw new Error();
                decisionDigest = snapshot.contentDigest;
                recordSnapshot = snapshot;
              }
            }
          }
          const current = await authorize();
          if (current.subject !== initial.subject || await reader.readHead() !== head ||
            Math.min(Date.parse(initial.expiresAt), Date.parse(current.expiresAt)) <= currentTime()) throw new Error();
          if (expected && (changed || !recordSnapshot || decisionDigest !== expected.decisionDigest)) throw new Error();
          return { sourceRevision: head, artifactRevision: changed ? head : configuration.artifactRevision, decisionDigest,
            record: recordSnapshot, artifacts };
        } catch { throw failure(); }
      })().finally(() => { active = undefined; });
      // Timeout bounds the caller, not an arbitrary source implementation. Keep
      // admission closed and shutdown waiting until the owned source actually ends.
      return Promise.race([active, new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { expired = true; reject(failure()); }, 15000);
      })]).finally(() => { clearTimeout(timer); });
  };
  return {
    async observe() {
      const result = await run();
      // Preserve the existing public observation shape; raw records stay internal.
      return { sourceRevision: result.sourceRevision, artifactRevision: result.artifactRevision, decisionDigest: result.decisionDigest };
    },
    /** Internal exact-source input for the unfinished full gate verifier. A
     * matching send-back record is collectible too; provenance is not approval. */
    async collect(rawExpected: unknown) {
      const expected = collectionSchema.safeParse(rawExpected);
      if (!expected.success) throw new Error('Gate source observation could not be verified.');
      const result = await run(expected.data);
      return Object.freeze({ kind: 'git-gate-source-bundle' as const,
        organizationId: binding.organizationId, repository: `github:${binding.repositoryId}`, branch: binding.branch,
        itemId: configuration.scope.itemId, recordItem: configuration.recordItem, gate: configuration.gate,
        sourceRevision: result.sourceRevision, artifactRevision: result.artifactRevision,
        decisionDigest: expected.data.decisionDigest, record: result.record!, artifacts: Object.freeze(result.artifacts),
        providerVerificationRequired: true as const, gateVerified: false as const, writeAuthorized: false as const });
    },
    shutdown() {
      if (!shutdown) { stopping = true; const pending = active; shutdown = (async () => { try { await pending; } catch { /* Caller receives the failed observation. */ } })(); }
      return shutdown;
    },
    status: () => ({ stopping, active: Boolean(active) }),
  };
}
