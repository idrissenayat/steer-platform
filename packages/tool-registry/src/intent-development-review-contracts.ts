import { z } from 'zod';
import { intentDevelopmentPrepareInputSchema } from './intent-development-prepare-contracts.ts';
import { intentEvidenceInputSchema } from './intent-evidence-contracts.ts';
import { intentScopeBatchPlanSchema, planIntentScopeBatches } from './intent-scope-batches.ts';

export const intentDevelopmentReviewInputSchema = intentDevelopmentPrepareInputSchema.omit({
  configurationRevision: true, sourceSnapshotDigest: true, choice: true,
});
export const intentDevelopmentReviewOutputSchema = intentDevelopmentReviewInputSchema.extend({
  kind: z.literal('steer-development-review/v1'), configurationRevision: z.string().min(1).max(200),
  sourceSnapshotDigest: intentDevelopmentPrepareInputSchema.shape.sourceSnapshotDigest,
  scopeBatchPlan: intentScopeBatchPlanSchema,
  evidence: intentEvidenceInputSchema.refine(v => new TextEncoder().encode(JSON.stringify(v)).length <= 350000,
    'Source review exceeds the bounded response limit.'),
  semanticReviewComplete: z.literal(false), authoritativeClearance: z.literal(false),
  executionAuthorized: z.literal(false), savedToGit: z.literal(false), gateSigned: z.literal(false),
});
export type IntentDevelopmentReviewInput = z.infer<typeof intentDevelopmentReviewInputSchema>;
export type IntentDevelopmentReviewOutput = z.infer<typeof intentDevelopmentReviewOutputSchema>;
/** Verify exact response bindings and source bytes. This cannot verify provider
 * provenance or turn declared inventory completeness into semantic clearance. */
export async function verifyDevelopmentReview(rawInput: unknown, rawOutput: unknown) {
  const input = intentDevelopmentReviewInputSchema.parse(rawInput), output = intentDevelopmentReviewOutputSchema.parse(rawOutput);
  if ((Object.keys(input) as Array<keyof typeof input>).some(k => output[k] !== input[k])
    || (['organizationId', 'productId', 'repository', 'scopeInputDigest'] as const).some(k => output.evidence[k] !== input[k])) throw new Error('Source review changed.');
  const plan = await planIntentScopeBatches(output.evidence), envelope = plan.envelope;
  if (envelope.sourceSnapshotDigest !== output.sourceSnapshotDigest || JSON.stringify(output.scopeBatchPlan) !== JSON.stringify(plan.summary)) throw new Error('Source review changed.');
  return { output, envelope };
}
export interface IntentDevelopmentReviewReader {
  readonly scope: Readonly<{ organizationId: string; subject: string; productId: string; repository: string; configurationRevision: string }>;
  review(input: IntentDevelopmentReviewInput, revalidate: () => Promise<void>): Promise<unknown>;
}
