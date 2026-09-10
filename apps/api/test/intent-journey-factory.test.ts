import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createOwnedIntentJourney } from '../src/runtime.ts';
import { manageIntentJourney, intentJourneyMethods } from '../src/intent-journey-services.ts';
import { intentJourneyFactoryFixture } from './intent-journey-factory.fixture.ts';

test('concrete factory constructs every journey capability without SQL, provider, model, workflow or policy effects', async () => {
  const f = intentJourneyFactoryFixture(), owned = await createOwnedIntentJourney(f.expected, f.config, f.deps);
  assert.deepEqual(Object.keys(owned.services).sort(), Object.keys(intentJourneyMethods).sort());
  assert.deepEqual(f.state.calls, []); assert.equal(f.state.closed, 0);
  const managed = manageIntentJourney(f.expected, owned, async () => {});
  const request = { organizationId: f.records.organizationId, productId: f.records.productId, repository: f.records.repository, requestId: randomUUID() };
  assert.deepEqual(await managed.services.intentDrafts.create(request, async () => {}), { outcome: 'unavailable', savedToGit: false });
  assert.deepEqual(f.state.calls, ['records-policy']);
  await managed.shutdown(); assert.equal(f.state.closed, 1); await owned.shutdown(); assert.equal(f.state.closed, 1);
  await assert.rejects(managed.services.intentDrafts.create(request, async () => {}));
});
test('factory rejects crossed records, publication, budget and scope-profile bindings before any external access', async () => {
  const mutations = [
    (f: ReturnType<typeof intentJourneyFactoryFixture>) => { f.config.scope.subject = 'foreign'; },
    (f: ReturnType<typeof intentJourneyFactoryFixture>) => { f.config.development.recordsPolicyDigest = 'f'.repeat(64); },
    (f: ReturnType<typeof intentJourneyFactoryFixture>) => { f.config.candidate.configurationRevision = 'other'; },
    (f: ReturnType<typeof intentJourneyFactoryFixture>) => { f.config.publication.productId = 'foreign'; },
    (f: ReturnType<typeof intentJourneyFactoryFixture>) => { f.config.publication.itemIds = ['other']; },
    (f: ReturnType<typeof intentJourneyFactoryFixture>) => { f.config.scope.budget.budgetId = randomUUID(); },
    (f: ReturnType<typeof intentJourneyFactoryFixture>) => { f.config.scope.scopeTerms.profileDigest = 'f'.repeat(64); },
    (f: ReturnType<typeof intentJourneyFactoryFixture>) => { (f.config as any).evidence = 'PRIVATE invented result'; },
    (f: ReturnType<typeof intentJourneyFactoryFixture>) => { (f.expected as any).documents = 'PRIVATE injected scope'; },
  ];
  for (const change of mutations) {
    const f = intentJourneyFactoryFixture(); change(f);
    await assert.rejects(createOwnedIntentJourney(f.expected, f.config, f.deps), /^Error: Intent journey construction is unavailable\.$/);
    assert.deepEqual(f.state.calls, []); assert.equal(f.state.closed, 1);
  }
});
test('missing late-stage policy capabilities clean up transferred resources and never expose a partial runtime', async () => {
  for (const change of ['pools', 'same-pool', 'reader', 'draft-policy', 'history-policy', 'confirmation', 'scheduler', 'clock', 'read', 'proposals'] as const) {
    const f = intentJourneyFactoryFixture();
    if (change === 'pools') (f.deps.resources.pools as any).execution = undefined;
    if (change === 'same-pool') f.deps.resources.pools.execution = f.deps.resources.pools.drafts;
    if (change === 'reader') (f.deps.resources.reader as any).readDirectoryInventory = undefined;
    if (change === 'draft-policy') (f.deps.drafts.lifecycle as any).authorize = undefined;
    if (change === 'history-policy') delete f.deps.development.history.authorizeHistoricalRead;
    if (change === 'confirmation') (f.deps.candidate.confirmation as any).authorizeConfirmation = undefined;
    if (change === 'scheduler') (f.deps.candidate.start as any).scheduler = undefined;
    if (change === 'clock') (f.deps.candidate.publication as any).verifyPublicationClock = undefined;
    if (change === 'read') (f.deps.candidate as any).authorizeRead = undefined;
    if (change === 'proposals') (f.deps.candidate as any).authorizeProposals = undefined;
    await assert.rejects(createOwnedIntentJourney(f.expected, f.config, f.deps), /^Error: Intent journey construction is unavailable\.$/);
    assert.equal(f.state.closed, 1); assert.deepEqual(f.state.calls, []);
  }
});
test('cleanup completion is shared, failures are sanitized, and a pending owner cannot be reported closed', async () => {
  const f = intentJourneyFactoryFixture(); let release!: () => void, entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  f.deps.resources.shutdown = async () => { f.state.closed++; entered(); await new Promise<void>(resolve => { release = resolve; }); throw new Error('PRIVATE owner'); };
  const owned = await createOwnedIntentJourney(f.expected, f.config, f.deps), stop = owned.shutdown();
  assert.equal(stop, owned.shutdown()); await ready; assert.equal(f.state.closed, 1); let ended = false; void stop.catch(() => { ended = true; });
  await Promise.resolve(); assert.equal(ended, false); release();
  await assert.rejects(stop, /^Error: Intent journey construction cleanup failed\.$/); assert.equal(f.state.closed, 1);
  const invalid = intentJourneyFactoryFixture(); invalid.config.publication.branch = 'foreign';
  invalid.deps.resources.shutdown = async () => { invalid.state.closed++; throw new Error('PRIVATE failed initialization cleanup'); };
  await assert.rejects(createOwnedIntentJourney(invalid.expected, invalid.config, invalid.deps), /^Error: Intent journey construction cleanup failed\.$/);
  assert.equal(invalid.state.closed, 1);
});
test('assembled configuration and transferred resource cleanup do not follow later caller replacements', async () => {
  const f = intentJourneyFactoryFixture(), owned = await createOwnedIntentJourney(f.expected, f.config, f.deps);
  const before = structuredClone(owned.configuration);
  f.config.development.configurationRevision = 'later'; f.config.publication.itemIds.push('another');
  (f.expected as any).subject = 'later';
  f.deps.resources.shutdown = async () => { throw new Error('Replaced cleanup must not run'); };
  assert.deepEqual(owned.configuration, before); assert.equal(Object.isFrozen(owned.configuration.itemIds), true);
  await owned.shutdown(); assert.equal(f.state.closed, 1); assert.deepEqual(f.state.calls, []);
});
