import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DatabasePool } from './runtime-pool.ts';
import { principalSchema, type Principal } from '@steer/tool-registry';
import { withTenant } from './index.ts';

const revisionSchema = z.string().regex(/^[a-f0-9]{40}$/);
const sourceSchema = z.strictObject({
  organizationId: z.string().min(1).max(200), repository: z.string().min(1).max(200),
  path: z.string().min(1).max(500).refine((value) => value.split('/').every((part) => part && part !== '.' && part !== '..') && !/[\\\u0000-\u001f\u007f]/.test(value)),
  revision: revisionSchema, blobSha: revisionSchema,
  content: z.string().max(512 * 1024), contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export type VerifiedSourceSnapshot = z.infer<typeof sourceSchema>;
export type IngestionResult = 'applied' | 'duplicate' | 'superseded' | 'repaired';
const valueSchema = z.strictObject({ path: z.string(), content: z.string(), blobSha: revisionSchema });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const projectionKey = (repository: string, path: string) => `artifact:${digest(JSON.stringify([repository, path]))}`;

/** Caller must obtain snapshots from its verified source adapter; this is not a write API. */
export async function ingestVerifiedArtifact(pool: DatabasePool, rawPrincipal: Principal, rawSnapshot: VerifiedSourceSnapshot, expectedRevision: string | null): Promise<IngestionResult> {
  const identity = principalSchema.parse(rawPrincipal);
  const source = sourceSchema.parse(rawSnapshot);
  const expected = revisionSchema.nullable().parse(expectedRevision);
  const bytes = Buffer.from(source.content, 'utf8');
  if (identity.type !== 'agent' || !identity.toolGrants.includes('projection.ingest') || identity.organizationId !== source.organizationId ||
      bytes.length > 512 * 1024 || digest(source.content) !== source.contentDigest ||
      createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== source.blobSha) {
    throw new Error('Unverified or unauthorized source snapshot.');
  }
  const key = projectionKey(source.repository, source.path);
  const eventId = `source:${digest(JSON.stringify([source.repository, source.path, source.revision]))}`;
  const value = { path: source.path, content: source.content, blobSha: source.blobSha };
  return withTenant(pool, identity, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify([source.organizationId, key])]);
    const existingEvent = (await client.query<{ repository: string; source_revision: string; content_digest: string }>(
      'SELECT repository, source_revision, content_digest FROM steer.ingestion_events WHERE organization_id=$1 AND event_id=$2', [source.organizationId, eventId],
    )).rows[0];
    const current = (await client.query<{ repository: string; source_revision: string; content_digest: string; value: unknown }>(
      'SELECT repository, source_revision, content_digest, value FROM steer.projection_records WHERE organization_id=$1 AND record_key=$2', [source.organizationId, key],
    )).rows[0];
    if (existingEvent) {
      if (existingEvent.repository !== source.repository || existingEvent.source_revision !== source.revision || existingEvent.content_digest !== source.contentDigest) {
        throw new Error('Conflicting immutable source event.');
      }
      if (current && current.source_revision !== source.revision) return 'superseded';
      const projected = valueSchema.safeParse(current?.value);
      if (current && projected.success && current.repository === source.repository && current.content_digest === source.contentDigest &&
          projected.data.path === value.path && projected.data.content === value.content && projected.data.blobSha === value.blobSha) return 'duplicate';
    }
    if ((current?.source_revision ?? null) !== expected) throw new Error('Projection revision changed; reconcile again.');
    if (!existingEvent) await client.query(
      'INSERT INTO steer.ingestion_events (organization_id,event_id,repository,source_revision,content_digest) VALUES ($1,$2,$3,$4,$5)',
      [source.organizationId, eventId, source.repository, source.revision, source.contentDigest],
    );
    await client.query(`INSERT INTO steer.projection_records (organization_id,record_key,repository,source_revision,content_digest,value)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (organization_id,record_key) DO UPDATE
      SET repository=EXCLUDED.repository, source_revision=EXCLUDED.source_revision, content_digest=EXCLUDED.content_digest, value=EXCLUDED.value`,
    [source.organizationId, key, source.repository, source.revision, source.contentDigest, value]);
    return existingEvent ? 'repaired' : 'applied';
  });
}
