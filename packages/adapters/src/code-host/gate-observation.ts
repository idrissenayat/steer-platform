import { createHash } from 'node:crypto';
import { z } from 'zod';
import { principalSchema, artifactProjectionInputSchema, reconciliationScopeSchema } from '@steer/tool-registry';
import type { RepositoryReader } from './github.ts';

const sha = z.string().regex(/^[a-f0-9]{40}$/);
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
  let active: Promise<{ sourceRevision: string; artifactRevision: string; decisionDigest: string | null }> | undefined;
  let stopping = false; let shutdown: Promise<void> | undefined;
  const authorize = async () => {
    const principal = principalSchema.parse(await authenticate());
    if (principal.organizationId !== binding.organizationId || principal.type !== 'agent' || principal.hats.length ||
      !principal.toolGrants.includes('gate.observe') || Date.parse(principal.expiresAt) <= Date.now()) throw new Error();
    return principal;
  };
  const read = async (file: string, revision: string) => {
    const value = await reader.readArtifact(file, revision); const bytes = Buffer.from(value.content, 'utf8');
    if (bytes.length > 512 * 1024 || value.organizationId !== binding.organizationId || value.repositoryId !== binding.repositoryId || value.path !== file || value.revision !== revision ||
      createHash('sha256').update(bytes).digest('hex') !== value.contentDigest || createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== value.blobSha) throw new Error();
    return value;
  };
  return {
    observe() {
      if (stopping || active) return Promise.reject(new Error('Gate observer is not accepting work.'));
      active = (async () => {
        try {
          const initial = await authorize(); const head = sha.parse(await reader.readHead());
          let changed = false;
          for (const file of configuration.artifactPaths) {
            const original = await read(file, configuration.artifactRevision), current = await read(file, head);
            if (original.blobSha !== current.blobSha) changed = true;
          }
          let decisionDigest: string | null = null;
          if (!changed) {
            const parts = configuration.recordPath.split('/'); const fileName = parts.pop()!;
            const inventory = await reader.readInventory({ roots: [parts.join('/')], fileNames: [fileName] }, head);
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
              }
            }
          }
          const current = await authorize();
          if (current.subject !== initial.subject || Date.parse(initial.expiresAt) <= Date.now() || await reader.readHead() !== head) throw new Error();
          return { sourceRevision: head, artifactRevision: changed ? head : configuration.artifactRevision, decisionDigest };
        } catch { throw new Error('Gate source observation could not be verified.'); }
      })().finally(() => { active = undefined; });
      return active;
    },
    shutdown() {
      if (!shutdown) { stopping = true; const pending = active; shutdown = (async () => { try { await pending; } catch { /* Caller receives the failed observation. */ } })(); }
      return shutdown;
    },
    status: () => ({ stopping, active: Boolean(active) }),
  };
}
