import { sql } from 'drizzle-orm';
import { pgSchema, pgPolicy, primaryKey, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

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
