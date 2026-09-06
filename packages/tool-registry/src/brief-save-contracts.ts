import { z } from 'zod';
import { briefPreviewInputSchema } from './brief-preview.ts';
import { canonicalBriefPathSchema } from './brief-paths.ts';
const identifier = z.string().min(1).max(200).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
const sha = z.string().length(40).regex(/^[a-f0-9]{40}$/), digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
export const briefSaveScopeSchema = z.strictObject({ organizationId: identifier,
  repository: z.string().regex(/^[a-z][a-z0-9-]{0,31}:[A-Za-z0-9_-]{1,160}(?![\s\S])/),
  branch: z.string().min(1).max(200).refine((value) => !/[\s~^:?*\[\\]/u.test(value) && !value.includes('..') &&
    !value.includes('@{') && value !== '@' && !value.startsWith('-') && !/[\u0000-\u001f\u007f]/u.test(value) &&
    value.split('/').every((part) => part.length > 0 && !part.startsWith('.') && !part.endsWith('.') && !part.endsWith('.lock'))),
  // Canonical architecture path. This first contract is create-only, not arbitrary artifact editing.
  path: canonicalBriefPathSchema,
});
export const briefSaveStatusInputSchema = briefSaveScopeSchema.extend({ idempotencyKey: z.string().length(36).regex(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/) });
export const briefSaveInputSchema = briefSaveStatusInputSchema.extend({ expectedHead: sha,
  draft: briefPreviewInputSchema.shape.draft,
  confirmation: z.strictObject({ action: z.literal('accept-rendered-brief'), templateVersion: z.literal('steer-brief/v1'), contentDigest: digest }),
}).refine((input) => new TextEncoder().encode(JSON.stringify(input)).byteLength <= 14000);
export const briefSaveReferenceSchema = briefSaveStatusInputSchema.extend({ subject: identifier });
export const briefSaveReceiptSchema = briefSaveReferenceSchema.extend({ requestDigest: digest, expectedHead: sha, revision: sha, blobSha: sha, contentDigest: digest });
export const briefSaveObservationSchema = z.discriminatedUnion('outcome', [
  briefSaveReferenceSchema.extend({ outcome: z.literal('not-found') }),
  briefSaveReferenceSchema.extend({ outcome: z.literal('unknown') }),
  briefSaveReferenceSchema.extend({ outcome: z.literal('conflict') }),
  briefSaveReferenceSchema.extend({ outcome: z.literal('pending'), requestDigest: digest }),
  briefSaveReceiptSchema.extend({ outcome: z.literal('committed') }),
]);
export const briefSaveOutputSchema = z.strictObject({ result: briefSaveObservationSchema, gateSigned: z.literal(false) });
export const briefWriteAuthoritySchema = briefSaveReferenceSchema.extend({
  kind: z.literal('verified-brief-write-authority'), requestDigest: digest, expectedHead: sha,
  authorizationRevision: sha, platformRevision: sha, gate2DecisionDigest: digest,
  // Narrow current-runtime observations only; no rounding of fractional signed records.
  evaluatedAt: z.iso.datetime({ precision: 3 }), validThrough: z.iso.datetime({ precision: 3 }),
});
export type BriefSaveInput = z.infer<typeof briefSaveInputSchema>;
export type BriefSaveReference = z.infer<typeof briefSaveReferenceSchema>;
export type BriefSaveObservation = z.infer<typeof briefSaveObservationSchema>;
export type BriefSaveOutput = z.infer<typeof briefSaveOutputSchema>;
export type BriefWriteAuthority = z.infer<typeof briefWriteAuthoritySchema>;
export interface BriefCreateRequest extends BriefSaveReference {
  requestDigest: string; expectedHead: string; content: string; contentDigest: string; contentBlobSha: string;
  expectedBlob: null; operationPath: string;
}
