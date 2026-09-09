import { z } from 'zod';
import { intentDevelopmentPrepareInputSchema } from './intent-development-prepare-contracts.ts';
import { intentDocumentDraftsSchema } from './intent-revision-contracts.ts';
import { intentScopeSelectionSchema, intentScopeSelectionFor, verifyBoundIntentScope } from './intent-scope-selection.ts';
import { buildIntentDevelopmentContext } from './intent-development-context.ts';

const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const id = z.string().min(1).max(200);
const document = z.strictObject({ contentDigest: digest, bytes: z.number().int().min(1).max(120000) });
export const candidateSaveReviewInputSchema = intentDevelopmentPrepareInputSchema.omit({ draftingContextDigest: true }).extend({ scopeReview: intentScopeSelectionSchema });
export const candidateSaveReviewOutputSchema = candidateSaveReviewInputSchema.extend({
  kind: z.literal('steer-candidate-save-review/v1'), subject: id, branch: id,
  expectedHead: z.string().regex(/^[a-f0-9]{40}(?![\s\S])/),
  documents: z.strictObject({ brief: document, spec: document, exam: document }),
  assessmentDigest: digest, dispositionDigest: digest, reviewDigest: digest,
  saveConfirmed: z.literal(false), operationCreated: z.literal(false), savedToGit: z.literal(false),
  executionAuthorized: z.literal(false), gateSigned: z.literal(false),
});
export type CandidateSaveReviewInput = z.infer<typeof candidateSaveReviewInputSchema>;
export type CandidateSaveReviewOutput = z.infer<typeof candidateSaveReviewOutputSchema>;
export interface CandidateSaveReviewer {
  readonly scope: Readonly<{ organizationId: string; productId: string; repository: string; subject: string; branch: string; configurationRevision: string }>;
  review(input: CandidateSaveReviewInput, current: () => Promise<void>): Promise<unknown>;
}
async function hash(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
}
const fail = () => new Error('Final save review is unavailable or changed.');
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
export async function describeCandidateSaveDocuments(raw: unknown) {
  const docs = intentDocumentDraftsSchema.parse(raw);
  if (Object.values(docs).some(v => !v.trim())) throw fail();
  const describe = async (v: string) => ({ contentDigest: await hash(v), bytes: new TextEncoder().encode(v).length });
  return { brief: await describe(docs.brief), spec: await describe(docs.spec), exam: await describe(docs.exam) };
}
/** Pure exact binding, not provenance, durable consent, lineage or save authority.
 * The server must independently restore current records and recorded assessment. */
export async function describeCandidateSaveReview(raw: unknown, subject: string, branch: string, documents: unknown, evidence: unknown, scopeBinding: unknown) {
  const input = candidateSaveReviewInputSchema.parse(raw), context = await buildIntentDevelopmentContext(evidence);
  const binding = await verifyBoundIntentScope(scopeBinding, evidence);
  if (!context.coverage.complete || context.scopeInputDigest !== input.scopeInputDigest || context.sourceSnapshotDigest !== input.sourceSnapshotDigest
    || (['organizationId', 'productId', 'repository'] as const).some(k => context.snapshot[k] !== input[k]) || context.snapshot.branch !== branch
    || JSON.stringify(intentScopeSelectionSchema.parse(intentScopeSelectionFor(binding))) !== JSON.stringify(input.scopeReview)) throw fail();
  const choice = input.choice;
  if ('target' in choice && (choice.target.revision !== context.snapshot.head || !context.evidence.some(s => s.path === choice.target.path
    && s.path.endsWith('/BRIEF.md') && s.contentDigest === choice.target.contentDigest))) throw fail();
  const assessmentDigest = await hash(JSON.stringify(['steer-final-save-assessment/v1', binding]));
  const dispositionDigest = await hash(JSON.stringify(['steer-final-save-direction/v1', input.scopeInputDigest, input.sourceSnapshotDigest, assessmentDigest, choice]));
  const body = { ...input, kind: 'steer-candidate-save-review/v1', subject, branch, expectedHead: context.snapshot.head,
    documents: await describeCandidateSaveDocuments(documents), assessmentDigest, dispositionDigest,
    saveConfirmed: false, operationCreated: false, savedToGit: false, executionAuthorized: false, gateSigned: false };
  return freeze(candidateSaveReviewOutputSchema.parse({ ...body, reviewDigest: await hash(JSON.stringify(['steer-final-save-review/v1', body])) }));
}
/** Structural response validation. Hashes alone never prove provider authority. */
export async function verifyCandidateSaveReview(rawInput: unknown, rawOutput: unknown, documents?: unknown) {
  const input = candidateSaveReviewInputSchema.parse(rawInput), output = candidateSaveReviewOutputSchema.parse(rawOutput);
  if ((Object.keys(input) as Array<keyof CandidateSaveReviewInput>).some(k => JSON.stringify(input[k]) !== JSON.stringify(output[k]))) throw fail();
  const { reviewDigest, ...body } = output;
  if (reviewDigest !== await hash(JSON.stringify(['steer-final-save-review/v1', body]))
    || (documents !== undefined && JSON.stringify(output.documents) !== JSON.stringify(await describeCandidateSaveDocuments(documents)))) throw fail();
  return freeze(output);
}
