import { z } from 'zod';
import { intentDraftScopeSchema } from './intent-draft-contracts.ts';
import { intentDispositionChoiceSchema } from './intent-overlap-contracts.ts';

const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const revision = z.number().int().min(1).max(1000);
export const intentDevelopmentPrepareInputSchema = intentDraftScopeSchema.extend({
  draftId: uuid, revision, revisionDigest: digest, scopeInputDigest: digest, sourceSnapshotDigest: digest,
  configurationRevision: z.string().min(1).max(200), choice: intentDispositionChoiceSchema,
});
const coverage = z.strictObject({ inventoryComplete: z.boolean(), inventoryCount: z.number().int().min(0).max(1000),
  includedCount: z.number().int().min(0).max(32), accessGapCount: z.number().int().min(0).max(1000000),
  gapCount: z.number().int().min(0).max(1000), complete: z.boolean() }).superRefine((c, ctx) => {
  if (c.includedCount + c.gapCount !== c.inventoryCount || c.complete !== (c.inventoryComplete && c.accessGapCount === 0 && c.gapCount === 0))
    ctx.addIssue({ code: 'custom', message: 'Invalid coverage summary.' });
});
export const intentDevelopmentPrepareOutputSchema = intentDevelopmentPrepareInputSchema.extend({
  kind: z.literal('steer-development-prepare/v1'), outcome: z.enum(['prepared', 'scope-incomplete', 'conflict', 'unknown', 'unavailable']),
  reference: z.strictObject({ operationId: uuid, inputDigest: digest }).nullable(), coverage: coverage.nullable(),
  originalPreserved: z.boolean(), readyToRequestStart: z.boolean(),
  semanticReviewComplete: z.literal(false), authoritativeClearance: z.literal(false), executionAuthorized: z.literal(false),
  documentsReady: z.literal(false), savedToGit: z.literal(false), gateSigned: z.literal(false),
}).superRefine((v, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Invalid preparation receipt.' });
  if (v.originalPreserved !== (v.outcome === 'prepared') || v.readyToRequestStart !== (v.outcome === 'prepared')) fail();
  if (v.outcome === 'prepared' && (!v.reference || !v.coverage?.complete)) fail();
  if (v.outcome === 'scope-incomplete' && (!v.coverage || v.coverage.complete || v.reference)) fail();
  if (v.reference && !['prepared', 'unknown'].includes(v.outcome)) fail();
});
export type IntentDevelopmentPrepareInput = z.infer<typeof intentDevelopmentPrepareInputSchema>;
export type IntentDevelopmentPrepareOutput = z.infer<typeof intentDevelopmentPrepareOutputSchema>;
export interface IntentDevelopmentPreparer {
  readonly scope: Readonly<{ organizationId: string; subject: string; productId: string; repository: string; configurationRevision: string }>;
  prepare(input: IntentDevelopmentPrepareInput, revalidate: () => Promise<void>): Promise<unknown>;
}
