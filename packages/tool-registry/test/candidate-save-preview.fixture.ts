import { randomUUID } from 'node:crypto';
import { candidateSaveReviewFixture } from './candidate-save-review.fixture.ts';
import { describeCandidateSaveDocuments } from '../src/candidate-save-review-contracts.ts';
import { describeCandidateSavePreview } from '../src/candidate-save-preview-contracts.ts';
export async function candidateSavePreviewFixture(count = 0, published = false) {
  const f = await candidateSaveReviewFixture(count, published);
  const generation = { operationId: randomUUID(), inputDigest: 'c'.repeat(64) };
  const role = { configurationRevision: 'profile-r1', resultRef: randomUUID(), resultDigest: 'd'.repeat(64), outputDigest: 'e'.repeat(64) };
  const lineage = { ...generation, source: { draftId: f.input.draftId, revision: 1, revisionDigest: f.input.revisionDigest,
    scopeInputDigest: f.input.scopeInputDigest, latestRevision: 1 }, architect: role, testAgent: { ...role, resultRef: randomUUID() },
    originalDocuments: await describeCandidateSaveDocuments(f.content.documents) };
  const input = { ...f.input, reviewDigest: f.output.reviewDigest, generation, itemId: '0260-booking', proposalId: null };
  const destination = { organizationId: f.scope.organizationId, productId: f.scope.productId, repository: f.scope.repository,
    branch: f.scope.branch, itemId: input.itemId, expectedHead: f.output.expectedHead, purpose: 'new-candidate',
    previousBundleDigest: null, amendment: null, relationship: null, lifecycle: 'absent-item', authorityDigest: 'f'.repeat(64) };
  const prepared = await describeCandidateSavePreview(input, f.output, f.content.documents, lineage, destination, 'app:synthetic');
  return { ...f, previewInput: input, lineage, destination, prepared };
}
