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
  check('model_reservation_role', sql`${table.role} IN ('architect', 'test-agent', 'scope-reviewer') AND (${table.role} <> 'scope-reviewer' OR (${table.operationId} IS NOT NULL AND ${table.stepId} ~ '^[a-f0-9]{64}$'))`),
  pgPolicy('reservation_scope', { for: 'all', using: sql`${table.organizationId} = ${usageOrg} AND ${table.budgetId}::text = ${usageBudget} AND ${table.subject} = ${usageSubject}`,
    withCheck: sql`${table.organizationId} = ${usageOrg} AND ${table.budgetId}::text = ${usageBudget} AND ${table.subject} = ${usageSubject}` }),
]).enableRLS();

// Non-projection execution metadata. No draft/model bytes, automatic purge or
// runtime provisioning. SQL privileges/FORCE RLS are in the companion migration.
export const steerExecution = pgSchema('steer_execution');
const executionOrg = sql`nullif(current_setting('steer.execution_organization', true), '')`;
const executionSubject = sql`nullif(current_setting('steer.execution_subject', true), '')`;
const executionProduct = sql`nullif(current_setting('steer.execution_product', true), '')`;
// Separate, default-inactive role terms; the existing budget remains the total cap.
export const scopeReviewTerms = steerUsage.table('scope_review_terms', {
  organizationId: text('organization_id').notNull(), budgetId: uuid('budget_id').notNull(), subject: text('subject').notNull(),
  configurationRevision: text('configuration_revision').notNull(), approvalDigest: text('approval_digest').notNull(),
  profileDigest: text('profile_digest').notNull(), amountMicrousd: bigint('amount_microusd', { mode: 'bigint' }).notNull(),
  active: boolean('active').notNull().default(false),
}, t => [primaryKey({ columns: [t.organizationId, t.budgetId, t.subject] }),
  foreignKey({ columns: [t.organizationId, t.budgetId, t.subject], foreignColumns: [modelBudgets.organizationId, modelBudgets.budgetId, modelBudgets.subject] }),
  check('scope_terms_bounds', sql`${t.approvalDigest} ~ '^[a-f0-9]{64}$' AND ${t.profileDigest} ~ '^[a-f0-9]{64}$' AND length(${t.configurationRevision}) BETWEEN 1 AND 200 AND ${t.amountMicrousd} BETWEEN 1 AND 1000000000000`),
  pgPolicy('scope_terms_scope', { for: 'all', using: sql`${t.organizationId} = ${usageOrg} AND ${t.budgetId}::text = ${usageBudget} AND ${t.subject} = ${usageSubject}`,
    withCheck: sql`${t.organizationId} = ${usageOrg} AND ${t.budgetId}::text = ${usageBudget} AND ${t.subject} = ${usageSubject}` }),
]).enableRLS();
export const scopeReviewRuns = steerExecution.table('scope_review_runs', {
  organizationId: text('organization_id').notNull(), reviewId: uuid('review_id').notNull(), subject: text('subject').notNull(),
  productId: text('product_id').notNull(), draftId: uuid('draft_id').notNull(), draftRevision: bigint('draft_revision', { mode: 'number' }).notNull(),
  preparationDigest: text('preparation_digest').notNull(), configurationDigest: text('configuration_digest').notNull(), manifest: jsonb('manifest').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, t => [primaryKey({ columns: [t.organizationId, t.reviewId] }),
  unique('scope_review_owner').on(t.organizationId, t.reviewId, t.subject, t.productId),
  unique('scope_review_submission').on(t.organizationId, t.subject, t.draftId, t.draftRevision, t.preparationDigest),
  check('scope_review_bounds', sql`${t.draftRevision} BETWEEN 1 AND 1000 AND ${t.preparationDigest} ~ '^[a-f0-9]{64}$' AND ${t.configurationDigest} ~ '^[a-f0-9]{64}$' AND octet_length(${t.manifest}::text) <= 12000 AND ${t.expiresAt} > ${t.createdAt} AND ${t.expiresAt} <= ${t.createdAt} + interval '24 hours'`),
  pgPolicy('scope_review_scope', { for: 'all', using: sql`${t.organizationId} = ${executionOrg} AND ${t.subject} = ${executionSubject} AND ${t.productId} = ${executionProduct}`,
    withCheck: sql`${t.organizationId} = ${executionOrg} AND ${t.subject} = ${executionSubject} AND ${t.productId} = ${executionProduct}` }),
]).enableRLS();
export const scopeReviewBatches = steerExecution.table('scope_review_batches', {
  organizationId: text('organization_id').notNull(), reviewId: uuid('review_id').notNull(), subject: text('subject').notNull(), productId: text('product_id').notNull(),
  batchId: text('batch_id').notNull(), record: jsonb('record').notNull(), budgetId: uuid('budget_id').notNull(), reservationId: uuid('reservation_id').notNull(),
}, t => [primaryKey({ columns: [t.organizationId, t.reviewId, t.batchId] }),
  foreignKey({ columns: [t.organizationId, t.reviewId, t.subject, t.productId], foreignColumns: [scopeReviewRuns.organizationId, scopeReviewRuns.reviewId, scopeReviewRuns.subject, scopeReviewRuns.productId] }),
  foreignKey({ columns: [t.organizationId, t.budgetId, t.reservationId], foreignColumns: [modelReservations.organizationId, modelReservations.budgetId, modelReservations.reservationId] }),
  check('scope_batch_bounds', sql`${t.batchId} ~ '^[a-f0-9]{64}$' AND octet_length(${t.record}::text) <= 8000`),
  pgPolicy('scope_batch_scope', { for: 'all', using: sql`${t.organizationId} = ${executionOrg} AND ${t.subject} = ${executionSubject} AND ${t.productId} = ${executionProduct}`,
    withCheck: sql`${t.organizationId} = ${executionOrg} AND ${t.subject} = ${executionSubject} AND ${t.productId} = ${executionProduct}` }),
]).enableRLS();
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
export const draftLifecycles = steerDrafts.table('draft_lifecycles', {
  organizationId: text('organization_id').notNull(), subject: text('subject').notNull(), productId: text('product_id').notNull(),
  draftId: uuid('draft_id').notNull(), requestId: uuid('request_id').notNull(), configurationDigest: text('configuration_digest').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(), retentionDeadline: timestamp('retention_deadline', { withTimezone: true }).notNull(),
  useUntil: timestamp('use_until', { withTimezone: true }).notNull(), held: boolean('held').notNull().default(false),
  holdReference: uuid('hold_reference'), discardedAt: timestamp('discarded_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }), publicationOperation: uuid('publication_operation'), publicationInput: text('publication_input'),
}, t => [primaryKey({ columns: [t.organizationId, t.draftId] }),
  unique('draft_creation_request').on(t.organizationId, t.subject, t.requestId),
  unique('draft_lifecycle_identity').on(t.organizationId, t.draftId, t.subject, t.productId),
  check('draft_lifecycle_bounds', sql`${t.configurationDigest} ~ '^[a-f0-9]{64}$' AND ${t.retentionDeadline} = ${t.createdAt} + interval '168 hours' AND ${t.useUntil} = LEAST(${t.retentionDeadline}, ${t.discardedAt} + interval '60 seconds', ${t.publishedAt} + interval '60 seconds') AND ${t.held} = (${t.holdReference} IS NOT NULL) AND (${t.publishedAt} IS NULL) = (${t.publicationOperation} IS NULL) AND (${t.publishedAt} IS NULL) = (${t.publicationInput} IS NULL) AND (${t.publicationInput} IS NULL OR ${t.publicationInput} ~ '^[a-f0-9]{64}$')`),
  pgPolicy('draft_lifecycle_owner', { for: 'all', using: sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}`,
    withCheck: sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}` }),
]).enableRLS();
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

export const draftRevisions = steerDrafts.table('draft_revisions', {
  organizationId: text('organization_id').notNull(), subject: text('subject').notNull(), productId: text('product_id').notNull(), draftId: uuid('draft_id').notNull(),
  revision: bigint('revision', { mode: 'number' }).notNull(), mutationId: uuid('mutation_id').notNull(), commandDigest: text('command_digest').notNull(),
  revisionDigest: text('revision_digest').notNull(), record: jsonb('record').notNull(), encryptedValue: jsonb('encrypted_value').notNull(),
  storedAt: timestamp('stored_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.organizationId, t.draftId, t.revision] }),
  unique('draft_revision_mutation').on(t.organizationId, t.draftId, t.mutationId),
  foreignKey({ name: 'draft_revision_owner', columns: [t.organizationId, t.draftId, t.subject, t.productId],
    foreignColumns: [draftLifecycles.organizationId, draftLifecycles.draftId, draftLifecycles.subject, draftLifecycles.productId] }),
  check('draft_revision_bounds', sql`${t.revision} BETWEEN 1 AND 1000 AND ${t.commandDigest} ~ '^[a-f0-9]{64}$' AND ${t.revisionDigest} ~ '^[a-f0-9]{64}$' AND octet_length(${t.record}::text) <= 8000 AND octet_length(${t.encryptedValue}::text) <= 1050000`),
  pgPolicy('draft_revision_owner', { for: 'all', using: sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}`,
    withCheck: sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}` }),
]).enableRLS();

// Private original operation context; never an execution grant or provider receipt.
export const developmentOriginals = steerDrafts.table('development_originals', {
  organizationId: text('organization_id').notNull(), subject: text('subject').notNull(), productId: text('product_id').notNull(),
  operationId: uuid('operation_id').notNull(), inputDigest: text('input_digest').notNull(),
  draftId: uuid('draft_id').notNull(), draftRevision: bigint('draft_revision', { mode: 'number' }).notNull(),
  record: jsonb('record').notNull(), encryptedValue: jsonb('encrypted_value').notNull(),
}, t => [primaryKey({ columns: [t.organizationId,t.operationId] }),
  foreignKey({ name:'development_original_operation',columns:[t.organizationId,t.operationId],foreignColumns:[intentOperations.organizationId,intentOperations.operationId] }),
  foreignKey({ name:'development_original_source',columns:[t.organizationId,t.draftId,t.draftRevision],foreignColumns:[draftRevisions.organizationId,draftRevisions.draftId,draftRevisions.revision] }),
  check('development_original_bounds',sql`${t.inputDigest} ~ '^[a-f0-9]{64}$' AND octet_length(${t.record}::text) <= 8000 AND octet_length(${t.encryptedValue}::text) <= 1050000`),
  pgPolicy('development_original_owner',{ for:'all',using:sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}`,
    withCheck:sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}` }),
]).enableRLS();

