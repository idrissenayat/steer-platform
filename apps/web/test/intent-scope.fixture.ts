import { randomUUID } from 'node:crypto';
import { scopeReviewFixture } from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import { prepareIntentScopeReview } from '@steer/tool-registry/intent-scope-review';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import type { ScopeEditorSource } from '../app/intent-scope-editor.ts';
import type { IntentScopeReadOutput } from '@steer/tool-registry/intent-scope-read-contracts';
import { scopeDiscoveryFixture } from '../../../packages/tool-registry/test/intent-scope-discovery.fixture.ts';
export async function scopeEditorFixture(count = 4, candidate = false) {
  const original = await scopeReviewFixture(count);
  const evidence = candidate ? { ...original.evidence, inventory: original.evidence.inventory.map((s, n) => ({ ...s,
    targetId: `items/${String(Math.floor(n / 2) + 1).padStart(4, '0')}-booking`, status: 'candidate' as const,
    path: `items/${String(Math.floor(n / 2) + 1).padStart(4, '0')}-booking/candidates/00000000-0000-4000-8000-000000000001/${n % 2 ? 'SPEC' : 'BRIEF'}.md` })) } : original.evidence;
  const f = { ...original, evidence, prepared: await prepareIntentScopeReview(original.scope, evidence, original.profile) }, p = f.prepared.plan, c = p.coverage;
  const input = { organizationId: f.scope.organizationId, productId: f.scope.productId, repository: f.scope.repository,
    draftId: f.scope.draftId, revision: 1, revisionDigest: 'b'.repeat(64), scopeInputDigest: p.scopeInputDigest,
    sourceSnapshotDigest: p.sourceSnapshotDigest, configurationRevision: 'server-r1' };
  const source: ScopeEditorSource = { input, subject: 'human', evidence: f.evidence, plan: p };
  const prepared = { ...input, kind: 'steer-scope-prepare/v1' as const, outcome: 'prepared' as const,
    reference: { reviewId: randomUUID(), preparationDigest: f.prepared.preparationDigest },
    coverage: { inventoryComplete: c.inventoryComplete, accessGapCount: c.accessGapCount, inventoryCount: c.inventoryCount,
      plannedCount: c.plannedCount, gapCount: c.gaps.length, batchCount: p.batches.length, plannedComplete: c.plannedComplete },
    originalPreserved: true, readyToRequestStart: true, modelCallsStarted: 0 as const, semanticReviewComplete: false as const,
    authoritativeClearance: false as const, executionAuthorized: false as const, savedToGit: false as const, gateSigned: false as const };
  const { configurationRevision: _config, sourceSnapshotDigest: _snapshot, scopeInputDigest: _scope, ...revision } = input;
  const startInput = { ...revision, ...prepared.reference };
  const started = { ...startInput, kind: 'steer-scope-start/v1' as const,
    receipt: { outcome: 'acknowledged' as const, workflowId: `steer-scope/v1/${encodeURIComponent(input.organizationId)}/${startInput.reviewId}`, runId: randomUUID(), state: 'RUNNING' as const },
    semanticReviewComplete: false as const, authoritativeClearance: false as const, executionAuthorized: false as const,
    savedToGit: false as const, gateSigned: false as const, retryAuthorized: false as const };
  const readInput = { organizationId: input.organizationId, productId: input.productId, repository: input.repository, ...prepared.reference };
  async function observation(completed: number, explanation?: string): Promise<IntentScopeReadOutput> {
    const review = await validateIntentScopeBatchResults(f.evidence, f.prepared.batches.slice(0, completed).map(b => ({ planDigest: p.planDigest,
      batchId: b.metadata.batchId, assessment: { ...f.result(b), findings: f.result(b).findings.map(finding => ({ ...finding,
        overlapExplanation: explanation ?? finding.overlapExplanation })) } })), f.profile.profileRevision);
    return { ...readInput, kind: 'steer-scope-review-read/v1', subject: 'human',
      source: { draftId: input.draftId, revision: 1, revisionDigest: input.revisionDigest, scopeInputDigest: input.scopeInputDigest, latestRevision: 1 },
      status: completed === p.batches.length ? 'review-available' : 'pending', review,
      batches: p.batches.map((b, index) => ({ batchId: b.batchId, state: index < completed ? 'succeeded' : 'pending', resultDigest: index < completed ? 'c'.repeat(64) : null })),
      semanticQualityVerified: false, authoritativeClearance: false, executionAuthorized: false, retryAuthorized: false, savedToGit: false, gateSigned: false };
  }
  const { configurationRevision: _configuration, sourceSnapshotDigest: _source, ...discoverySource } = input;
  const discoveryInput = { ...discoverySource, cursor: null };
  const discovery = { ...scopeDiscoveryFixture().output, ...discoveryInput, entries: [prepared.reference] };
  return { ...f, source, input, prepared, startInput, started, readInput, discoveryInput, discovery, observation, pending: await observation(0), ready: await observation(p.batches.length) };
}
