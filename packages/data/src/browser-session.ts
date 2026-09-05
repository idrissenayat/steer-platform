import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';
import { z } from 'zod';
import { transactionSchema, sessionSchema, type BrowserSessionStore,
  type BrowserSession, type LoginTransaction } from '@steer/tool-registry/browser-session';
import { createSessionCipher, SessionStorageError, type SessionKeyring } from './session-crypto.ts';

const https = z.string().url().refine((raw) => {
  const value = new URL(raw);
  return value.protocol === 'https:' && !value.username && !value.password && !value.search && !value.hash;
});
const bindingSchema = z.strictObject({ issuer: https, clientId: z.string().regex(/^[A-Za-z0-9_.-]{1,200}$/), redirectUri: https });
export type SessionIdentityBinding = z.infer<typeof bindingSchema>;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
type Kind = 'login_transactions' | 'browser_sessions';
type RecordValue = LoginTransaction | BrowserSession;
type Stored = { encrypted_value: unknown; created_at: Date; expires_at: Date };

/** Derived only from trusted server configuration, never request/claim organization data. */
export function sessionNamespace(binding: SessionIdentityBinding): string {
  try { return createHash('sha256').update(JSON.stringify(bindingSchema.parse(binding))).digest('hex'); }
  catch { throw new SessionStorageError(); }
}

/** Dedicated role and pre-auth namespace; not a business tenant or SQL sandbox. */
async function withNamespace<T>(pool: DatabasePool, namespace: string, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect(); let broken = false;
  try {
    await applyRuntimeQueryLimits(client);
    await client.query("SELECT set_config('steer.auth_namespace', '', false)");
    await client.query('BEGIN');
    const role = (await client.query(`SELECT r.rolname, session_user AS login_role,
      r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb, r.rolinherit,
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='steer_auth' AND c.relowner=r.oid) OR
      EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname='steer_auth' AND n.nspowner=r.oid) AS owns_objects
      FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
    if (!role || role.rolname !== 'steer_auth_runtime' || role.login_role !== 'steer_auth_runtime' ||
        role.rolsuper || role.rolbypassrls || role.rolcreaterole || role.rolcreatedb || role.rolinherit || role.owns_objects) throw new SessionStorageError();
    await client.query("SELECT set_config('steer.auth_namespace', $1, true)", [namespace]);
    const result = await run(client);
    await client.query('COMMIT');
    try { await client.query("SELECT set_config('steer.auth_namespace', '', false)"); } catch { broken = true; }
    return result;
  } catch {
    try { await client.query('ROLLBACK'); await client.query("SELECT set_config('steer.auth_namespace', '', false)"); } catch { broken = true; }
    throw new SessionStorageError();
  } finally { client.release(broken); }
}

export function createPostgresBrowserSessionStore(pool: DatabasePool, config: {
  binding: SessionIdentityBinding; keyring: SessionKeyring; maxEntriesPerKind?: number; now?: () => Date;
}): BrowserSessionStore {
  const namespace = sessionNamespace(config.binding); const cipher = createSessionCipher(config.keyring);
  const capacity = z.number().int().min(1).max(100000).safeParse(config.maxEntriesPerKind ?? 1000);
  if (!capacity.success) throw new SessionStorageError();
  const clock = config.now ?? (() => new Date());
  const now = () => { const value = clock().getTime(); if (!Number.isSafeInteger(value) || value < 0) throw new SessionStorageError(); return value; };
  const parse = (kind: Kind, value: unknown): RecordValue => (kind === 'login_transactions' ? transactionSchema : sessionSchema).parse(value);
  const aad = (kind: Kind, key: string, value: { createdAt: number; expiresAt: number }) =>
    JSON.stringify(['steer-session-v1', namespace, kind, key, value.createdAt, value.expiresAt]);
  const validateTime = (value: RecordValue, time: number) => {
    if (value.createdAt > time || value.expiresAt <= time || value.expiresAt <= value.createdAt || value.expiresAt - value.createdAt > 300000) throw new SessionStorageError();
  };
  const safely = async <T>(run: () => Promise<T>): Promise<T> => { try { return await run(); } catch { throw new SessionStorageError(); } };
  const insert = (kind: Kind, key: string, raw: RecordValue) => safely(async () => {
    hash.parse(key); const value = parse(kind, raw); const started = now(); validateTime(value, started);
    const encrypted = cipher.encrypt(value, aad(kind, key, value));
    return withNamespace(pool, namespace, async (client) => {
      // Serialize capacity decisions across processes; SQL identifiers are closed literals.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${namespace}:${kind}`]);
      const time = now(); if (time < started) throw new SessionStorageError(); validateTime(value, time);
      await client.query(`DELETE FROM steer_auth.${kind} WHERE namespace=$1 AND expires_at <= $2`, [namespace, new Date(time)]);
      const count = (await client.query(`SELECT count(*)::int AS count FROM steer_auth.${kind} WHERE namespace=$1`, [namespace])).rows[0].count;
      if (count >= capacity.data) return false;
      const result = await client.query(`INSERT INTO steer_auth.${kind} (namespace,key_hash,encrypted_value,created_at,expires_at)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [namespace, key, encrypted, new Date(value.createdAt), new Date(value.expiresAt)]);
      return result.rowCount === 1;
    });
  });
  const decode = (kind: Kind, key: string, row: Stored | undefined) => {
    if (!row) return null;
    const createdAt = row.created_at.getTime(); const expiresAt = row.expires_at.getTime();
    const time = now(); if (expiresAt <= time) return null;
    const value = parse(kind, cipher.decrypt(row.encrypted_value, aad(kind, key, { createdAt, expiresAt })));
    if (value.createdAt !== createdAt || value.expiresAt !== expiresAt) throw new SessionStorageError();
    validateTime(value, time); return value;
  };
  return {
    insertTransaction: (key, value) => insert('login_transactions', key, value),
    insertSession: (key, value) => insert('browser_sessions', key, value),
    consumeTransaction: (key) => safely(async () => {
      hash.parse(key);
      // Commit deletion before decryption: corruption cannot restore a consumed login.
      const row = await withNamespace(pool, namespace, async (client) =>
        (await client.query<Stored>('DELETE FROM steer_auth.login_transactions WHERE namespace=$1 AND key_hash=$2 RETURNING encrypted_value,created_at,expires_at', [namespace, key])).rows[0]);
      return decode('login_transactions', key, row);
    }),
    readSession: (key) => safely(async () => {
      hash.parse(key);
      const row = await withNamespace(pool, namespace, async (client) =>
        (await client.query<Stored>('SELECT encrypted_value,created_at,expires_at FROM steer_auth.browser_sessions WHERE namespace=$1 AND key_hash=$2', [namespace, key])).rows[0]);
      return decode('browser_sessions', key, row);
    }),
    deleteSession: (key) => safely(async () => {
      hash.parse(key);
      await withNamespace(pool, namespace, (client) => client.query('DELETE FROM steer_auth.browser_sessions WHERE namespace=$1 AND key_hash=$2', [namespace, key]));
    }),
  };
}
