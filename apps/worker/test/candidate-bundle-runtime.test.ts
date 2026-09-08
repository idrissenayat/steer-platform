import assert from 'node:assert/strict';
import test from 'node:test';
import { createDurableCandidateBundleStore } from '../src/candidate-bundle-runtime.ts';

const binding = { organizationId: 'synthetic', installationId: 1, repositoryId: 52, owner: 'synthetic', repository: 'fixture', branch: 'codex/fixture' };
const publication = { organizationId: binding.organizationId, productId: 'product', repository: 'github:52', branch: binding.branch,
  serviceCommitter: 'app:123', itemIds: ['0210-synthetic'], platformRevision: 'b'.repeat(40), gate2DecisionDigest: 'c'.repeat(64) };
const execution = { organizationId: publication.organizationId, subject: 'synthetic-human', productId: publication.productId,
  repository: publication.repository, branch: publication.branch, action: 'candidate-save', budget: null,
  configurationRevision: 'candidate-save-r1', recordsPolicyDigest: 'd'.repeat(64), expiresAt: new Date(Date.now() + 3600000).toISOString() };

test('candidate composition never accepts scope, budget or authority-service substitutions at construction', () => {
  let calls = 0;
  const deny = async (): Promise<never> => { calls++; throw new Error('No synthetic I/O allowed'); };
  const ports = { fetch: deny, appJwt: deny, authorizeRead: deny, authorizeOperation: deny, evaluateDispatch: deny };
  for (const options of [{ execution: { ...execution, repository: 'github:99' }, publication },
    { execution: { ...execution, action: 'develop' }, publication }, { execution, publication, dispatchAllowed: true },
    { execution, publication: { ...publication, itemIds: [] } }])
    assert.throws(() => createDurableCandidateBundleStore({ connect: deny }, binding, options, ports));
  assert.throws(() => createDurableCandidateBundleStore({ connect: deny }, binding, { execution, publication }, { ...ports, evaluateDispatch: undefined! }));
  assert.equal(calls, 0);
});
test('candidate composition is lazy and malformed submissions or recovery requests never touch SQL or Git', async () => {
  let calls = 0;
  const deny = async (): Promise<never> => { calls++; throw new Error('No synthetic I/O allowed'); };
  const store = createDurableCandidateBundleStore({ connect: deny }, binding, { execution, publication },
    { fetch: deny, appJwt: deny, authorizeRead: deny, authorizeOperation: deny, evaluateDispatch: deny });
  assert.equal(calls, 0);
  for (const raw of [{}, { operationId: 'caller-selected', approval: true }, { bundle: {}, confirmation: {} }]) {
    await assert.rejects(store.prepare(raw)); await assert.rejects(store.inspect(raw)); await assert.rejects(store.compareAndWrite(raw));
  }
  store.close(); store.close(); assert.equal(calls, 0);
});
