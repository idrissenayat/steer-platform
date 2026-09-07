import { z } from 'zod';
import { artifactProjectionInputSchema, artifactProjectionOutputSchema, briefProjectionInputSchema } from './brief-contracts.ts';

const revision = artifactProjectionInputSchema.shape.revision;
export const decisionReferenceSchema = artifactProjectionInputSchema.pick({ path: true, revision: true }).extend({
  contentDigest: briefProjectionInputSchema.shape.contentDigest,
});
export const decisionReferencesSchema = z.array(decisionReferenceSchema).max(3);
// Display parser only. Unknown extension fields stay in the original source JSON,
// not the normalized claims. This never authenticates a signer or policy ruling.
export const decisionClaimsSchema = z.object({
  version: z.literal('steer-gate-signature/v1'), organization: z.string().min(1).max(200),
  productHome: z.string().min(1).max(500), item: z.string().min(1).max(200),
  gate: z.union([z.literal(1), z.literal(2), z.literal(3)]), decision: z.string().min(1).max(64), artifactRevision: revision,
  artifacts: z.array(z.object({ path: artifactProjectionInputSchema.shape.path, revision })).min(1).max(10),
  signatures: z.array(z.object({ subject: z.string().min(1).max(200), hat: z.string().min(1).max(100),
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), signedAt: z.iso.datetime() })).min(1).max(100),
});
export const briefDecisionsOutputSchema = z.strictObject({ kind: z.literal('brief-decisions'),
  brief: briefProjectionInputSchema, gateVerified: z.literal(false), writeAuthorized: z.literal(false),
  records: z.array(artifactProjectionOutputSchema.extend({ content: z.string().max(32768).refine(value => new TextEncoder().encode(value).byteLength <= 32768),
    claims: decisionClaimsSchema, briefLinked: z.boolean() })).max(3),
});
export type BriefDecisions = z.infer<typeof briefDecisionsOutputSchema>;
export const decisionEvidenceInputSchema = briefProjectionInputSchema.extend({ decision: decisionReferenceSchema,
  evidence: artifactProjectionInputSchema.pick({ path: true, revision: true }) });
export const decisionEvidenceOutputSchema = z.strictObject({ kind: z.literal('decision-evidence'), brief: briefProjectionInputSchema,
  decision: decisionReferenceSchema, artifact: artifactProjectionOutputSchema, gateVerified: z.literal(false), writeAuthorized: z.literal(false) });
export type DecisionEvidence = z.infer<typeof decisionEvidenceOutputSchema>;
export function decisionPaths(briefPath: string): string[] {
  const path = briefProjectionInputSchema.shape.path.parse(briefPath);
  const parent = path.slice(0, -'BRIEF.md'.length);
  return [1, 2, 3].map(gate => `${parent}signatures/gate-${gate}.json`);
}
export async function verifyProjectionBytes(artifact: z.infer<typeof artifactProjectionOutputSchema>) {
  const bytes = new TextEncoder().encode(artifact.content);
  const prefix = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const gitBytes = new Uint8Array(prefix.length + bytes.length); gitBytes.set(prefix); gitBytes.set(bytes, prefix.length);
  const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, '0')).join('');
  const [digest, blob] = await Promise.all([crypto.subtle.digest('SHA-256', bytes), crypto.subtle.digest('SHA-1', gitBytes)]);
  if (hex(digest) !== artifact.contentDigest || hex(blob) !== artifact.blobSha) throw new Error('Invalid projected source.');
}
