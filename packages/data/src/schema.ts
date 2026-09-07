import { sql } from 'drizzle-orm';
import { pgSchema, pgPolicy, primaryKey, text, jsonb, timestamp, check, index, bigint, uuid, boolean, foreignKey, unique } from 'drizzle-orm/pg-core';

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

// Disposable projection delivery order, never a Git or gate-signature authority.
export const projectionStreams = steer.table('projection_streams', {
  organizationId: text('organization_id').notNull(), repository: text('repository').notNull(),
  generation: uuid('generation').notNull().defaultRandom(), position: bigint('position', { mode: 'bigint' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.repository] }),
  check('projection_stream_position', sql`${table.position} > 0`),
  pgPolicy('stream_tenant', { for: 'all', using: sql`${table.organizationId} = ${tenant}`, withCheck: sql`${table.organizationId} = ${tenant}` }),
]).enableRLS();

export const projectionChanges = steer.table('projection_changes', {
  organizationId: text('organization_id').notNull(), repository: text('repository').notNull(),
  generation: uuid('generation').notNull(), position: bigint('position', { mode: 'bigint' }).notNull(),
  recordKey: text('record_key').notNull(), sourceRevision: text('source_revision').notNull(), contentDigest: text('content_digest').notNull(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.repository, table.generation, table.position] }),
  check('projection_change_position', sql`${table.position} > 0`),
  pgPolicy('change_tenant', { for: 'all', using: sql`${table.organizationId} = ${tenant}`, withCheck: sql`${table.organizationId} = ${tenant}` }),
]).enableRLS();

// Operator-provisioned spending limits and append-only reservations, not Git projections.
export const steerUsage = pgSchema('steer_usage');
const usageOrg = sql`nullif(current_setting('steer.usage_organization', true), '')`;
const usageBudget = sql`nullif(current_setting('steer.usage_budget', true), '')`;
const usageSubject = sql`nullif(current_setting('steer.usage_subject', true), '')`;
export const modelBudgets = steerUsage.table('model_budgets', {
  organizationId: text('organization_id').notNull(), budgetId: uuid('budget_id').notNull(), subject: text('subject').notNull(),
  configurationRevision: text('configuration_revision').notNull(), approvalDigest: text('approval_digest').notNull(),
  capMicrousd: bigint('cap_microusd', { mode: 'bigint' }).notNull(),
  architectMicrousd: bigint('architect_microusd', { mode: 'bigint' }).notNull(),
  testAgentMicrousd: bigint('test_agent_microusd', { mode: 'bigint' }).notNull(),
  validAfter: timestamp('valid_after', { withTimezone: true }).notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  active: boolean('active').notNull().default(false),
}, table => [primaryKey({ columns: [table.organizationId, table.budgetId] }),
  unique('model_budget_owner').on(table.organizationId, table.budgetId, table.subject),
  check('model_budget_bounds', sql`${table.capMicrousd} BETWEEN 1 AND 1000000000000 AND ${table.architectMicrousd} BETWEEN 1 AND ${table.capMicrousd} AND ${table.testAgentMicrousd} BETWEEN 1 AND ${table.capMicrousd}`),
  check('model_budget_identity', sql`length(${table.organizationId}) BETWEEN 1 AND 200 AND length(${table.subject}) BETWEEN 1 AND 200 AND length(${table.configurationRevision}) BETWEEN 1 AND 200 AND ${table.approvalDigest} ~ '^[a-f0-9]{64}$'`),
  check('model_budget_time', sql`${table.expiresAt} > ${table.validAfter} AND ${table.expiresAt} <= ${table.validAfter} + interval '24 hours'`),
  pgPolicy('budget_scope', { for: 'all', using: sql`${table.organizationId} = ${usageOrg} AND ${table.budgetId}::text = ${usageBudget} AND ${table.subject} = ${usageSubject}`,
    withCheck: sql`${table.organizationId} = ${usageOrg} AND ${table.budgetId}::text = ${usageBudget} AND ${table.subject} = ${usageSubject}` }),
]).enableRLS();
export const modelReservations = steerUsage.table('model_reservations', {
  organizationId: text('organization_id').notNull(), budgetId: uuid('budget_id').notNull(), reservationId: uuid('reservation_id').notNull(),
  subject: text('subject').notNull(), role: text('role').notNull(), amountMicrousd: bigint('amount_microusd', { mode: 'bigint' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.organizationId, table.budgetId, table.reservationId] }),
  foreignKey({ columns: [table.organizationId, table.budgetId, table.subject], foreignColumns: [modelBudgets.organizationId, modelBudgets.budgetId, modelBudgets.subject] }),
  check('model_reservation_amount', sql`${table.amountMicrousd} BETWEEN 1 AND 1000000000000`),
  check('model_reservation_role', sql`${table.role} IN ('architect', 'test-agent')`),
  pgPolicy('reservation_scope', { for: 'all', using: sql`${table.organizationId} = ${usageOrg} AND ${table.budgetId}::text = ${usageBudget} AND ${table.subject} = ${usageSubject}`,
    withCheck: sql`${table.organizationId} = ${usageOrg} AND ${table.budgetId}::text = ${usageBudget} AND ${table.subject} = ${usageSubject}` }),
]).enableRLS();
