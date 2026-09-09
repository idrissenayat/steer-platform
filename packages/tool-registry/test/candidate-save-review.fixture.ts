import { randomUUID } from 'node:crypto';
import { scopeReviewFixture } from './intent-scope-review.fixture.ts';
import { validateIntentScopeBatchResults } from '../src/intent-scope-batches.ts';
import { buildIntentDevelopmentContext } from '../src/intent-development-context.ts';
import { intentScopeReadOutputSchema } from '../src/intent-scope-read-contracts.ts';
import { describeCandidateSaveReview } from '../src/candidate-save-review-contracts.ts';

export async function candidateSaveReviewFixture(count = 4) {
  const f = await scopeReviewFixture(count), { organizationId, productId, repository, draftId, originalText, clarificationTurns } = f.scope;
  const scope = { organizationId, subject: 'human', productId, repository, branch: f.evidence.branch, configurationRevision: 'config-r1' };
  const sourceInput = { organizationId, productId, repository, draftId, revision: 1, revisionDigest: 'a'.repeat(64), scopeInputDigest: f.evidence.scopeInputDigest };
  const content = { originalText, clarificationTurns, documents: { ...f.scope.documents, exam: '# Human-edited Exam فارسی\r\nNOT RUN\n' } };
  const draft = { ...sourceInput, sourceRevision: 1, latestRevision: 1, content, savedToGit: false };
  const { organizationId: _o, productId: _p, repository: _r, ...draftOutput } = draft;
  const results = await validateIntentScopeBatchResults(f.evidence, f.prepared.batches.map(b => ({ planDigest: f.prepared.plan.planDigest,
    batchId: b.metadata.batchId, assessment: f.result(b) })), f.profile.profileRevision);
  const reference = { reviewId: randomUUID(), preparationDigest: f.prepared.preparationDigest };
  const observation = count ? intentScopeReadOutputSchema.parse({ ...reference, organizationId, subject: scope.subject, productId, repository,
    kind: 'steer-scope-review-read/v1', source: { draftId, revision: 1, revisionDigest: sourceInput.revisionDigest, scopeInputDigest: sourceInput.scopeInputDigest, latestRevision: 1 },
    status: 'review-available', review: results, batches: f.prepared.plan.batches.map(b => ({ batchId: b.batchId, state: 'succeeded', resultDigest: 'c'.repeat(64) })),
    semanticQualityVerified: false, authoritativeClearance: false, executionAuthorized: false, retryAuthorized: false, savedToGit: false, gateSigned: false }) : null;
  const binding = count ? { kind: 'recorded' as const, ...reference, results } : { kind: 'empty-corpus' as const, planDigest: f.prepared.plan.planDigest };
  const selection = count ? { kind: 'recorded' as const, ...reference, resultsDigest: results.resultsDigest } : { kind: 'empty-corpus' as const, planDigest: f.prepared.plan.planDigest };
  const context = await buildIntentDevelopmentContext(f.evidence);
  const input = { ...sourceInput, configurationRevision: scope.configurationRevision, sourceSnapshotDigest: context.sourceSnapshotDigest,
    choice: { action: 'new-distinct' as const, reason: 'Booking is separate from reviewed billing scope.' }, scopeReview: selection };
  const review = { ...sourceInput, kind: 'steer-development-review/v1', configurationRevision: scope.configurationRevision, sourceSnapshotDigest: context.sourceSnapshotDigest,
    scopeBatchPlan: f.prepared.plan, evidence: f.evidence, semanticReviewComplete: false, authoritativeClearance: false, executionAuthorized: false, savedToGit: false, gateSigned: false };
  const output = await describeCandidateSaveReview(input, scope.subject, scope.branch, content.documents, f.evidence, binding);
  return { ...f, scope, sourceInput, content, draft: draftOutput, input, binding, observation, review, output };
}
