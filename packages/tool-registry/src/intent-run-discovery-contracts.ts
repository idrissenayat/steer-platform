import { z } from 'zod';
import { intentDraftScopeSchema, intentDraftReadOutputSchema } from './intent-draft-contracts.ts';
import { intentDevelopmentReadInputSchema } from './intent-development-read-contracts.ts';
import { intentScopeReadInputSchema } from './intent-scope-read-contracts.ts';

const read = intentDraftReadOutputSchema.shape, development = intentDevelopmentReadInputSchema.shape;
const source = z.strictObject({ revision: read.revision, revisionDigest: read.revisionDigest, scopeInputDigest: read.scopeInputDigest });
export const intentRunEntrySchema = z.discriminatedUnion('kind', [
  intentScopeReadInputSchema.pick({ reviewId: true, preparationDigest: true }).extend({ kind: z.literal('scope'), source }),
  intentDevelopmentReadInputSchema.pick({ operationId: true, inputDigest: true }).extend({ kind: z.literal('development'), source }),
]);
export const intentRunCursorSchema = z.strictObject({ revision: read.revision, kind: z.enum(['scope', 'development']),
  runId: development.operationId, latestRevisionDigest: read.revisionDigest });
export const intentRunDiscoveryInputSchema = intentDraftScopeSchema.extend({ draftId: read.draftId, cursor: intentRunCursorSchema.nullable() });
export type IntentRunEntry = z.infer<typeof intentRunEntrySchema>;
export const runCursorFor = (entry: IntentRunEntry, latestRevisionDigest: string) => ({ revision: entry.source.revision, kind: entry.kind,
  runId: entry.kind === 'scope' ? entry.reviewId : entry.operationId, latestRevisionDigest });
export function compareRunCursors(a: z.infer<typeof intentRunCursorSchema>, b: z.infer<typeof intentRunCursorSchema>) {
  return a.revision - b.revision || Number(a.kind === 'development') - Number(b.kind === 'development') || (a.runId < b.runId ? -1 : a.runId === b.runId ? 0 : 1);
}
export const intentRunDiscoveryOutputSchema = intentRunDiscoveryInputSchema.extend({ kind: z.literal('steer-run-discovery/v1'),
  observedAt: z.iso.datetime({ precision: 3 }), useUntil: z.iso.datetime({ precision: 3 }), latest: source,
  entries: z.array(intentRunEntrySchema).max(20), nextCursor: intentRunCursorSchema.nullable(),
  scope: z.literal('current-owner-records-configuration-all-preserved-revisions'),
  order: z.literal('revision-type-id-descending-not-chronological'),
  contentLoaded: z.literal(false), executionAuthorized: z.literal(false), savedToGit: z.literal(false), gateSigned: z.literal(false),
}).superRefine((v, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Invalid retained run page.' });
  if (Date.parse(v.useUntil) <= Date.parse(v.observedAt) || (v.cursor && v.cursor.latestRevisionDigest !== v.latest.revisionDigest)) fail();
  let previous = v.cursor;
  const ids = new Set<string>(), revisions = new Map<number, string>();
  for (const entry of v.entries) {
    const cursor = runCursorFor(entry, v.latest.revisionDigest), key = `${entry.kind}:${cursor.runId}`, binding = JSON.stringify(entry.source);
    if (entry.source.revision > v.latest.revision || (previous && compareRunCursors(cursor, previous) >= 0) || ids.has(key)) fail();
    if (entry.source.revision === v.latest.revision && binding !== JSON.stringify(v.latest)) fail();
    if (revisions.has(entry.source.revision) && revisions.get(entry.source.revision) !== binding) fail();
    ids.add(key); revisions.set(entry.source.revision, binding); previous = cursor;
  }
  if (v.nextCursor && (v.entries.length !== 20 || JSON.stringify(v.nextCursor) !== JSON.stringify(previous))) fail();
});
export type IntentRunDiscoveryInput = z.infer<typeof intentRunDiscoveryInputSchema>;
export type IntentRunDiscoveryOutput = z.infer<typeof intentRunDiscoveryOutputSchema>;
export interface IntentRunDiscoveryReader {
  readonly scope: Readonly<z.infer<typeof intentDraftScopeSchema> & { subject: string }>;
  discover(input: IntentRunDiscoveryInput, revalidate: () => Promise<void>): Promise<unknown>;
}
