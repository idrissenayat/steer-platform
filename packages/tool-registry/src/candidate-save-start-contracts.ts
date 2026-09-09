import { z } from 'zod';
import { candidateSaveStatusInputSchema } from './candidate-save-status-contracts.ts';
import { developmentScheduleReceiptSchema } from './intent-development-start-contracts.ts';

/** A new explicit save request, never inferred from preserving a package. */
export const candidateSaveStartInputSchema = candidateSaveStatusInputSchema.extend({ save: z.literal(true) });
export const candidateSaveScheduleReceiptSchema = developmentScheduleReceiptSchema;
export const candidateSaveStartOutputSchema = candidateSaveStartInputSchema.extend({
  kind: z.literal('steer-candidate-save-start/v1'), receipt: candidateSaveScheduleReceiptSchema,
  savedToGit: z.literal(false), executionAuthorized: z.literal(false), retryAuthorized: z.literal(false), gateSigned: z.literal(false),
}).superRefine((v, ctx) => {
  if (v.receipt.outcome === 'acknowledged' && v.receipt.workflowId !== `steer-candidate-save/v1/${encodeURIComponent(v.organizationId)}/${v.operationId}`)
    ctx.addIssue({ code: 'custom', message: 'Invalid candidate workflow binding.' });
});
export type CandidateSaveStartInput = z.infer<typeof candidateSaveStartInputSchema>;
export type CandidateSaveStartOutput = z.infer<typeof candidateSaveStartOutputSchema>;
export interface CandidateSaveScheduler {
  start(input: Readonly<{ organizationId: string; operationId: string; inputDigest: string; expiresAt: string }>,
    revalidate: () => Promise<void>): Promise<unknown>;
}
export interface CandidateSaveStarter {
  readonly scope: Readonly<{ organizationId: string; subject: string; productId: string; repository: string; branch: string }>;
  start(input: CandidateSaveStartInput, revalidate: () => Promise<void>): Promise<unknown>;
}
export function verifyCandidateSaveStart(raw: unknown, result: unknown): CandidateSaveStartOutput {
  const input = candidateSaveStartInputSchema.parse(raw), output = candidateSaveStartOutputSchema.parse(result);
  if ((Object.keys(input) as Array<keyof typeof input>).some(k => input[k] !== output[k])) throw new Error('Candidate save start does not match its reference.');
  return output;
}
