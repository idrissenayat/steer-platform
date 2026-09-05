import { createHash } from 'node:crypto';
import { z } from 'zod';
import { artifactProjectionInputSchema, artifactProjectionOutputSchema, briefCatalogRecordsSchema, briefProjectionInputSchema,
  principalSchema, type ArtifactProjectionReader } from '@steer/tool-registry';
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
  const briefPaths = binding.paths.filter((path) => briefProjectionInputSchema.shape.path.safeParse(path).success);
  const catalogKeys = briefPaths.map((path) => projectionKey(binding.repository, path));
  return { scope: Object.freeze({ organizationId: binding.organizationId, repository: binding.repository, paths: Object.freeze([...allowed]) }),
    async catalog(rawPrincipal) {
      const principal = principalSchema.parse(rawPrincipal); const started = clock().getTime();
      if (principal.organizationId !== binding.organizationId || (principal.type === 'agent' && principal.hats.length) ||
        !['intent.brief.catalog', 'intent.brief.read', 'projection.artifact.read'].every((grant) => principal.toolGrants.includes(grant))) throw new Error('Brief catalog read is not allowed.');
      const records = await withTenant(pool, principal, async (client) => {
        const role = (await client.query<{ role: string; login_role: string }>('SELECT current_user AS role, session_user AS login_role')).rows[0];
        if (role?.role !== 'steer_app' || role.login_role !== 'steer_app') throw new Error('Unsafe projection reader role.');
        // One MVCC statement over the complete fixed key set. Never return content,
        // unrelated metadata or a partial LIMIT page. CASE bounds corrupt scalar data.
        const rows = (await client.query(`SELECT record_key,
          CASE WHEN octet_length(source_revision)<=40 THEN source_revision ELSE NULL END AS source_revision,
          CASE WHEN octet_length(content_digest)<=64 THEN content_digest ELSE NULL END AS content_digest,
          CASE WHEN octet_length(value->>'path')<=500 THEN value->>'path' ELSE NULL END AS path
          FROM steer.projection_records WHERE organization_id=$1 AND repository=$2
          AND record_key=ANY($3::text[]) ORDER BY record_key COLLATE "C" LIMIT 1001`,
        [binding.organizationId, binding.repository, catalogKeys])).rows;
        if (rows.length > 1000) throw new Error('Invalid Brief catalog.');
        const output = briefCatalogRecordsSchema.parse(rows.map((row) => ({ path: row.path, revision: row.source_revision, contentDigest: row.content_digest })));
        if (new Set(output.map((row) => row.path)).size !== output.length || output.some((row, index) =>
          !briefPaths.includes(row.path) || rows[index]!.record_key !== projectionKey(binding.repository, row.path))) throw new Error('Invalid Brief catalog.');
        return output.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
      }, clock);
      const finished = clock().getTime();
      if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started || Date.parse(principal.expiresAt) <= finished) throw new Error('A current tenant identity is required.');
      return records;
    }, async read(rawInput, rawPrincipal) {
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
