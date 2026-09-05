import { createHash } from 'node:crypto';
import { z } from 'zod';
import { artifactProjectionInputSchema, artifactProjectionOutputSchema, principalSchema, type ArtifactProjectionReader } from '@steer/tool-registry';
import type { DatabasePool } from './runtime-pool.ts';
import { withTenant } from './index.ts';
import { projectionKey } from './ingestion.ts';

const bindingSchema = z.strictObject({ organizationId: z.string().min(1).max(200), repository: artifactProjectionInputSchema.shape.repository,
  paths: z.array(artifactProjectionInputSchema.shape.path).min(1).max(1000) });
const stored = z.strictObject({ organization_id: z.string(), repository: z.string(), source_revision: z.string(), content_digest: z.string(),
  value: z.strictObject({ path: z.string(), content: z.string().max(512 * 1024), blobSha: z.string() }) });

/** Curated read-only projection scope, never an authority resolver or repository writer. */
export function createArtifactProjectionReader(pool: DatabasePool, rawBinding: z.infer<typeof bindingSchema>, clock = () => new Date()): ArtifactProjectionReader {
  const binding = bindingSchema.parse(rawBinding); const allowed = new Set(binding.paths);
  if (allowed.size !== binding.paths.length) throw new Error('Invalid projection read binding.');
  return { scope: Object.freeze({ organizationId: binding.organizationId, repository: binding.repository, paths: Object.freeze([...allowed]) }), async read(rawInput, rawPrincipal) {
    const input = artifactProjectionInputSchema.parse(rawInput); const principal = principalSchema.parse(rawPrincipal);
    if (principal.organizationId !== binding.organizationId || input.organizationId !== binding.organizationId || input.repository !== binding.repository ||
        !allowed.has(input.path) || !principal.toolGrants.includes('projection.artifact.read')) throw new Error('Projection read is not allowed.');
    return withTenant(pool, principal, async (client) => {
      const role = (await client.query<{ role: string; login_role: string }>('SELECT current_user AS role, session_user AS login_role')).rows[0];
      if (role?.role !== 'steer_app' || role.login_role !== 'steer_app') throw new Error('Unsafe projection reader role.');
      const row = (await client.query(`SELECT organization_id,repository,source_revision,content_digest,
        CASE WHEN octet_length(value::text)<=3200000 THEN value ELSE NULL END AS value FROM steer.projection_records
        WHERE organization_id=$1 AND record_key=$2 LIMIT 1`, [binding.organizationId, projectionKey(binding.repository, input.path)])).rows[0];
      if (!row) return null;
      const value = stored.parse(row);
      if (value.source_revision !== input.revision) return null;
      const content = Buffer.from(value.value.content, 'utf8');
      if (value.organization_id !== binding.organizationId || value.repository !== binding.repository || value.value.path !== input.path || content.length > 512 * 1024 ||
          createHash('sha256').update(content).digest('hex') !== value.content_digest ||
          createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex') !== value.value.blobSha) throw new Error('Invalid artifact projection.');
      return artifactProjectionOutputSchema.parse({ kind: 'projection', organizationId: value.organization_id, repository: value.repository,
        path: value.value.path, revision: value.source_revision, blobSha: value.value.blobSha, contentDigest: value.content_digest, content: value.value.content });
    }, clock);
  } };
}
