import { z } from 'zod';
import { briefCatalogInputSchema, artifactProjectionInputSchema, briefProjectionInputSchema } from './brief-contracts.ts';

export const intentOverlapInputSchema = briefCatalogInputSchema.extend({
  intent: z.string().min(1).max(10000).refine(value => value.trim().length > 0),
});
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const intentOverlapOutputSchema = briefCatalogInputSchema.extend({
  kind: z.literal('intent-overlap-candidates'),
  sourceDigest: digest, catalogFingerprint: digest, reviewFingerprint: digest,
  method: z.literal('lexical-candidates/v1'),
  coverage: z.strictObject({ scope: z.literal('configured-projections-only'),
    catalogCount: z.number().int().min(0).max(1000), inspectedIntents: z.number().int().min(0).max(50),
    inspectedDocuments: z.number().int().min(0).max(100), candidateCount: z.number().int().min(0).max(100),
    resultsTruncated: z.boolean(), scanLimited: z.boolean(),
    gaps: z.array(z.strictObject({ path: artifactProjectionInputSchema.shape.path,
      reason: z.enum(['not-configured', 'not-projected']) })).max(100),
  }),
  candidates: z.array(z.strictObject({
    briefPath: briefProjectionInputSchema.shape.path,
    path: artifactProjectionInputSchema.shape.path, revision: artifactProjectionInputSchema.shape.revision, contentDigest: digest,
    document: z.enum(['BRIEF', 'SPEC']), signal: z.enum(['matching-text', 'shared-terms']),
    queryTermCoverage: z.number().min(0).max(1), matchedTerms: z.array(z.string().min(1).max(10000)).max(12),
    excerpt: z.string().max(500),
  })).max(10),
  semanticReviewComplete: z.literal(false), authoritativeClearance: z.literal(false),
});
export type IntentOverlapInput = z.infer<typeof intentOverlapInputSchema>;
export type IntentOverlapOutput = z.infer<typeof intentOverlapOutputSchema>;
