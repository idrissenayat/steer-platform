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
  operationId: uuid('operation_id'), stepId: text('step_id'),
}, table => [primaryKey({ columns: [table.organizationId, table.budgetId, table.reservationId] }),
  unique('model_reservation_step').on(table.organizationId, table.operationId, table.stepId),
  check('model_reservation_step_pair', sql`(${table.operationId} IS NULL) = (${table.stepId} IS NULL)`),
  foreignKey({ columns: [table.organizationId, table.budgetId, table.subject], foreignColumns: [modelBudgets.organizationId, modelBudgets.budgetId, modelBudgets.subject] }),
  check('model_reservation_amount', sql`${table.amountMicrousd} BETWEEN 1 AND 1000000000000`),
  check('model_reservation_role', sql`${table.role} IN ('architect', 'test-agent')`),
  pgPolicy('reservation_scope', { for: 'all', using: sql`${table.organizationId} = ${usageOrg} AND ${table.budgetId}::text = ${usageBudget} AND ${table.subject} = ${usageSubject}`,
    withCheck: sql`${table.organizationId} = ${usageOrg} AND ${table.budgetId}::text = ${usageBudget} AND ${table.subject} = ${usageSubject}` }),
]).enableRLS();

// Non-projection execution metadata. No draft/model bytes, automatic purge or
// runtime provisioning. SQL privileges/FORCE RLS are in the companion migration.
export const steerExecution = pgSchema('steer_execution');
const executionOrg = sql`nullif(current_setting('steer.execution_organization', true), '')`;
const executionSubject = sql`nullif(current_setting('steer.execution_subject', true), '')`;
export const intentOperations = steerExecution.table('intent_operations', {
  organizationId: text('organization_id').notNull(), operationId: uuid('operation_id').notNull(), subject: text('subject').notNull(),
  draftId: uuid('draft_id').notNull(), draftRevision: bigint('draft_revision', { mode: 'number' }).notNull(),
  action: text('action').notNull(), configurationRevision: text('configuration_revision').notNull(),
  binding: jsonb('binding').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, t => [primaryKey({ columns: [t.organizationId, t.operationId] }),
  unique('intent_operation_owner').on(t.organizationId, t.operationId, t.subject),
  unique('intent_operation_submission').on(t.organizationId, t.draftId, t.draftRevision, t.action, t.configurationRevision),
  check('intent_operation_bounds', sql`${t.draftRevision} BETWEEN 1 AND 9007199254740991 AND ${t.action} IN ('develop','candidate-save') AND octet_length(${t.binding}::text) <= 8000 AND ${t.expiresAt} > ${t.createdAt}`),
  pgPolicy('operation_scope', { for: 'all', using: sql`${t.organizationId} = ${executionOrg} AND ${t.subject} = ${executionSubject}`,
    withCheck: sql`${t.organizationId} = ${executionOrg} AND ${t.subject} = ${executionSubject}` }),
]).enableRLS();
export const intentSteps = steerExecution.table('intent_steps', {
  organizationId: text('organization_id').notNull(), operationId: uuid('operation_id').notNull(), subject: text('subject').notNull(),
  stepId: text('step_id').notNull(), record: jsonb('record').notNull(), predecessorResultDigest: text('predecessor_result_digest'),
  budgetId: uuid('budget_id'), reservationId: uuid('reservation_id').notNull(), resultRef: uuid('result_ref'),
}, t => [primaryKey({ columns: [t.organizationId, t.operationId, t.stepId] }),
  foreignKey({ columns: [t.organizationId, t.operationId, t.subject], foreignColumns: [intentOperations.organizationId, intentOperations.operationId, intentOperations.subject] }),
  foreignKey({ columns: [t.organizationId, t.budgetId, t.reservationId], foreignColumns: [modelReservations.organizationId, modelReservations.budgetId, modelReservations.reservationId] }),
  check('intent_step_bounds', sql`${t.stepId} IN ('architect','test-agent','candidate-save') AND octet_length(${t.record}::text) <= 8000 AND (${t.predecessorResultDigest} IS NULL OR ${t.predecessorResultDigest} ~ '^[a-f0-9]{64}$')`),
  pgPolicy('step_scope', { for: 'all', using: sql`${t.organizationId} = ${executionOrg} AND ${t.subject} = ${executionSubject}`,
    withCheck: sql`${t.organizationId} = ${executionOrg} AND ${t.subject} = ${executionSubject}` }),
]).enableRLS();

// Private immutable save originals, not a general draft editor or Git projection.
export const steerDrafts = pgSchema('steer_drafts');
const draftOrg = sql`nullif(current_setting('steer.draft_organization', true), '')`;
const draftOwner = sql`nullif(current_setting('steer.draft_subject', true), '')`;
const draftProduct = sql`nullif(current_setting('steer.draft_product', true), '')`;
export const candidateOriginals = steerDrafts.table('candidate_originals', {
  organizationId: text('organization_id').notNull(), subject: text('subject').notNull(), productId: text('product_id').notNull(),
  operationId: uuid('operation_id').notNull(), draftId: uuid('draft_id').notNull(), draftRevision: bigint('draft_revision', { mode: 'number' }).notNull(),
  inputDigest: text('input_digest').notNull(), payloadDigest: text('payload_digest').notNull(), configurationDigest: text('configuration_digest').notNull(),
  encryptedValue: jsonb('encrypted_value').notNull(), draftCreatedAt: timestamp('draft_created_at', { withTimezone: true }).notNull(),
  retentionDeadline: timestamp('retention_deadline', { withTimezone: true }).notNull(), useUntil: timestamp('use_until', { withTimezone: true }).notNull(),
  held: boolean('held').notNull().default(false), storedAt: timestamp('stored_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.organizationId, t.operationId] }),
  foreignKey({ name: 'candidate_original_operation_owner', columns: [t.organizationId, t.operationId, t.subject],
    foreignColumns: [intentOperations.organizationId, intentOperations.operationId, intentOperations.subject] }),
  check('candidate_original_bounds', sql`${t.draftRevision} BETWEEN 1 AND 9007199254740991 AND ${t.inputDigest} ~ '^[a-f0-9]{64}$' AND ${t.payloadDigest} ~ '^[a-f0-9]{64}$' AND ${t.configurationDigest} ~ '^[a-f0-9]{64}$' AND octet_length(${t.encryptedValue}::text) <= 1050000 AND ${t.retentionDeadline} = ${t.draftCreatedAt} + interval '168 hours' AND ${t.useUntil} <= ${t.retentionDeadline}`),
  pgPolicy('candidate_original_owner', { for: 'all', using: sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}`,
    withCheck: sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}` }),
]).enableRLS();
