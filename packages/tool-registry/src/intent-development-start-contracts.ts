import { z } from 'zod';
import { intentDevelopmentReadInputSchema } from './intent-development-read-contracts.ts';

const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
export const intentDevelopmentStartInputSchema = intentDevelopmentReadInputSchema.extend({
  draftId: uuid, revision: z.number().int().min(1).max(1000), revisionDigest: digest,
});
export const developmentScheduleReceiptSchema = z.discriminatedUnion('outcome', [
  z.strictObject({ outcome: z.literal('acknowledged'), workflowId: z.string().min(1).max(1000), runId: uuid,
    state: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TERMINATED', 'TIMED_OUT']) }),
  z.strictObject({ outcome: z.enum(['unknown', 'unavailable']) }),
]);
export const intentDevelopmentStartOutputSchema = intentDevelopmentStartInputSchema.extend({
  kind: z.literal('steer-development-start/v1'), receipt: developmentScheduleReceiptSchema,
  savedToGit: z.literal(false), gateSigned: z.literal(false), documentsReady: z.literal(false), retryAuthorized: z.literal(false),
}).superRefine((v, ctx) => {
  if (v.receipt.outcome === 'acknowledged' && v.receipt.workflowId !== `steer-development/v1/${encodeURIComponent(v.organizationId)}/${v.operationId}`)
    ctx.addIssue({ code: 'custom', message: 'Invalid development workflow binding.' });
});
export type IntentDevelopmentStartInput = z.infer<typeof intentDevelopmentStartInputSchema>;
export type IntentDevelopmentStartOutput = z.infer<typeof intentDevelopmentStartOutputSchema>;
export interface DevelopmentScheduler {
  /** Fixed reference only; current records, source and execution authority is
   * rechecked immediately before start. Receipt is not document or gate status. */
  start(input: Readonly<{ organizationId: string; operationId: string; inputDigest: string; expiresAt: string }>,
    revalidate: () => Promise<void>): Promise<unknown>;
}
export interface IntentDevelopmentStarter {
  readonly scope: Readonly<{ organizationId: string; subject: string; productId: string; repository: string }>;
  start(input: IntentDevelopmentStartInput, revalidate: () => Promise<void>): Promise<unknown>;
}
