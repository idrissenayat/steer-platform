import { intentRunDiscoveryOutputSchema } from '../src/intent-run-discovery-contracts.ts';
export function runDiscoveryFixture() {
  const input = { organizationId: 'org', productId: 'product', repository: 'owner/repo', draftId: '00000000-0000-4000-8000-000000000001', cursor: null };
  const source = { revision: 1, revisionDigest: 'a'.repeat(64), scopeInputDigest: 'b'.repeat(64) };
  const entries = [{ kind: 'development', source, operationId: '00000000-0000-4000-8000-000000000003', inputDigest: 'c'.repeat(64) },
    { kind: 'scope', source, reviewId: '00000000-0000-4000-8000-000000000002', preparationDigest: 'd'.repeat(64) }];
  const output = intentRunDiscoveryOutputSchema.parse({ ...input, kind: 'steer-run-discovery/v1', observedAt: new Date().toISOString(),
    useUntil: new Date(Date.now() + 600000).toISOString(), latest: { ...source, revision: 2, revisionDigest: 'e'.repeat(64) }, entries, nextCursor: null,
    scope: 'current-owner-records-configuration-all-preserved-revisions', order: 'revision-type-id-descending-not-chronological',
    contentLoaded: false, executionAuthorized: false, savedToGit: false, gateSigned: false });
  return { input, output };
}