// Exact private scope input, independently encrypted from execution metadata.
export const scopeReviewOriginals = steerDrafts.table('scope_review_originals', {
  organizationId:text('organization_id').notNull(),subject:text('subject').notNull(),productId:text('product_id').notNull(),
  reviewId:uuid('review_id').notNull(),preparationDigest:text('preparation_digest').notNull(),payloadDigest:text('payload_digest').notNull(),
  draftId:uuid('draft_id').notNull(),draftRevision:bigint('draft_revision',{mode:'number'}).notNull(),
  record:jsonb('record').notNull(),encryptedValue:jsonb('encrypted_value').notNull(),
},t=>[primaryKey({columns:[t.organizationId,t.reviewId]}),
  foreignKey({name:'scope_original_review_owner',columns:[t.organizationId,t.reviewId,t.subject,t.productId],foreignColumns:[scopeReviewRuns.organizationId,scopeReviewRuns.reviewId,scopeReviewRuns.subject,scopeReviewRuns.productId]}),
  foreignKey({name:'scope_original_source',columns:[t.organizationId,t.draftId,t.draftRevision],foreignColumns:[draftRevisions.organizationId,draftRevisions.draftId,draftRevisions.revision]}),
  check('scope_original_bounds',sql`${t.preparationDigest} ~ '^[a-f0-9]{64}$' AND ${t.payloadDigest} ~ '^[a-f0-9]{64}$' AND octet_length(${t.record}::text) <= 8000 AND octet_length(${t.encryptedValue}::text) <= 4200000`),
  pgPolicy('scope_original_owner',{for:'all',using:sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}`,
    withCheck:sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}`}),
]).enableRLS();

