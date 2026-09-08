import { z } from 'zod';
import { intentDraftScopeSchema, intentDraftReadOutputSchema } from './intent-draft-contracts.ts';
import { intentDevelopmentStartInputSchema } from './intent-development-start-contracts.ts';

const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const timestamp = z.iso.datetime({ precision: 3 });
export const draftDiscoveryCursorSchema = z.strictObject({ createdAt: timestamp, draftId: uuid });
export const intentDraftDiscoveryInputSchema = intentDraftScopeSchema.extend({ cursor: draftDiscoveryCursorSchema.nullable() });
const read = intentDraftReadOutputSchema.shape, start = intentDevelopmentStartInputSchema.shape;
const latest = z.strictObject({ revision: read.revision, revisionDigest: read.revisionDigest, scopeInputDigest: read.scopeInputDigest, sourceRevision: read.sourceRevision });
export const intentDraftDiscoveryEntrySchema = z.strictObject({ draftId: uuid, createdAt: timestamp, useUntil: timestamp,
  latest: latest.nullable(), run: z.strictObject({ operationId: start.operationId, inputDigest: start.inputDigest }).nullable(),
}).refine(v => Date.parse(v.createdAt) < Date.parse(v.useUntil) && (v.latest !== null || v.run === null)
  && (!v.latest || v.latest.sourceRevision <= v.latest.revision));
export const intentDraftDiscoveryOutputSchema = intentDraftDiscoveryInputSchema.extend({ kind: z.literal('steer-draft-discovery/v1'),
  observedAt: timestamp, entries: z.array(intentDraftDiscoveryEntrySchema).max(20), nextCursor: draftDiscoveryCursorSchema.nullable(),
  scope: z.literal('current-owner-records-configuration'), contentLoaded: z.literal(false),
  executionAuthorized: z.literal(false), savedToGit: z.literal(false), gateSigned: z.literal(false),
}).superRefine((v, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Invalid draft discovery page.' });
  let previous = v.cursor;
  for (const entry of v.entries) {
    if (Date.parse(entry.createdAt) > Date.parse(v.observedAt) || Date.parse(entry.useUntil) <= Date.parse(v.observedAt)) fail();
    if (previous && (entry.createdAt > previous.createdAt || (entry.createdAt === previous.createdAt && entry.draftId >= previous.draftId))) fail();
    previous = entry;
  }
  if (new Set(v.entries.map(e => e.draftId)).size !== v.entries.length) fail();
  if (v.nextCursor && (v.entries.length !== 20 || v.nextCursor.draftId !== previous?.draftId || v.nextCursor.createdAt !== previous?.createdAt)) fail();
});
export type IntentDraftDiscoveryInput = z.infer<typeof intentDraftDiscoveryInputSchema>;
export type IntentDraftDiscoveryOutput = z.infer<typeof intentDraftDiscoveryOutputSchema>;
export type IntentDraftDiscoveryEntry = z.infer<typeof intentDraftDiscoveryEntrySchema>;
export interface IntentDraftDiscoveryReader {
  readonly scope: Readonly<z.infer<typeof intentDraftScopeSchema> & { subject: string }>;
  discover(input: IntentDraftDiscoveryInput, revalidate: () => Promise<void>): Promise<unknown>;
}
