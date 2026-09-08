import { z } from 'zod';
import { intentScopePrepareInputSchema } from './intent-scope-prepare-contracts.ts';
import { intentScopeReadInputSchema } from './intent-scope-read-contracts.ts';

const reference = intentScopeReadInputSchema.pick({ reviewId: true, preparationDigest: true });
export const intentScopeDiscoveryInputSchema = intentScopePrepareInputSchema.omit({ sourceSnapshotDigest: true, configurationRevision: true })
  .extend({ cursor: reference.shape.reviewId.nullable() });
export const intentScopeDiscoveryOutputSchema = intentScopeDiscoveryInputSchema.extend({
  kind: z.literal('steer-scope-discovery/v1'), observedAt: z.iso.datetime({ precision: 3 }), useUntil: z.iso.datetime({ precision: 3 }),
  entries: z.array(reference).max(20), nextCursor: reference.shape.reviewId.nullable(),
  scope: z.literal('current-owner-configuration-exact-latest-draft'), order: z.literal('review-id-descending-not-chronological'),
  contentLoaded: z.literal(false), executionAuthorized: z.literal(false), savedToGit: z.literal(false), gateSigned: z.literal(false),
}).superRefine((v, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Invalid scope discovery page.' });
  if (Date.parse(v.useUntil) <= Date.parse(v.observedAt)) fail();
  let previous = v.cursor;
  for (const entry of v.entries) { if (previous && entry.reviewId >= previous) fail(); previous = entry.reviewId; }
  if (v.nextCursor && (v.entries.length !== 20 || v.nextCursor !== previous)) fail();
});
export type IntentScopeDiscoveryInput = z.infer<typeof intentScopeDiscoveryInputSchema>;
export type IntentScopeDiscoveryOutput = z.infer<typeof intentScopeDiscoveryOutputSchema>;
export type IntentScopeDiscoveryEntry = IntentScopeDiscoveryOutput['entries'][number];
export interface IntentScopeDiscoveryReader {
  readonly scope: Readonly<Pick<IntentScopeDiscoveryInput, 'organizationId' | 'productId' | 'repository'> & { subject: string }>;
  discover(input: IntentScopeDiscoveryInput, revalidate: () => Promise<void>): Promise<unknown>;
}