// Private immutable adapter observations; metadata is not proof of provider authorship.
export const developmentObservations = steerDrafts.table('development_observations', {
  organizationId: text('organization_id').notNull(), subject: text('subject').notNull(), productId: text('product_id').notNull(),
  operationId: uuid('operation_id').notNull(), stepId: text('step_id').notNull(), stage: text('stage').notNull(),
  draftId: uuid('draft_id').notNull(), draftRevision: bigint('draft_revision', { mode: 'number' }).notNull(),
  payloadDigest: text('payload_digest').notNull(), record: jsonb('record').notNull(), encryptedValue: jsonb('encrypted_value').notNull(),
}, t => [primaryKey({ columns: [t.organizationId,t.operationId,t.stepId,t.stage] }),
  foreignKey({ name:'development_observation_step', columns:[t.organizationId,t.operationId,t.stepId], foreignColumns:[intentSteps.organizationId,intentSteps.operationId,intentSteps.stepId] }),
  foreignKey({ name:'development_observation_original', columns:[t.organizationId,t.operationId], foreignColumns:[developmentOriginals.organizationId,developmentOriginals.operationId] }),
  foreignKey({ name:'development_observation_source', columns:[t.organizationId,t.draftId,t.draftRevision], foreignColumns:[draftRevisions.organizationId,draftRevisions.draftId,draftRevisions.revision] }),
  check('development_observation_bounds', sql`${t.stepId} IN ('architect','test-agent') AND ${t.stage} IN ('request','response') AND ${t.payloadDigest} ~ '^[a-f0-9]{64}$' AND octet_length(${t.record}::text) <= 8000 AND octet_length(${t.encryptedValue}::text) <= 1050000`),
  pgPolicy('development_observation_owner', { for:'all', using:sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}`,
    withCheck:sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}` }),
]).enableRLS();

