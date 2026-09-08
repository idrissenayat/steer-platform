import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { scopeReviewFixture } from '../../tool-registry/test/intent-scope-review.fixture.ts';
import { createScopeReviewOperationStore, prepareScopeReviewManifest, scopeReviewConfigurationSchema, scopeReviewManifestSchema } from '../src/scope-review-operations.ts';

test('scope metadata derives exact multi-batch input/profile bindings without private text or call authority', async () => {
  const f = await scopeReviewFixture(40), manifest = await prepareScopeReviewManifest(f.scope, f.evidence, f.profile, 2);
  assert.equal(manifest.batches.length, 2);
  assert.equal(manifest.preparationDigest, f.prepared.preparationDigest);
  assert.deepEqual(manifest.batches, f.prepared.batches.map(b => ({ batchId: b.metadata.batchId, inputDigest: b.inputDigest })));
  assert.ok(Object.isFrozen(manifest) && Object.isFrozen(manifest.batches[0]));
  for (const text of [f.scope.originalText, f.scope.documents.brief, f.profile.instructions, f.evidence.documents[0]!.content])
    assert.ok(!JSON.stringify(manifest).includes(text));
  assert.equal(scopeReviewManifestSchema.safeParse({ ...manifest, request: f.prepared.batches[0]!.packet }).success, false);
  assert.equal(scopeReviewManifestSchema.safeParse({ ...manifest, sourceRevision: 3 }).success, false);
  assert.equal(scopeReviewManifestSchema.safeParse({ ...manifest, batches: [manifest.batches[0], manifest.batches[0]] }).success, false);
  await assert.rejects(prepareScopeReviewManifest({ ...f.scope, originalText: 'Changed' }, f.evidence, f.profile, 2));
  const empty = await scopeReviewFixture(0);
  await assert.rejects(prepareScopeReviewManifest(empty.scope, empty.evidence, empty.profile, 1));
});

test('role configuration cannot supply an extra cap, borrow another owner budget or masquerade as Architect', async () => {
  const f = await scopeReviewFixture(), manifest = await prepareScopeReviewManifest(f.scope, f.evidence, f.profile, 1);
  const config = { organizationId: manifest.organizationId, subject: 'human', productId: manifest.productId, repository: manifest.repository,
    branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'b'.repeat(64), expiresAt: new Date(Date.now()+60000).toISOString(),
    budget: { organizationId: manifest.organizationId, subject: 'human', budgetId: randomUUID(), configurationRevision: 'r1', approvalDigest: 'a'.repeat(64), capMicrousd: 10, architectMicrousd: 3, testAgentMicrousd: 2 },
    scopeTerms: { approvalDigest: 'c'.repeat(64), profileDigest: manifest.profileDigest, amountMicrousd: 4 } };
  assert.ok(scopeReviewConfigurationSchema.safeParse(config).success);
  for (const altered of [{ ...config, subject: 'foreign' }, { ...config, scopeTerms: { ...config.scopeTerms, amountMicrousd: 11 } },
    { ...config, scopeTerms: { ...config.scopeTerms, capMicrousd: 100 } }]) assert.equal(scopeReviewConfigurationSchema.safeParse(altered).success, false);
  let connections = 0;
  const store = createScopeReviewOperationStore({ connect: async () => { connections++; throw new Error('Unexpected database'); } }, config,
    { authorize: async () => { throw new Error('Synthetic authority denied'); } });
  assert.equal((await store.admit(manifest)).outcome, 'unavailable'); assert.equal(connections, 0);
  assert.equal((await store.transition({ reviewId: randomUUID(), preparationDigest: manifest.preparationDigest, ...manifest.batches[0],
    event: { type: 'checkpoint', owner: 'worker', fencingToken: 1, resultDigest: 'f'.repeat(64) } })).outcome,'unavailable');
  assert.equal(connections,0);
  store.close(); assert.equal((await store.admit(manifest)).outcome, 'unavailable');
});
