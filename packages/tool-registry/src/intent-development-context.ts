import { planIntentScopeBatches } from './intent-scope-batches.ts';

/** A separately versioned drafting context, not a wider scope-assessment envelope.
 * Reassemble whole verified documents across batches without relaxing the existing
 * 32,000-byte document or 128,000-byte aggregate content limits. Input acquisition
 * still permits at most 50 documents. No source selection by model or excerpts.
 * Complete context does NOT prove assessment, provider provenance or authority.
 */
export async function buildIntentDevelopmentContext(rawEvidence: unknown) {
  const plan = await planIntentScopeBatches(rawEvidence), legacy = plan.envelope;
  const evidence: typeof legacy.evidence = [], gaps: Array<{ sourceId: string; reason: string }> = [...plan.summary.coverage.gaps];
  let contentBytes = 0;
  const ordered = plan.batches.flatMap(b => b.envelope.evidence).sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
  for (const source of ordered) {
    if (contentBytes + source.endByte > 128000) { gaps.push({ sourceId: source.sourceId, reason: 'generation-context-limit' }); continue; }
    evidence.push(source); contentBytes += source.endByte;
  }
  const coverage = { inventoryComplete: legacy.coverage.inventoryComplete, inventoryCount: legacy.coverage.inventoryCount,
    includedCount: evidence.length, accessGapCount: legacy.coverage.accessGapCount, gaps,
    complete: plan.summary.coverage.plannedComplete && gaps.length === 0 };
  const payload = { kind: 'steer-development-context/v1' as const, planDigest: plan.summary.planDigest,
    snapshot: legacy.snapshot, scopeInputDigest: legacy.scopeInputDigest,
    // The existing reviewed snapshot remains stable. The separate context digest
    // additionally pins this version's full-source coverage and rendered bytes.
    sourceSnapshotDigest: legacy.sourceSnapshotDigest, coverage, evidence, contentBytes,
    semanticReviewComplete: false as const, authoritativeClearance: false as const };
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['steer-development-context/v1', payload])));
  return freeze({ ...payload, contextDigest: [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('') });
}
export type IntentDevelopmentContext = Awaited<ReturnType<typeof buildIntentDevelopmentContext>>;
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
