import { z } from 'zod';
import { intentDraftContentSchema } from './intent-draft-content.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/), revision = z.number().int().min(1).max(1000);
export const intentDraftScopeSchema = z.strictObject({ organizationId: id, productId: id, repository: id });
export const intentDraftCreateInputSchema = intentDraftScopeSchema.extend({ requestId: uuid });
export const intentDraftAppendInputSchema = intentDraftScopeSchema.extend({ draftId: uuid, mutationId: uuid,
  expectedRevision: z.number().int().min(0).max(1000), expectedDigest: digest.nullable(), content: intentDraftContentSchema,
}).superRefine((v, ctx) => { if ((v.expectedRevision === 0) !== (v.expectedDigest === null)) ctx.addIssue({ code: 'custom', message: 'Invalid draft parent.' }); });
export const intentDraftReadInputSchema = intentDraftScopeSchema.extend({ draftId: uuid, revision: z.union([revision, z.literal('latest')]) });
const notStored = z.strictObject({ outcome: z.enum(['unknown', 'unavailable', 'conflict']), savedToGit: z.literal(false) });
export const intentDraftCreateOutputSchema = z.union([
  z.strictObject({ outcome: z.literal('created'), requestId: uuid, draftId: uuid, createdAt: z.iso.datetime({ precision: 3 }),
    useUntil: z.iso.datetime({ precision: 3 }), retentionDeadline: z.iso.datetime({ precision: 3 }), contentPreserved: z.literal(false), savedToGit: z.literal(false) }), notStored,
]);
const reference = { draftId: uuid, revision, revisionDigest: digest, sourceRevision: revision, scopeInputDigest: digest,
  latestRevision: revision, savedToGit: z.literal(false) };
export const intentDraftAppendOutputSchema = z.union([
  z.strictObject({ outcome: z.literal('acknowledged'), mutationId: uuid, ...reference }).refine(v => v.latestRevision >= v.revision && v.sourceRevision <= v.revision), notStored,
]);
export const intentDraftReadOutputSchema = z.strictObject({ ...reference, content: intentDraftContentSchema })
  .refine(v => v.latestRevision >= v.revision && v.sourceRevision <= v.revision);
export type IntentDraftCreateInput = z.infer<typeof intentDraftCreateInputSchema>;
export type IntentDraftAppendInput = z.infer<typeof intentDraftAppendInputSchema>;
export type IntentDraftReadInput = z.infer<typeof intentDraftReadInputSchema>;
export type IntentDraftCreateOutput = z.infer<typeof intentDraftCreateOutputSchema>;
export type IntentDraftAppendOutput = z.infer<typeof intentDraftAppendOutputSchema>;
export type IntentDraftReadOutput = z.infer<typeof intentDraftReadOutputSchema>;

/** Trusted owner-bound service only. Current records policy/key checks belong to
 * its implementation; tool grants alone never adopt draft persistence policy. */
export interface IntentDraftService {
  readonly scope: Readonly<z.infer<typeof intentDraftScopeSchema> & { subject: string }>;
  create(input: IntentDraftCreateInput, revalidate: () => Promise<void>): Promise<unknown>;
  append(input: IntentDraftAppendInput, revalidate: () => Promise<void>): Promise<unknown>;
  read(input: IntentDraftReadInput, revalidate: () => Promise<void>): Promise<unknown>;
}
