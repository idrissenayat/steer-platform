import { z } from 'zod';
import { intentEvidenceInputSchema } from './intent-evidence-contracts.ts';
import { intentScopeReadInputSchema, intentScopeReadOutputSchema, verifyIntentScopeReadOutput } from './intent-scope-read-contracts.ts';

export const intentScopeHistoryInputSchema = intentScopeReadInputSchema;
/** Deliberately a different kind from current workflow clearance. Removing a
 * banner is not enough to turn historical findings into a current assessment. */
const historyShape = z.strictObject({ ...intentScopeReadOutputSchema.shape,
  kind: z.literal('steer-scope-review-history/v1'), historical: z.literal(true), reviewExpired: z.boolean(),
  head: intentEvidenceInputSchema.shape.head, sourceSnapshotDigest: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
  inventory: intentEvidenceInputSchema.shape.inventory,
  batches: intentScopeReadOutputSchema.shape.batches.unwrap(), review: intentScopeReadOutputSchema.shape.review.unwrap(),
}).omit({ status: true });
export const intentScopeHistoryOutputSchema = historyShape.superRefine((value, ctx) => {
  try { intentScopeReadOutputSchema.parse(asStructuralRead(value)); }
  catch { ctx.addIssue({ code: 'custom', message: 'Inconsistent historical scope evidence.' }); }
  const ids = value.inventory.map(s => s.sourceId), paths = value.inventory.map(s => s.path);
  if (new Set(ids).size !== ids.length || new Set(paths).size !== paths.length || value.inventory.length !== value.review.coverage.inventoryCount
    || value.review.results.some(b => b.findings.some(f => !value.inventory.some(s => s.targetId === f.targetId)
      || f.citations.some(c => !value.inventory.some(s => s.sourceId === c.sourceId && s.targetId === f.targetId)))))
    ctx.addIssue({ code: 'custom', message: 'Invalid historical source inventory.' });
});
export type IntentScopeHistoryInput = z.infer<typeof intentScopeHistoryInputSchema>;
export type IntentScopeHistoryOutput = z.infer<typeof intentScopeHistoryOutputSchema>;
function asStructuralRead(v: z.infer<typeof historyShape>) {
  const { historical: _historical, reviewExpired: _expired, head: _head, sourceSnapshotDigest: _snapshot, inventory: _inventory, ...base } = v;
  const status = v.source.latestRevision !== v.source.revision ? 'superseded'
    : v.batches.some(b => ['outcome-unknown', 'failed-known'].includes(b.state)) ? 'attention-required'
      : v.batches.some(b => b.state !== 'succeeded') ? 'pending' : v.review.structuralAssessmentComplete ? 'review-available' : 'incomplete';
  return { ...base, kind: 'steer-scope-review-read/v1', status };
}
export async function verifyIntentScopeHistoryOutput(raw: unknown): Promise<IntentScopeHistoryOutput> {
  const result = intentScopeHistoryOutputSchema.parse(raw);
  await verifyIntentScopeReadOutput(asStructuralRead(result));
  return result;
}
export interface IntentScopeHistoryReader {
  readonly scope: Readonly<Pick<IntentScopeHistoryOutput, 'organizationId' | 'subject' | 'productId' | 'repository'>>;
  read(input: IntentScopeHistoryInput, revalidate: () => Promise<void>): Promise<unknown>;
}
