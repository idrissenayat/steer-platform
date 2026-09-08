import { z } from 'zod';
import { buildIntentEvidenceEnvelope, intentEvidenceInputSchema, intentScopeAssessmentSchema, validateIntentScopeAssessment } from './intent-evidence-contracts.ts';

const digest = intentEvidenceInputSchema.shape.scopeInputDigest, id = intentEvidenceInputSchema.shape.productId;
const limits = Object.freeze({ maxBatches: 8, maxSources: 32, maxSourceBytes: 32000, maxBatchBytes: 128000 });
const gapSchema = z.strictObject({ sourceId: id, reason: z.enum(['not-provided', 'empty-content', 'source-context-limit', 'target-incomplete', 'target-context-limit', 'batch-count-limit']) });
const batchMetadata = z.strictObject({ batchId: digest, index: z.number().int().min(0).max(7), assessmentInputDigest: digest,
  sourceIds: z.array(id).min(1).max(32), targetIds: z.array(id).min(1).max(32), contentBytes: z.number().int().positive().max(128000) });
export const intentScopeBatchPlanSchema = z.strictObject({ kind: z.literal('steer-scope-batch-plan/v1'), planningRevision: z.literal('whole-target/v1'),
  planDigest: digest, scopeInputDigest: digest, sourceSnapshotDigest: digest, batches: z.array(batchMetadata).max(8),
  coverage: z.strictObject({ inventoryComplete: z.boolean(), accessGapCount: z.number().int().min(0).max(1000000), inventoryCount: z.number().int().min(0).max(1000),
    plannedCount: z.number().int().min(0).max(256), gaps: z.array(gapSchema).max(1000), plannedComplete: z.boolean() }),
  modelCallsStarted: z.literal(0), semanticReviewComplete: z.literal(false), authoritativeClearance: z.literal(false),
});
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const bytes = (v: string) => new TextEncoder().encode(v);
async function hash(v: unknown) {
  const h = await crypto.subtle.digest('SHA-256', bytes(JSON.stringify(v)));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
type Source = z.infer<typeof intentEvidenceInputSchema.shape.inventory>[number];

/** Provider-free planning only. Whole target groups preserve Brief/Spec, canonical
 * versus proposed scope and all document qualifiers together. An oversized or
 * incomplete target is withheld, never split into misleading excerpts. */
export async function planIntentScopeBatches(raw: unknown) {
  const input = intentEvidenceInputSchema.parse(raw), envelope = await buildIntentEvidenceEnvelope(input);
  const docs = new Map(input.documents.map(d => [d.sourceId, d.content]));
  const groups = new Map<string, Source[]>();
  const ordered = [...input.inventory].sort((a, b) => a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  for (const source of ordered) { const group = groups.get(source.targetId) ?? []; group.push(source); groups.set(source.targetId, group); }
  const gaps: z.infer<typeof gapSchema>[] = [], chunks: Source[][] = []; let current: Source[] = [], size = 0;
  const flush = () => { if (current.length) { chunks.push(current); current = []; size = 0; } };
  for (const group of groups.values()) {
    const unavailable = new Map<string, z.infer<typeof gapSchema>['reason']>(); let groupBytes = 0;
    for (const s of group) {
      const content = docs.get(s.sourceId), length = content === undefined ? 0 : bytes(content).length;
      if (content === undefined) unavailable.set(s.sourceId, 'not-provided');
      else if (!content.trim()) unavailable.set(s.sourceId, 'empty-content');
      else if (length > limits.maxSourceBytes) unavailable.set(s.sourceId, 'source-context-limit');
      groupBytes += length;
    }
    if (unavailable.size) { gaps.push(...group.map(s => ({ sourceId: s.sourceId, reason: unavailable.get(s.sourceId) ?? 'target-incomplete' as const }))); continue; }
    if (group.length > limits.maxSources || groupBytes > limits.maxBatchBytes) { gaps.push(...group.map(s => ({ sourceId: s.sourceId, reason: 'target-context-limit' as const }))); continue; }
    if (current.length + group.length > limits.maxSources || size + groupBytes > limits.maxBatchBytes) flush();
    if (chunks.length >= limits.maxBatches) { gaps.push(...group.map(s => ({ sourceId: s.sourceId, reason: 'batch-count-limit' as const }))); continue; }
    current.push(...group); size += groupBytes;
  }
  flush();
  const batches = [];
  for (const [index, sources] of chunks.entries()) {
    // This envelope's completeness is batch-local only. The parent manifest keeps
    // global inventory/access/context gaps and is mandatory when combining results.
    const local = await buildIntentEvidenceEnvelope({ ...input, inventoryComplete: true, accessGapCount: 0, inventory: sources,
      documents: sources.map(s => ({ sourceId: s.sourceId, content: docs.get(s.sourceId)! })) });
    if (!local.coverage.complete) throw new Error('Invalid scope batch.');
    const sourceIds = sources.map(s => s.sourceId), targetIds = [...new Set(sources.map(s => s.targetId))];
    const batchId = await hash(['steer-scope-batch/v1', envelope.assessmentInputDigest, 'whole-target/v1', index, local.assessmentInputDigest, sourceIds, targetIds]);
    const metadata = batchMetadata.parse({ batchId, index, assessmentInputDigest: local.assessmentInputDigest, sourceIds, targetIds,
      contentBytes: local.evidence.reduce((n, s) => n + s.endByte, 0) });
    batches.push({ metadata, envelope: local });
  }
  const coverage = { inventoryComplete: input.inventoryComplete, accessGapCount: input.accessGapCount, inventoryCount: ordered.length,
    plannedCount: chunks.reduce((n, c) => n + c.length, 0), gaps,
    plannedComplete: input.inventoryComplete && input.accessGapCount === 0 && gaps.length === 0 };
  const payload = { kind: 'steer-scope-batch-plan/v1' as const, planningRevision: 'whole-target/v1' as const, scopeInputDigest: input.scopeInputDigest,
    sourceSnapshotDigest: envelope.sourceSnapshotDigest, batches: batches.map(b => b.metadata), coverage, modelCallsStarted: 0 as const,
    semanticReviewComplete: false as const, authoritativeClearance: false as const };
  const summary = intentScopeBatchPlanSchema.parse({ ...payload, planDigest: await hash(['steer-scope-batch-plan/v1', payload]) });
  return freeze({ summary, batches, envelope });
}

const receipt = z.strictObject({ planDigest: digest, batchId: digest, assessment: intentScopeAssessmentSchema });
const validatedBatch = z.strictObject({ batchId: digest, ...intentScopeAssessmentSchema.shape,
  kind: z.literal('steer-validated-scope-assessment/v1'), state: z.enum(['assessed-declared-scope', 'incomplete']),
  unassessedSourceIds: z.array(id).max(32), authoritativeClearance: z.literal(false),
});
/** Portable response shape, not a substitute for verification against source bytes. */
export const intentScopeBatchResultsSchema = z.strictObject({ kind: z.literal('steer-scope-batch-results/v1'),
  planDigest: digest, configurationRevision: id, coverage: intentScopeBatchPlanSchema.shape.coverage,
  pendingBatchIds: z.array(digest).max(8), results: z.array(validatedBatch).max(8),
  state: z.enum(['no-sources', 'assessed-declared-corpus', 'incomplete']), structuralAssessmentComplete: z.boolean(),
  semanticQualityVerified: z.literal(false), authoritativeClearance: z.literal(false), executionAuthorized: z.literal(false),
  savedToGit: z.literal(false), resultsDigest: digest,
}).superRefine((v, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Inconsistent combined scope result.' });
  const ids = [...v.pendingBatchIds, ...v.results.map(r => r.batchId)], c = v.coverage;
  const recordedSources = v.results.flatMap(r => [...r.findings.flatMap(f => f.assessedSourceIds), ...r.unassessedSourceIds]);
  if (new Set(ids).size !== ids.length || ids.length > 8 || c.plannedCount > c.inventoryCount
    || ids.length > c.plannedCount || new Set(recordedSources).size !== recordedSources.length
    || recordedSources.length > c.plannedCount || (v.pendingBatchIds.length === 0 && recordedSources.length !== c.plannedCount)
    || (v.pendingBatchIds.length > 0 && recordedSources.length >= c.plannedCount)
    || c.gaps.some(g => recordedSources.includes(g.sourceId))
    || c.plannedCount + c.gaps.length !== c.inventoryCount || new Set(c.gaps.map(g => g.sourceId)).size !== c.gaps.length
    || c.plannedComplete !== (c.inventoryComplete && c.accessGapCount === 0 && c.gaps.length === 0)) fail();
  for (const r of v.results) {
    const assessed = r.findings.flatMap(f => f.assessedSourceIds), targets = r.findings.map(f => f.targetId);
    if (r.configurationRevision !== v.configurationRevision || new Set(assessed).size !== assessed.length
      || assessed.length + r.unassessedSourceIds.length < 1 || assessed.length + r.unassessedSourceIds.length > 32
      || new Set(targets).size !== targets.length || new Set([...assessed, ...r.unassessedSourceIds]).size !== assessed.length + r.unassessedSourceIds.length
      || (r.state === 'assessed-declared-scope') !== (r.unassessedSourceIds.length === 0 && r.findings.every(f => f.relation !== 'insufficient-evidence'))) fail();
    for (const finding of r.findings) {
      if (finding.assessedSourceIds.some(s => !finding.citations.some(cite => cite.sourceId === s))
        || finding.citations.some(cite => !finding.assessedSourceIds.includes(cite.sourceId) || cite.endByte - cite.startByte !== bytes(cite.quote).length)) fail();
    }
  }
  const complete = c.plannedComplete && ids.length > 0 && v.pendingBatchIds.length === 0 && v.results.every(r => r.state === 'assessed-declared-scope');
  if (v.structuralAssessmentComplete !== complete || v.state !== (c.inventoryCount === 0 ? 'no-sources' : complete ? 'assessed-declared-corpus' : 'incomplete')) fail();
});
export async function verifyIntentScopeBatchResults(raw: unknown) {
  const result = intentScopeBatchResultsSchema.parse(raw), { resultsDigest, ...payload } = result;
  if (bytes(JSON.stringify(result)).length > 4000000 || resultsDigest !== await hash(['steer-scope-batch-results/v1', payload])) throw new Error('Invalid scope result digest.');
  return freeze(result);
}
/** Recompute from exact source bytes; never trust a caller's edited plan or an
 * individual batch's completeness as full-corpus coverage. This validates structure
 * and citations, NOT model quality, provider provenance, budget or authority. */
export async function validateIntentScopeBatchResults(rawEvidence: unknown, rawResults: unknown, rawConfigurationRevision: unknown) {
  const configurationRevision = id.parse(rawConfigurationRevision), plan = await planIntentScopeBatches(rawEvidence);
  const receipts = z.array(receipt).max(8).parse(rawResults);
  if (bytes(JSON.stringify(receipts)).length > 4000000) throw new Error('Scope results exceed limits.');
  const byId = new Map(receipts.map(r => [r.batchId, r]));
  if (byId.size !== receipts.length || receipts.some(r => r.planDigest !== plan.summary.planDigest || !plan.batches.some(b => b.metadata.batchId === r.batchId))) throw new Error('Stale or duplicate scope result.');
  const results = [], pendingBatchIds = [];
  for (const batch of plan.batches) {
    const result = byId.get(batch.metadata.batchId);
    if (!result) { pendingBatchIds.push(batch.metadata.batchId); continue; }
    results.push({ batchId: batch.metadata.batchId, ...validateIntentScopeAssessment(batch.envelope, result.assessment, configurationRevision) });
  }
  const structuralAssessmentComplete = plan.summary.coverage.plannedComplete && plan.batches.length > 0 && pendingBatchIds.length === 0
    && results.every(r => r.state === 'assessed-declared-scope');
  const payload = { kind: 'steer-scope-batch-results/v1' as const, planDigest: plan.summary.planDigest, configurationRevision,
    coverage: plan.summary.coverage, pendingBatchIds, results,
    state: plan.summary.coverage.inventoryCount === 0 ? 'no-sources' as const : structuralAssessmentComplete ? 'assessed-declared-corpus' as const : 'incomplete' as const,
    structuralAssessmentComplete, semanticQualityVerified: false as const, authoritativeClearance: false as const, executionAuthorized: false as const, savedToGit: false as const };
  return freeze(intentScopeBatchResultsSchema.parse({ ...payload, resultsDigest: await hash(['steer-scope-batch-results/v1', payload]) }));
}
