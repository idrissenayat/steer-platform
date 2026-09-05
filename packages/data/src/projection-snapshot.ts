import { z } from 'zod';
import { principalSchema, projectionChangeScopeSchema, projectionPositionSchema, projectionSnapshotPageSchema,
  ProjectionSnapshotTooLargeError, type Principal, type ProjectionSnapshotReader } from '@steer/tool-registry';
import type { DatabasePool } from './runtime-pool.ts';
import { withTenant } from './index.ts';

const stored = z.strictObject({ generation: z.uuid().nullable(), head: projectionPositionSchema.nullable(),
  record_key: z.string().min(1).max(500).nullable(), source_revision: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
  content_digest: z.string().regex(/^[a-f0-9]{64}$/).nullable() });

/** One MVCC statement snapshot of references and delivery checkpoint, not current Git authority. */
export function createProjectionSnapshotReader(pool: DatabasePool, rawScope: z.infer<typeof projectionChangeScopeSchema>, clock = () => new Date()): ProjectionSnapshotReader {
  const scope = projectionChangeScopeSchema.parse(rawScope);
  return { scope: Object.freeze({ ...scope }), async read(rawPrincipal: Principal) {
    const principal = principalSchema.parse(rawPrincipal); const started = clock().getTime();
    if (principal.organizationId !== scope.organizationId || !principal.toolGrants.includes('projection.snapshot.read')) throw new Error('Projection snapshot read is not allowed.');
    const result = await withTenant(pool, principal, async (client) => {
      const role = (await client.query<{ role: string; login_role: string }>('SELECT current_user AS role, session_user AS login_role')).rows[0];
      if (role?.role !== 'steer_app' || role.login_role !== 'steer_app') throw new Error('Unsafe projection reader role.');
      // A single statement sees either all of a concurrent projection+feed commit, or none of it.
      const rows = (await client.query(`SELECT s.generation, s.position::text AS head,
        p.record_key, p.source_revision, p.content_digest FROM (SELECT 1) seed
        LEFT JOIN steer.projection_streams s ON s.organization_id=$1 AND s.repository=$2
        LEFT JOIN LATERAL (SELECT record_key, source_revision, content_digest FROM steer.projection_records
          WHERE organization_id=$1 AND repository=$2 ORDER BY record_key COLLATE "C" LIMIT 1001) p ON true
        ORDER BY p.record_key COLLATE "C"`, [scope.organizationId, scope.repository])).rows.map((row) => stored.parse(row));
      if (rows.length > 1000) throw new ProjectionSnapshotTooLargeError();
      const head = rows[0];
      if (!head || (head.generation === null) !== (head.head === null)) throw new Error('Invalid projection snapshot.');
      const records = rows.filter((row) => row.record_key !== null).map((row) => {
        if (row.generation !== head.generation || row.head !== head.head || row.source_revision === null || row.content_digest === null) throw new Error('Invalid projection snapshot.');
        return { recordKey: row.record_key!, sourceRevision: row.source_revision, contentDigest: row.content_digest };
      });
      if (new Set(records.map((record) => record.recordKey)).size !== records.length) throw new Error('Invalid projection snapshot.');
      return projectionSnapshotPageSchema.parse({ records, cursor: head.generation === null ? null : { ...scope, generation: head.generation, position: head.head } });
    }, clock);
    const finished = clock().getTime();
    if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started || Date.parse(principal.expiresAt) <= finished) throw new Error('A current tenant identity is required.');
    return result;
  } };
}
