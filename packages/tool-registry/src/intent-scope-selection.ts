import { z } from 'zod';
import { intentScopeReadInputSchema, verifyIntentScopeReadOutput } from './intent-scope-read-contracts.ts';
import { intentScopeBatchResultsSchema, planIntentScopeBatches, validateIntentScopeBatchResults } from './intent-scope-batches.ts';
import { intentEvidenceInputSchema } from './intent-evidence-contracts.ts';

const digest = intentScopeReadInputSchema.shape.preparationDigest;
const reference = intentScopeReadInputSchema.pick({ reviewId: true, preparationDigest: true });
const empty = z.strictObject({ kind: z.literal('empty-corpus'), planDigest: digest });
export const intentScopeSelectionSchema = z.discriminatedUnion('kind', [empty,
  reference.extend({ kind: z.literal('recorded'), resultsDigest: digest })]);
export const intentScopeBindingSchema = z.discriminatedUnion('kind', [empty,
  reference.extend({ kind: z.literal('recorded'), results: intentScopeBatchResultsSchema })]);
export type IntentScopeSelection = z.infer<typeof intentScopeSelectionSchema>;
export type IntentScopeBinding = z.infer<typeof intentScopeBindingSchema>;
export type ScopeSelectionSource = { organizationId: string; subject: string; productId: string; repository: string;
  draftId: string; revision: number; revisionDigest: string; scopeInputDigest: string };
const fail = () => new Error('The selected scope assessment is unavailable or changed.');

/** Pure byte/coverage validation, NOT provider provenance, semantic truth or
 * authority. Empty means explicitly complete empty inventory, never failed search. */
export async function verifyBoundIntentScope(rawBinding: unknown, rawEvidence: unknown): Promise<IntentScopeBinding> {
  const binding = intentScopeBindingSchema.parse(rawBinding), evidence = intentEvidenceInputSchema.parse(rawEvidence);
  if (binding.kind === 'empty-corpus') {
    const plan = await planIntentScopeBatches(evidence);
    if (!plan.summary.coverage.plannedComplete || evidence.inventory.length !== 0 || plan.summary.batches.length !== 0
      || binding.planDigest !== plan.summary.planDigest) throw fail();
  } else {
    const result = binding.results;
    const verified = await validateIntentScopeBatchResults(evidence, result.results.map(r => ({ planDigest: result.planDigest, batchId: r.batchId,
      assessment: { assessmentInputDigest: r.assessmentInputDigest, configurationRevision: r.configurationRevision, findings: r.findings } })), result.configurationRevision);
    if (!verified.structuralAssessmentComplete || JSON.stringify(verified) !== JSON.stringify(result)) throw fail();
  }
  return binding;
}

/** Consume a current authorized reader result for one exact latest human draft.
 * Never accept caller findings in place of that reader at the server boundary. */
export async function bindRecordedIntentScope(rawSelection: unknown, rawResult: unknown, evidence: unknown, source: ScopeSelectionSource): Promise<IntentScopeBinding> {
  const selection = intentScopeSelectionSchema.parse(rawSelection);
  if (selection.kind !== 'recorded') throw fail();
  const result = await verifyIntentScopeReadOutput(rawResult);
  if (result.status !== 'review-available' || !result.review || result.review.resultsDigest !== selection.resultsDigest
    || result.reviewId !== selection.reviewId || result.preparationDigest !== selection.preparationDigest
    || result.subject !== source.subject || (['organizationId', 'productId', 'repository'] as const).some(k => result[k] !== source[k])
    || result.source.latestRevision !== source.revision
    || (['draftId', 'revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => result.source[k] !== source[k])) throw fail();
  return verifyBoundIntentScope({ kind: 'recorded', reviewId: selection.reviewId, preparationDigest: selection.preparationDigest, results: result.review }, evidence);
}
export function intentScopeSelectionFor(binding: IntentScopeBinding): IntentScopeSelection {
  return binding.kind === 'empty-corpus' ? binding : { kind: 'recorded', reviewId: binding.reviewId,
    preparationDigest: binding.preparationDigest, resultsDigest: binding.results.resultsDigest };
}
