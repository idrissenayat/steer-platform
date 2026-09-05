import { z } from 'zod';
import { principalSchema, type Principal } from '@steer/tool-registry';
import type { DatabasePool } from './runtime-pool.ts';
import { withTenant } from './index.ts';

const identifier = z.string().min(1).max(200);
const position = z.string().refine((value) => /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n);
const scopeSchema = z.strictObject({ organizationId: identifier, repository: identifier });
export const projectionCursorSchema = scopeSchema.extend({ generation: z.uuid(), position });
export type ProjectionCursor = z.infer<typeof projectionCursorSchema>;
const inputSchema = z.strictObject({ cursor: projectionCursorSchema.nullable(), limit: z.number().int().min(1).max(100) });
const storedSchema = z.strictObject({ generation: z.uuid(), head: position,
  position: position.nullable(), record_key: z.string().min(1).max(500).nullable(),
  source_revision: z.string().regex(/^[a-f0-9]{40}$/).nullable(), content_digest: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
});
export class ProjectionCursorResetRequiredError extends Error {
  constructor() { super('Projection cursor requires a fresh snapshot.'); this.name = 'ProjectionCursorResetRequiredError'; }
}

/** Internal, fixed-scope derived delivery feed. Never an identity or gate authority.
 * Caller must authenticate and refresh authorization around this asynchronous read. */
export function createProjectionChangeReader(pool: DatabasePool, rawScope: z.infer<typeof scopeSchema>, clock = () => new Date()) {
  const scope = scopeSchema.parse(rawScope);
  return { scope: Object.freeze({ ...scope }), async read(rawInput: z.infer<typeof inputSchema>, rawPrincipal: Principal) {
    const input = inputSchema.parse(rawInput); const principal = principalSchema.parse(rawPrincipal);
    if (principal.organizationId !== scope.organizationId || !principal.toolGrants.includes('projection.changes.read') ||
      (input.cursor && (input.cursor.organizationId !== scope.organizationId || input.cursor.repository !== scope.repository))) {
      throw new Error('Projection change read is not allowed.');
    }
    const startedAt = clock().getTime();
    const result = await withTenant(pool, principal, async (client) => {
      const role = (await client.query<{ role: string; login_role: string }>('SELECT current_user AS role, session_user AS login_role')).rows[0];
      if (role?.role !== 'steer_app' || role.login_role !== 'steer_app') throw new Error('Unsafe projection reader role.');
      // One statement snapshot binds the stream head, generation and event page.
      const rows = (await client.query(`SELECT s.generation, s.position::text AS head,
        c.position::text, c.record_key, c.source_revision, c.content_digest
        FROM steer.projection_streams s LEFT JOIN LATERAL (
          SELECT position, record_key, source_revision, content_digest FROM steer.projection_changes
          WHERE organization_id=s.organization_id AND repository=s.repository AND generation=s.generation
            AND position > $3::bigint AND position <= s.position ORDER BY position LIMIT $4
        ) c ON true WHERE s.organization_id=$1 AND s.repository=$2 ORDER BY c.position`,
      [scope.organizationId, scope.repository, input.cursor?.position ?? '0', input.limit])).rows.map((row) => storedSchema.parse(row));
      if (!rows.length) {
        if (input.cursor) throw new ProjectionCursorResetRequiredError();
        return { events: [], cursor: null, hasMore: false, snapshotRequired: true };
      }
      const head = rows[0]!; const offset = BigInt(input.cursor?.position ?? '0');
      if ((input.cursor && input.cursor.generation !== head.generation) || offset > BigInt(head.head)) throw new ProjectionCursorResetRequiredError();
      const events = rows.filter((row) => row.position !== null).map((row, index) => {
        if (row.generation !== head.generation || row.head !== head.head || row.position !== String(offset + BigInt(index + 1)) ||
          row.record_key === null || row.source_revision === null || row.content_digest === null) throw new ProjectionCursorResetRequiredError();
        return { position: row.position!, recordKey: row.record_key, sourceRevision: row.source_revision, contentDigest: row.content_digest };
      });
      const remaining = BigInt(head.head) - offset;
      if (BigInt(events.length) !== (remaining < BigInt(input.limit) ? remaining : BigInt(input.limit))) throw new ProjectionCursorResetRequiredError();
      const next = String(offset + BigInt(events.length));
      return { events, cursor: { ...scope, generation: head.generation, position: next }, hasMore: BigInt(next) < BigInt(head.head), snapshotRequired: input.cursor === null };
    }, clock);
    const finishedAt = clock().getTime();
    if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt || Date.parse(principal.expiresAt) <= finishedAt) throw new Error('A current tenant identity is required.');
    return result;
  } };
}
