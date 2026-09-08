import { z } from 'zod';
import { fingerprintIntentScope, intentDocumentDraftsSchema, intentScopeInputSchema } from './intent-revision-contracts.ts';

/** Verbatim editable content only. No assessment, authorship, signature or save
 * claim can be supplied in a snapshot; those need independently verified records.
 */
export const intentDraftContentSchema = z.strictObject({
  originalText: intentScopeInputSchema.shape.originalText,
  clarificationTurns: intentScopeInputSchema.shape.clarificationTurns,
  documents: intentDocumentDraftsSchema.nullable(),
});
export type IntentDraftContent = z.infer<typeof intentDraftContentSchema>;

/** Source revision counts actual source/clarification changes, not document edits. */
export async function describeIntentDraftRevision(scope: { organizationId: string; productId: string; repository: string; draftId: string },
  raw: unknown, previous: { content: IntentDraftContent; sourceRevision: number } | null) {
  const content = intentDraftContentSchema.parse(raw);
  const sourceChanged = !previous || content.originalText !== previous.content.originalText
    || JSON.stringify(content.clarificationTurns) !== JSON.stringify(previous.content.clarificationTurns);
  const sourceRevision = (previous?.sourceRevision ?? 0) + (sourceChanged ? 1 : 0);
  if (!Number.isSafeInteger(sourceRevision) || sourceRevision < 1) throw new Error('Draft revision unavailable.');
  const fingerprint = await fingerprintIntentScope({ organizationId: scope.organizationId, productId: scope.productId,
    repository: scope.repository, draftId: scope.draftId, sourceRevision, originalText: content.originalText,
    clarificationTurns: content.clarificationTurns, documents: content.documents ? { brief: content.documents.brief, spec: content.documents.spec } : null });
  return { content, sourceRevision, ...fingerprint };
}