// Immutable captured worker outputs, separate from editable document snapshots.
export const developmentResults = steerDrafts.table('development_results', {
  organizationId: text('organization_id').notNull(), subject: text('subject').notNull(), productId: text('product_id').notNull(),
  operationId: uuid('operation_id').notNull(), stepId: text('step_id').notNull(), resultRef: uuid('result_ref').notNull(),
  draftId: uuid('draft_id').notNull(), draftRevision: bigint('draft_revision', { mode: 'number' }).notNull(),
  resultDigest: text('result_digest').notNull(), record: jsonb('record').notNull(), encryptedValue: jsonb('encrypted_value').notNull(),
}, t => [primaryKey({ columns: [t.organizationId, t.operationId, t.stepId] }),
  unique('development_result_reference').on(t.organizationId, t.resultRef),
  foreignKey({ name: 'development_result_step', columns: [t.organizationId, t.operationId, t.stepId],
    foreignColumns: [intentSteps.organizationId, intentSteps.operationId, intentSteps.stepId] }),
  foreignKey({ name: 'development_result_source', columns: [t.organizationId, t.draftId, t.draftRevision],
    foreignColumns: [draftRevisions.organizationId, draftRevisions.draftId, draftRevisions.revision] }),
  check('development_result_bounds', sql`${t.stepId} IN ('architect','test-agent') AND ${t.resultDigest} ~ '^[a-f0-9]{64}$' AND octet_length(${t.record}::text) <= 16000 AND octet_length(${t.encryptedValue}::text) <= 1050000`),
  pgPolicy('development_result_owner', { for: 'all', using: sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}`,
    withCheck: sql`${t.organizationId} = ${draftOrg} AND ${t.subject} = ${draftOwner} AND ${t.productId} = ${draftProduct}` }),
]).enableRLS();
