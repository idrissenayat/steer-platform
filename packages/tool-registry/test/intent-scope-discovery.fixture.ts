import { intentScopeDiscoveryOutputSchema } from '../src/intent-scope-discovery-contracts.ts';
export function scopeDiscoveryFixture() {
  const input = { organizationId: 'org', productId: 'product', repository: 'owner/repo', draftId: '00000000-0000-4000-8000-000000000001',
    revision: 1, revisionDigest: 'a'.repeat(64), scopeInputDigest: 'b'.repeat(64), cursor: null };
  const entry = { reviewId: '00000000-0000-4000-8000-000000000002', preparationDigest: 'c'.repeat(64) };
  const output = intentScopeDiscoveryOutputSchema.parse({ ...input, kind: 'steer-scope-discovery/v1', observedAt: new Date().toISOString(),
    useUntil: new Date(Date.now() + 600000).toISOString(), entries: [entry], nextCursor: null,
    scope: 'current-owner-configuration-exact-latest-draft', order: 'review-id-descending-not-chronological',
    contentLoaded: false, executionAuthorized: false, savedToGit: false, gateSigned: false });
  return { input, entry, output };
}
