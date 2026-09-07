import { z } from 'zod';
import { briefSaveScopeSchema, briefSaveInputSchema } from './brief-save-contracts.ts';

// Configured candidates, not writable-path grants or a lease on a moving branch.
export const briefDestinationInputSchema = briefSaveScopeSchema.pick({ organizationId: true });
export const briefDestinationScopeSchema = briefSaveScopeSchema.omit({ path: true }).extend({
  paths: z.array(briefSaveScopeSchema.shape.path).min(1).max(100)
    .refine((paths) => new Set(paths).size === paths.length),
});
export const briefDestinationOutputSchema = briefDestinationScopeSchema.extend({
  kind: z.literal('brief-destination-observation'),
  observedHead: briefSaveInputSchema.shape.expectedHead,
  observedAt: z.iso.datetime({ precision: 3 }),
  writeAuthorized: z.literal(false), gateVerified: z.literal(false),
});
export type BriefDestination = z.infer<typeof briefDestinationOutputSchema>;
export interface BriefDestinationReader {
  readonly scope: Readonly<Omit<z.infer<typeof briefDestinationScopeSchema>, 'paths'> & { paths: readonly string[] }>;
  readHead(): Promise<unknown>;
}
