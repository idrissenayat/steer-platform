import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';

export interface DatabasePool { connect(): Promise<PoolClient> }
export class DatabaseCapacityError extends Error {
  constructor() { super('The runtime database connection is unavailable.'); }
}
const configurationSchema = z.strictObject({
  host: z.string().min(1).max(253).regex(/^[A-Za-z0-9.:-]+$/),
  port: z.number().int().min(1).max(65535), database: z.string().min(1).max(63).regex(/^[A-Za-z0-9_-]+$/),
  user: z.enum(['steer_app', 'steer_projector', 'steer_auth_runtime']),
  password: z.string().min(1).max(4096),
  transport: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('tls'), ca: z.string().min(1).max(65536) }),
    z.strictObject({ kind: z.literal('isolated-loopback-test') }),
  ]),
});

/** Limits are server-side, not a client-only rejection that leaves SQL running. */
export async function applyRuntimeQueryLimits(client: PoolClient) {
  await client.query("SELECT set_config('statement_timeout', '5000', false), set_config('lock_timeout', '1000', false), set_config('idle_in_transaction_session_timeout', '5000', false)");
}

/** Trusted configuration only; no DSN/environment option merging or SQL authority. */
export function createRuntimePool(raw: unknown) {
  const parsed = configurationSchema.safeParse(raw);
  if (!parsed.success || (parsed.data.transport.kind === 'isolated-loopback-test' && parsed.data.host !== '127.0.0.1')) {
    throw new Error('Invalid runtime database configuration.');
  }
  const config = parsed.data;
  const pool = new Pool({ host: config.host, port: config.port, database: config.database,
    user: config.user, password: config.password,
    // pg treats an empty option string as absent and would inherit PGOPTIONS.
    options: '-c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=5000',
    application_name: 'steer-runtime', client_encoding: 'UTF8',
    ssl: config.transport.kind === 'tls' ? { ca: config.transport.ca, rejectUnauthorized: true } : false,
    max: 8, connectionTimeoutMillis: 2000, idleTimeoutMillis: 10000, maxLifetimeSeconds: 300,
    statement_timeout: 5000, lock_timeout: 1000, idle_in_transaction_session_timeout: 5000,
  });
  let pending = 0; let closed = false; let idleErrors = 0; let ending: Promise<void> | undefined;
  // pg removes broken idle clients. Expose a content-free health count, not raw errors.
  pool.on('error', () => { idleErrors++; });
  return {
    async connect(): Promise<PoolClient> {
      if (closed || pending >= 32) throw new DatabaseCapacityError();
      pending++;
      try { return await pool.connect(); }
      catch { throw new DatabaseCapacityError(); }
      finally { pending--; }
    },
    status: () => ({ connections: pool.totalCount, idle: pool.idleCount, pending, idleErrors, closed }),
    end() { closed = true; ending ??= pool.end(); return ending; },
  };
}
