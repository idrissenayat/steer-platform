import { z } from 'zod';
import { candidateBundleReferenceSchema, candidateBundleInputSchema } from './candidate-bundle-contracts.ts';
import { intentSaveBindingSchema } from './intent-revision-contracts.ts';
import { candidateBundleReadScopeSchema } from './candidate-bundle-read-contracts.ts';

const digest = candidateBundleReferenceSchema.shape.manifestDigest, revision = candidateBundleReferenceSchema.shape.revision;
export const candidateSaveStatusInputSchema = candidateBundleReferenceSchema.pick({ organizationId: true, productId: true, repository: true, branch: true }).extend({
  draftId: intentSaveBindingSchema.shape.draftId, draftRevision: intentSaveBindingSchema.shape.draftRevision,
  operationId: candidateBundleInputSchema.shape.operationId, inputDigest: digest,
});
export const candidateSaveStatusScopeSchema = candidateBundleReadScopeSchema;
const flags = { retryAuthorized: z.literal(false), executionAuthorized: z.literal(false), gateSigned: z.literal(false) };
const base = { ...candidateSaveStatusInputSchema.shape, kind: z.literal('steer-candidate-save-status/v1'), ...flags };
export const candidateSaveStatusOutputSchema = z.discriminatedUnion('outcome', [
  z.strictObject({ ...base, outcome: z.literal('unknown'), saveVerified: z.literal(false) }),
  z.strictObject({ ...base, outcome: z.literal('conflict'), saveVerified: z.literal(false) }),
  z.strictObject({ ...base, outcome: z.literal('not-found'), saveVerified: z.literal(false), observedHead: revision }),
  z.strictObject({ ...base, outcome: z.literal('committed'), saveVerified: z.literal(true), reference: candidateBundleReferenceSchema,
    expectedHead: revision, pointerDigest: digest, confirmationDigest: digest }),
]);
const observation = { kind: z.literal('steer-candidate-bundle-observation/v1'), operationId: candidateBundleInputSchema.shape.operationId, inputDigest: digest, ...flags };
export const candidateSaveObservationSchema = z.discriminatedUnion('outcome', [
  z.strictObject({ ...observation, outcome: z.literal('unknown') }),
  z.strictObject({ ...observation, outcome: z.literal('conflict') }),
  z.strictObject({ ...observation, outcome: z.literal('not-found'), observedHead: revision }),
  z.strictObject({ ...observation, outcome: z.literal('committed'), revision, expectedHead: revision, manifestDigest: digest, pointerDigest: digest }),
]);
export type CandidateSaveStatusInput = z.infer<typeof candidateSaveStatusInputSchema>;
export type CandidateSaveStatusOutput = z.infer<typeof candidateSaveStatusOutputSchema>;
export interface CandidateSaveStatusReader {
  readonly scope: Readonly<Omit<z.infer<typeof candidateSaveStatusScopeSchema>, 'itemIds'> & { itemIds: readonly string[] }>;
  read(input: CandidateSaveStatusInput, current: () => Promise<void>): Promise<unknown>;
}
/** Structural/reference verification only; trusted server receipt inspection is mandatory. */
export function verifyCandidateSaveStatus(rawInput: unknown, rawOutput: unknown): CandidateSaveStatusOutput {
  const input = candidateSaveStatusInputSchema.parse(rawInput), output = candidateSaveStatusOutputSchema.parse(rawOutput);
  if ((Object.keys(input) as Array<keyof typeof input>).some(key => input[key] !== output[key])
    || (output.outcome === 'committed' && (['organizationId', 'productId', 'repository', 'branch'] as const).some(key => input[key] !== output.reference[key])))
    throw new Error('Candidate status does not match its original reference.');
  if (output.outcome === 'committed') Object.freeze(output.reference);
  return Object.freeze(output);
}
