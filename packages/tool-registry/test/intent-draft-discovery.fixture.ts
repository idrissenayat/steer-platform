import { intentDraftDiscoveryOutputSchema } from '../src/intent-draft-discovery-contracts.ts';

export function discoveryFixture() {
  const input = { organizationId: 'org', productId: 'product', repository: 'github:52', cursor: null };
  const entry = { draftId: '00000000-0000-4000-8000-000000000001', createdAt: '2026-09-08T00:00:00.000Z',
    useUntil: '2026-09-09T00:00:00.000Z', latest: { revision: 1, sourceRevision: 1, revisionDigest: 'a'.repeat(64), scopeInputDigest: 'b'.repeat(64) },
    run: { operationId: '00000000-0000-4000-8000-000000000002', inputDigest: 'c'.repeat(64) } };
  const output = intentDraftDiscoveryOutputSchema.parse({ ...input, kind: 'steer-draft-discovery/v1', observedAt: '2026-09-08T01:00:00.000Z',
    entries: [entry], nextCursor: null, scope: 'current-owner-records-configuration', contentLoaded: false, executionAuthorized: false, savedToGit: false, gateSigned: false });
  return { input, entry, output };
}
