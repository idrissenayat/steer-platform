import { z } from 'zod';
import { briefDocumentSchema } from './brief-document.ts';

// Portable wire contracts. No registry handlers or provider implementations enter this graph.
const identifier = z.string().min(1).max(200);
const path = z.string().min(1).max(500).refine((value) => value.split('/').every((part) => part && part !== '.' && part !== '..') && !/[\\\u0000-\u001f\u007f]/.test(value));
const repository = z.string().regex(/^[a-z][a-z0-9-]{0,31}:[A-Za-z0-9_-]{1,160}$/);
const revision = z.string().regex(/^[a-f0-9]{40}$/);
export const artifactProjectionInputSchema = z.strictObject({ organizationId: identifier, repository, path, revision });
export const artifactProjectionOutputSchema = z.strictObject({ kind: z.literal('projection'), organizationId: identifier, repository, path,
  revision, blobSha: revision, contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  content: z.string().max(512 * 1024).refine((value) => new TextEncoder().encode(value).byteLength <= 512 * 1024) });
export type ArtifactProjectionInput = z.infer<typeof artifactProjectionInputSchema>;
export type ArtifactProjection = z.infer<typeof artifactProjectionOutputSchema>;
export const briefProjectionInputSchema = artifactProjectionInputSchema.extend({
  path: path.refine((value) => /^(?:BRIEF\.md|intent\/[0-9]{4,}\/BRIEF\.md)$/.test(value)),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const briefProjectionOutputSchema = artifactProjectionOutputSchema.extend({ kind: z.literal('brief-projection'), document: briefDocumentSchema });
export type BriefProjection = z.infer<typeof briefProjectionOutputSchema>;
export const briefCatalogInputSchema = artifactProjectionInputSchema.pick({ organizationId: true, repository: true });
export const briefCatalogRecordsSchema = z.array(z.strictObject({ path: briefProjectionInputSchema.shape.path,
  revision, contentDigest: briefProjectionInputSchema.shape.contentDigest })).max(1000);
export const briefCatalogOutputSchema = briefCatalogInputSchema.extend({ kind: z.literal('brief-catalog'), records: briefCatalogRecordsSchema });
export type BriefCatalog = z.infer<typeof briefCatalogOutputSchema>;
