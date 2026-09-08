import { z } from 'zod';
import { candidateBundleReferenceSchema, candidateBundleManifestSchema } from './candidate-bundle-contracts.ts';
import { intentDocumentDraftsSchema } from './intent-revision-contracts.ts';

export const candidateBundleReadInputSchema = candidateBundleReferenceSchema;
export const candidateBundleReadScopeSchema = candidateBundleReferenceSchema.pick({
  organizationId: true, productId: true, repository: true, branch: true,
}).extend({
  subject: z.string().min(1).max(200),
  itemIds: z.array(candidateBundleReferenceSchema.shape.itemId).min(1).max(100)
    .refine(values => new Set(values).size === values.length),
});
const source = z.strictObject({ path: z.string().min(1).max(500),
  contentDigest: candidateBundleReferenceSchema.shape.manifestDigest,
  blobSha: candidateBundleReferenceSchema.shape.revision });
export const candidateBundleReadOutputSchema = z.strictObject({
  kind: z.literal('steer-candidate-bundle-content/v1'), reference: candidateBundleReferenceSchema,
  manifest: candidateBundleManifestSchema,
  manifestContent: z.string().min(1).max(32000).refine(value => !/[\uD800-\uDFFF]/u.test(value)),
  documents: intentDocumentDraftsSchema,
  verification: z.literal('exact-commit-bytes'),
  sources: z.strictObject({ manifest: source, documents: z.strictObject({ brief: source, spec: source, exam: source }) }),
  executionAuthorized: z.literal(false),
});
export type CandidateBundleReadInput = z.infer<typeof candidateBundleReadInputSchema>;
export type CandidateBundleReadOutput = z.infer<typeof candidateBundleReadOutputSchema>;
export interface CandidateBundleReadService {
  readonly scope: Readonly<Omit<z.infer<typeof candidateBundleReadScopeSchema>, 'itemIds'> & { itemIds: readonly string[] }>;
  read(input: CandidateBundleReadInput, current: () => Promise<void>): Promise<unknown>;
}
const bytes = (value: string) => new TextEncoder().encode(value);
const hash = async (algorithm: string, value: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest(algorithm, value)), byte => byte.toString(16).padStart(2, '0')).join('');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}

/** Portable byte binding, NOT Git provenance, currentness, scope acceptance or a gate.
 * The server must use the trusted regular-blob reader and current read authority.
 * Exact manifest bytes are carried because equivalent JSON is not an exact reopen.
 */
export async function verifyCandidateBundleRead(rawInput: unknown, rawOutput: unknown): Promise<CandidateBundleReadOutput> {
  const input = candidateBundleReadInputSchema.parse(rawInput), output = candidateBundleReadOutputSchema.parse(rawOutput);
  const fail = () => { throw new Error('Candidate bundle bytes could not be verified.'); };
  if ((Object.keys(input) as Array<keyof typeof input>).some(key => input[key] !== output.reference[key])) fail();
  const manifest = candidateBundleManifestSchema.parse(JSON.parse(output.manifestContent));
  if (JSON.stringify(manifest) !== JSON.stringify(output.manifest)
    || (['organizationId', 'productId', 'repository', 'itemId', 'bundleId'] as const).some(key => manifest[key] !== input[key])) fail();
  const root = `items/${input.itemId}`;
  async function verify(content: string, ref: z.infer<typeof source>, path: string, digest: string, limit: number) {
    const data = bytes(content), header = bytes(`blob ${data.length}\0`), blob = new Uint8Array(header.length + data.length);
    blob.set(header); blob.set(data, header.length);
    if (!content.trim() || data.length > limit || ref.path !== path || ref.contentDigest !== digest
      || await hash('SHA-256', data) !== digest || await hash('SHA-1', blob) !== ref.blobSha) fail();
  }
  await verify(output.manifestContent, output.sources.manifest, `${root}/candidates/${input.bundleId}/MANIFEST.json`, input.manifestDigest, 32000);
  for (const name of ['brief', 'spec', 'exam'] as const) {
    await verify(output.documents[name], output.sources.documents[name], `${root}/${manifest.documents[name].path}`, manifest.documents[name].contentDigest, 131072);
  }
  return freeze(output);
}
