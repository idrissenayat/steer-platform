import { z } from 'zod';
import { draftBrief } from '@steer/domain/brief-author';

// Stateless authoring only. No caller-supplied author, grants, approval or target.
const line = z.string().max(1000).regex(/^[^\u0000-\u001f\u007f]*$/u);
const paragraph = z.string().max(4000).regex(/^[^\u0000-\u0008\u000b-\u001f\u007f]*$/u);
const entries = z.array(line).max(20);
export const briefPreviewInputSchema = z.strictObject({
  organizationId: z.string().min(1).max(200),
  draft: z.strictObject({ title: line, problem: paragraph, outcome: paragraph,
    users: entries, systems: entries, constraints: entries, openQuestions: entries, successMeasure: line }),
}).refine((input) => new TextEncoder().encode(JSON.stringify(input)).byteLength <= 12000);
export const briefPreviewOutputSchema = z.strictObject({
  kind: z.literal('brief-preview'), organizationId: z.string(), subject: z.string(),
  templateVersion: z.literal('steer-brief/v1'), markdown: z.string().max(32768),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/), missing: z.array(z.string()),
  saved: z.literal(false), confirmed: z.literal(false), executionAuthorized: z.literal(false),
});
export type BriefPreview = z.infer<typeof briefPreviewOutputSchema>;

/** Stateless formatting; no authentication, storage, model call or approval. */
export async function renderBriefPreview(raw: unknown, subject: string, author: string): Promise<BriefPreview> {
  const input = briefPreviewInputSchema.parse(raw);
  const draft = draftBrief({ ...input.draft, author });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(draft.markdown));
  return briefPreviewOutputSchema.parse({ kind: 'brief-preview', organizationId: input.organizationId, subject,
    templateVersion: draft.templateVersion, markdown: draft.markdown,
    contentDigest: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join(''),
    missing: [...draft.validation.missing, ...(!input.draft.title.trim() ? ['title'] : []), ...(!input.draft.successMeasure.trim() ? ['success measure'] : [])],
    saved: false, confirmed: false, executionAuthorized: false });
}
