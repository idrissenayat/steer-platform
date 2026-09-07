import { z } from 'zod';
import { artifactProjectionOutputSchema, briefProjectionInputSchema } from './brief-contracts.ts';

// Coverage at one immutable source coordinate, not business lifecycle authority.
const fingerprint = artifactProjectionOutputSchema.pick({ blobSha: true, contentDigest: true });
const entry = z.strictObject({
  kind: z.enum(['spec', 'exam', 'plan']),
  path: artifactProjectionOutputSchema.shape.path,
  status: z.enum(['projected', 'not-projected', 'not-configured']),
  fingerprint: fingerprint.nullable(),
}).refine(value => (value.status === 'projected') === (value.fingerprint !== null));

export function lifecycleArtifactPaths(briefPath: string) {
  const path = briefProjectionInputSchema.shape.path.parse(briefPath);
  const parent = path.slice(0, -'BRIEF.md'.length);
  return (['spec', 'exam', 'plan'] as const).map(kind => ({ kind, path: `${parent}${kind.toUpperCase()}.md` }));
}

export const briefArtifactsOutputSchema = z.strictObject({
  kind: z.literal('brief-artifact-coverage'), brief: briefProjectionInputSchema,
  artifacts: z.array(entry).length(3), stage: z.null(),
  gateVerified: z.literal(false), writeAuthorized: z.literal(false),
}).refine(value => briefProjectionInputSchema.safeParse(value.brief).success &&
  lifecycleArtifactPaths(value.brief.path).every((expected, index) =>
    value.artifacts[index]?.kind === expected.kind && value.artifacts[index]?.path === expected.path));
export type BriefArtifacts = z.infer<typeof briefArtifactsOutputSchema>;
