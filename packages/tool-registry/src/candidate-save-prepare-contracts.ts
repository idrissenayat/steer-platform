import { z } from 'zod';
import { candidateSavePreviewInputSchema, candidateSavePreviewOutputSchema, type CandidateSavePreviewer } from './candidate-save-preview-contracts.ts';
import { intentSaveBindingSchema } from './intent-revision-contracts.ts';
import { candidateSaveStatusInputSchema } from './candidate-save-status-contracts.ts';

/** An explicit human command, not an authority attestation. The server must
 * reconstruct the current preview and separately verify consent and records. */
export const candidateSavePrepareInputSchema = z.strictObject({
  organizationId: candidateSavePreviewInputSchema.shape.organizationId,
  preview: candidateSavePreviewInputSchema,
  previewDigest: candidateSavePreviewOutputSchema.shape.previewDigest,
  confirmation: intentSaveBindingSchema,
  confirm: z.literal(true),
}).superRefine((v, ctx) => {
  if (v.organizationId !== v.preview.organizationId || v.organizationId !== v.confirmation.organizationId
    || (['productId', 'repository', 'draftId', 'scopeInputDigest', 'sourceSnapshotDigest'] as const).some(k => v.preview[k] !== v.confirmation[k])
    || v.preview.revision !== v.confirmation.draftRevision || v.confirmation.item !== `items/${v.preview.itemId}`)
    ctx.addIssue({ code: 'custom', message: 'Invalid confirmation scope.' });
});
export const candidateSavePrepareOutputSchema = z.strictObject({
  kind: z.literal('steer-candidate-save-prepare/v1'), input: candidateSavePrepareInputSchema,
  outcome: z.enum(['prepared', 'conflict', 'unknown', 'unavailable']),
  reference: candidateSaveStatusInputSchema.nullable(),
  originalPreserved: z.boolean(), readyToRequestStart: z.boolean(),
  savedToGit: z.literal(false), executionAuthorized: z.literal(false), gateSigned: z.literal(false),
}).superRefine((v, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Invalid candidate preparation receipt.' });
  if (v.originalPreserved !== (v.outcome === 'prepared') || v.readyToRequestStart !== (v.outcome === 'prepared')) fail();
  if (v.outcome === 'prepared' && !v.reference) fail();
  if (v.reference) {
    if (!['prepared', 'unknown'].includes(v.outcome)) fail();
    for (const key of ['organizationId', 'productId', 'repository', 'branch', 'draftId', 'draftRevision'] as const)
      if (v.reference[key] !== v.input.confirmation[key]) fail();
  }
});
export type CandidateSavePrepareInput = z.infer<typeof candidateSavePrepareInputSchema>;
export type CandidateSavePrepareOutput = z.infer<typeof candidateSavePrepareOutputSchema>;
export interface CandidateSavePreparer {
  readonly scope: CandidateSavePreviewer['scope'];
  prepare(input: CandidateSavePrepareInput, current: () => Promise<void>): Promise<unknown>;
}
export function verifyCandidateSavePrepare(input: unknown, result: unknown): CandidateSavePrepareOutput {
  const output = candidateSavePrepareOutputSchema.parse(result);
  if (JSON.stringify(candidateSavePrepareInputSchema.parse(input)) !== JSON.stringify(output.input))
    throw new Error('Candidate preparation does not match its confirmation.');
  return output;
}
