import { sql } from 'drizzle-orm';
import { pgSchema, pgPolicy, primaryKey, text, jsonb, timestamp, check, index } from 'drizzle-orm/pg-core';

export const steer = pgSchema('steer');
const tenant = sql`nullif(current_setting('steer.organization_id', true), '')`;

export const ingestionEvents = steer.table('ingestion_events', {
  organizationId: text('organization_id').notNull(),
  eventId: text('event_id').notNull(),
  repository: text('repository').notNull(),
  sourceRevision: text('source_revision').notNull(),
  contentDigest: text('content_digest').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.eventId] }),
  pgPolicy('event_tenant', { for: 'all', using: sql`${table.organizationId} = ${tenant}`, withCheck: sql`${table.organizationId} = ${tenant}` }),
]).enableRLS();

// Ephemeral credentials are isolated from Git-derived business projections.
export const steerAuth = pgSchema('steer_auth');
const authNamespace = sql`nullif(current_setting('steer.auth_namespace', true), '')`;
function authTable(name: 'login_transactions' | 'browser_sessions') {
  return steerAuth.table(name, {
    namespace: text('namespace').notNull(), keyHash: text('key_hash').notNull(),
    encryptedValue: jsonb('encrypted_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  }, (table) => [
    primaryKey({ columns: [table.namespace, table.keyHash] }),
    index(`${name}_expiry`).on(table.namespace, table.expiresAt),
    check(`${name}_keys`, sql`${table.namespace} ~ '^[a-f0-9]{64}$' AND ${table.keyHash} ~ '^[a-f0-9]{64}$'`),
    check(`${name}_ttl`, sql`${table.expiresAt} > ${table.createdAt} AND ${table.expiresAt} <= ${table.createdAt} + interval '5 minutes'`),
    check(`${name}_size`, sql`octet_length(${table.encryptedValue}::text) <= 41000`),
    pgPolicy(`${name}_namespace`, { for: 'all', using: sql`${table.namespace} = ${authNamespace}`, withCheck: sql`${table.namespace} = ${authNamespace}` }),
  ]).enableRLS();
}
export const loginTransactions = authTable('login_transactions');
export const browserSessions = authTable('browser_sessions');

export const projectionRecords = steer.table('projection_records', {
  organizationId: text('organization_id').notNull(),
  recordKey: text('record_key').notNull(),
  repository: text('repository').notNull(),
  sourceRevision: text('source_revision').notNull(),
  contentDigest: text('content_digest').notNull(),
  value: jsonb('value').notNull(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.recordKey] }),
  pgPolicy('projection_tenant', { for: 'all', using: sql`${table.organizationId} = ${tenant}`, withCheck: sql`${table.organizationId} = ${tenant}` }),
]).enableRLS();
