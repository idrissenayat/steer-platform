import { z } from 'zod';
import { intentDraftScopeSchema } from './intent-draft-contracts.ts';
import { intentScopeBatchResultsSchema, verifyIntentScopeBatchResults } from './intent-scope-batches.ts';

const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/), revision = z.number().int().min(1).max(1000);
export const intentScopeReadInputSchema = intentDraftScopeSchema.extend({ reviewId: uuid, preparationDigest: digest });
const batch = z.strictObject({ batchId: digest,
  state: z.enum(['pending', 'claimed', 'dispatch-committed', 'outcome-unknown', 'succeeded', 'failed-known']), resultDigest: digest.nullable() });
export const intentScopeReadOutputSchema = intentScopeReadInputSchema.extend({ kind: z.literal('steer-scope-review-read/v1'),
  subject: z.string().min(1).max(200), source: z.strictObject({ draftId: uuid, revision, revisionDigest: digest, scopeInputDigest: digest, latestRevision: revision }),
  status: z.enum(['pending', 'review-available', 'incomplete', 'attention-required', 'superseded', 'expired']),
  batches: z.array(batch).min(1).max(8).nullable(), review: intentScopeBatchResultsSchema.nullable(),
  semanticQualityVerified: z.literal(false), authoritativeClearance: z.literal(false), savedToGit: z.literal(false),
  gateSigned: z.literal(false), executionAuthorized: z.literal(false), retryAuthorized: z.literal(false),
}).superRefine((v, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Inconsistent recorded scope review.' });
  if (v.source.latestRevision < v.source.revision) fail();
  if (v.status === 'expired') { if (v.batches !== null || v.review !== null) fail(); return; }
  if (!v.batches || !v.review) { fail(); return; }
  const ids = v.batches.map(b => b.batchId);
  if (new Set(ids).size !== ids.length) fail();
  const ready = v.batches.filter(b => b.state === 'succeeded'), pending = v.batches.filter(b => b.state !== 'succeeded');
  if (v.batches.some(b => (b.state === 'succeeded') !== (b.resultDigest !== null))
    || JSON.stringify(v.review.pendingBatchIds) !== JSON.stringify(pending.map(b => b.batchId))
    || JSON.stringify(v.review.results.map(r => r.batchId)) !== JSON.stringify(ready.map(b => b.batchId))) fail();
  const expected = v.source.latestRevision !== v.source.revision ? 'superseded'
    : v.batches.some(b => ['outcome-unknown', 'failed-known'].includes(b.state)) ? 'attention-required'
      : pending.length ? 'pending' : v.review.structuralAssessmentComplete ? 'review-available' : 'incomplete';
  if (v.status !== expected) fail();
});
export type IntentScopeReadInput = z.infer<typeof intentScopeReadInputSchema>;
export type IntentScopeReadOutput = z.infer<typeof intentScopeReadOutputSchema>;
export async function verifyIntentScopeReadOutput(raw: unknown): Promise<IntentScopeReadOutput> {
  const result = intentScopeReadOutputSchema.parse(raw);
  if (result.review) await verifyIntentScopeBatchResults(result.review);
  return result;
}
/** Trusted read-only service; current source/records/SDK checks cannot be replaced
 * by this portable structural contract or a caller-supplied result digest. */
export interface IntentScopeReader {
  readonly scope: Readonly<z.infer<typeof intentDraftScopeSchema> & { subject: string }>;
  read(input: IntentScopeReadInput, revalidate: () => Promise<void>): Promise<unknown>;
}
