import type { Pool, PoolClient } from 'pg';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { principalSchema, type Principal } from '@steer/tool-registry';
import { projectionRecords } from './schema.ts';

/** Internal boundary only: callbacks are trusted code, never caller-supplied SQL. */
export async function withTenant<T>(pool: Pool, rawPrincipal: Principal, operation: (client: PoolClient) => Promise<T>, clock = () => new Date()): Promise<T> {
  const now = clock();
  const parsed = principalSchema.safeParse(rawPrincipal);
  if (!parsed.success || !Number.isFinite(now.getTime()) || Date.parse(parsed.data.expiresAt) <= now.getTime()) {
    throw new Error('A current tenant identity is required.');
  }
  const client = await pool.connect();
  let broken = false;
  try {
    // Scrub any prior session-level setting before opening our transaction.
    await client.query("SELECT set_config('steer.organization_id', '', false)");
    await client.query('BEGIN');
    const role = await client.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean; owns_objects: boolean }>(`
      SELECT r.rolname, r.rolsuper, r.rolbypassrls,
        EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'steer' AND c.relowner = r.oid) AS owns_objects
      FROM pg_roles r WHERE r.rolname = current_user`);
    const runtime = role.rows[0];
    if (!runtime || !['steer_app', 'steer_projector'].includes(runtime.rolname) ||
        runtime.rolsuper || runtime.rolbypassrls || runtime.owns_objects) throw new Error('Unsafe runtime database role.');
    const entryTime = clock().getTime();
    if (!Number.isFinite(entryTime) || entryTime < now.getTime() || Date.parse(parsed.data.expiresAt) <= entryTime) {
      throw new Error('A current tenant identity is required.');
    }
    await client.query("SELECT set_config('steer.organization_id', $1, true)", [parsed.data.organizationId]);
    const result = await operation(client);
    await client.query('COMMIT');
    // A cleanup failure must evict the connection, not misreport a confirmed
    // commit as a failed operation that a caller might retry.
    try { await client.query("SELECT set_config('steer.organization_id', '', false)"); }
    catch { broken = true; }
    return result;
  } catch (cause) {
    try {
      await client.query('ROLLBACK');
      await client.query("SELECT set_config('steer.organization_id', '', false)");
    } catch { broken = true; }
    throw cause;
  } finally {
    client.release(broken);
  }
}

/** Read only a rebuildable record; no status, grant or signature authority is created. */
export function readProjection(pool: Pool, principal: Principal, recordKey: string) {
  if (!recordKey || recordKey.length > 500) throw new Error('Invalid projection key.');
  return withTenant(pool, principal, async (client) => {
    const rows = await drizzle(client).select().from(projectionRecords).where(and(
      eq(projectionRecords.organizationId, principal.organizationId), eq(projectionRecords.recordKey, recordKey),
    )).limit(1);
    return rows[0] ?? null;
  });
}
