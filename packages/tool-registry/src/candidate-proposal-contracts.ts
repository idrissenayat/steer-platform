import { z } from 'zod';
import { candidatePointerReferenceSchema, candidateBundleReferenceSchema, candidateBundlePointerSchema } from './candidate-bundle-contracts.ts';
import { candidateBundleReadScopeSchema } from './candidate-bundle-read-contracts.ts';

const proposalId = candidatePointerReferenceSchema.shape.proposalId.unwrap();
export const candidateProposalInputSchema = candidatePointerReferenceSchema.omit({ proposalId: true }).extend({ cursor: proposalId.nullable() });
export const candidateProposalScopeSchema = candidateBundleReadScopeSchema;
export const candidateProposalEntrySchema = z.strictObject({ proposalId,
  reference: candidateBundleReferenceSchema,
  pointerDigest: candidateBundleReferenceSchema.shape.manifestDigest,
  target: candidateBundlePointerSchema.shape.proposalTarget.unwrap(),
});
export const candidateProposalOutputSchema = candidateProposalInputSchema.extend({
  kind: z.literal('steer-candidate-proposals/v1'), treeSha: candidateBundleReferenceSchema.shape.revision,
  entries: z.array(candidateProposalEntrySchema).max(10), nextCursor: proposalId.nullable(),
  inventoryCount: z.number().int().min(0).max(1000), inventoryComplete: z.literal(true),
  lifecycleVerified: z.literal(false), executionAuthorized: z.literal(false), savedToGit: z.literal(false), gateSigned: z.literal(false),
}).superRefine((value, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Invalid proposal page.' });
  let previous = value.cursor;
  for (const entry of value.entries) {
    if ((previous && entry.proposalId <= previous) || entry.target.itemId !== value.itemId
      || (['organizationId', 'productId', 'repository', 'branch', 'itemId', 'revision'] as const).some(k => entry.reference[k] !== value[k])) fail();
    previous = entry.proposalId;
  }
  if (value.inventoryCount < value.entries.length || (value.nextCursor && (value.entries.length !== 10 || value.nextCursor !== previous))
    || (!value.cursor && !value.nextCursor && value.entries.length !== value.inventoryCount)) fail();
});
export type CandidateProposalInput = z.infer<typeof candidateProposalInputSchema>;
export type CandidateProposalOutput = z.infer<typeof candidateProposalOutputSchema>;
export interface CandidateProposalReader {
  readonly scope: Readonly<Omit<z.infer<typeof candidateProposalScopeSchema>, 'itemIds'> & { itemIds: readonly string[] }>;
  list(input: CandidateProposalInput, current: () => Promise<void>): Promise<unknown>;
}
export function verifyCandidateProposals(raw: unknown, result: unknown): CandidateProposalOutput {
  const input = candidateProposalInputSchema.parse(raw), output = candidateProposalOutputSchema.parse(result);
  if ((Object.keys(input) as Array<keyof typeof input>).some(k => input[k] !== output[k])) throw new Error('Proposal references changed.');
  return output;
}
