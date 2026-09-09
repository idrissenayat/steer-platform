import assert from 'node:assert/strict';
import test from 'node:test';
import { manageIntentJourney, intentJourneyMethods } from '../src/intent-journey-services.ts';
import { intentJourneyFixture } from './intent-journey.fixture.ts';

const current = async () => {};
test('managed journey requires every scoped capability plus a separately owned publication recorder', () => {
  for (const name of Object.keys(intentJourneyMethods)) {
    const f = intentJourneyFixture(); delete (f.services as any)[name];
    assert.throws(() => manageIntentJourney(f.configuration, f.owned, current)); assert.deepEqual(f.state.calls, []);
  }
  for (const change of ['extra', 'publication', 'configuration', 'shutdown', 'private-scope'] as const) {
    const f = intentJourneyFixture();
    if (change === 'extra') (f.services as any).briefWriter = {};
    if (change === 'publication') (f.owned as any).publicationRecords = undefined;
    if (change === 'configuration') (f.owned.configuration as any).recordsPolicyDigest = 'b'.repeat(64);
    if (change === 'shutdown') (f.owned as any).shutdown = undefined;
    if (change === 'private-scope') (f.services.intentDrafts.scope as any).documents = 'PRIVATE scope injection';
    assert.throws(() => manageIntentJourney(f.configuration, f.owned, current)); assert.deepEqual(f.state.calls, []);
  }
});
test('all service scopes reject foreign owners or homes, and required branch/configuration/item bindings cannot be omitted', () => {
  for (const name of Object.keys(intentJourneyMethods)) for (const key of ['organizationId', 'subject', 'productId', 'repository']) {
    const f = intentJourneyFixture(); (f.services as any)[name].scope[key] = 'foreign';
    assert.throws(() => manageIntentJourney(f.configuration, f.owned, current));
  }
  for (const [name, key] of [['candidateSaveStarter', 'branch'], ['intentScopePreparer', 'configurationRevision'],
    ['intentDevelopmentPreparer', 'configurationRevision'], ['candidateSavePreparer', 'configurationRevision'], ['candidateProposalReader', 'itemIds']]) {
    const f = intentJourneyFixture(); delete (f.services as any)[name!].scope[key!];
    assert.throws(() => manageIntentJourney(f.configuration, f.owned, current));
  }
  const f = intentJourneyFixture(); (f.owned.publicationRecords.scope as any).itemIds = ['0271-other'];
  assert.throws(() => manageIntentJourney(f.configuration, f.owned, current));
});
test('pinned explicit methods recheck both identity and current bundle use, but expose no unrelated services', async () => {
  const f = intentJourneyFixture(); let authorizations = 0, identities = 0;
  f.services.intentDrafts.read = async (input, revalidate) => { await revalidate(); return { syntheticReference: input.draftId }; };
  const managed = manageIntentJourney(f.configuration, f.owned, async () => { authorizations++; });
  const input = { organizationId: 'synthetic', productId: 'product', repository: 'github:1', draftId: 'test-reference', revision: 'latest' as const };
  assert.deepEqual(await managed.services.intentDrafts.read(input, async () => { identities++; }), { syntheticReference: 'test-reference' });
  assert.equal(authorizations, 3); assert.equal(identities, 6);
  assert.equal('briefWriter' in managed.services, false); assert.equal('publicationRecords' in managed.services, false);
  assert.equal(Object.isFrozen(managed.services.intentDrafts.scope), true);
  const stop = managed.shutdown(); assert.equal(stop, managed.shutdown()); await stop; assert.equal(f.state.closed, 1);
  await assert.rejects(managed.services.intentDrafts.read(input, current));
});
test('scope, service/method or configuration replacement and current denial suppress results without leaking private errors', async () => {
  for (const mode of ['scope', 'method', 'service', 'configuration', 'authority'] as const) {
    const f = intentJourneyFixture(); let entered = 0, allowed = true;
    f.services.intentDrafts.read = async () => { entered++; return null; };
    const managed = manageIntentJourney(f.configuration, f.owned, async () => { if (!allowed) throw new Error('PRIVATE revoked'); });
    if (mode === 'scope') (f.services.intentDrafts.scope as any).subject = 'foreign';
    if (mode === 'method') f.services.intentDrafts.read = async () => null;
    if (mode === 'service') (f.services as any).intentDrafts = { ...f.services.intentDrafts };
    if (mode === 'configuration') (f.owned.configuration as any).configurationRevision = 'other';
    if (mode === 'authority') allowed = false;
    await assert.rejects(managed.services.intentDrafts.read({} as any, current), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; });
    assert.equal(entered, 0); await managed.shutdown();
  }
});
test('late authority loss withholds acknowledgement while preserving the completed underlying effect', async () => {
  const f = intentJourneyFixture(); let writes = 0, allowed = true;
  f.services.intentDrafts.create = async () => { writes++; allowed = false; return { outcome: 'unknown', savedToGit: false }; };
  const managed = manageIntentJourney(f.configuration, f.owned, async () => { if (!allowed) throw new Error('PRIVATE late denial'); });
  await assert.rejects(managed.services.intentDrafts.create({} as any, current)); assert.equal(writes, 1); await managed.shutdown();
});
test('shutdown drains admitted calls and their current authorization before disposing owned resources', async () => {
  const f = intentJourneyFixture(); let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  f.services.intentDrafts.read = async (_input, revalidate) => { entered(); await held; await revalidate(); return null; };
  const managed = manageIntentJourney(f.configuration, f.owned, current), read = managed.services.intentDrafts.read({} as any, current);
  await started; const stop = managed.shutdown(); await Promise.resolve(); assert.equal(f.state.closed, 0);
  await assert.rejects(managed.services.intentDrafts.read({} as any, current)); release(); assert.equal(await read, null);
  await stop; assert.equal(f.state.closed, 1);
});
test('timed-out authorities hold the four shared admissions until actual drain, including shutdown', async t => {
  const f = intentJourneyFixture(); let release!: () => void, entered = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const managed = manageIntentJourney(f.configuration, f.owned, async () => { entered++; await held; });
  const pending = Array.from({ length: 4 }, () => assert.rejects(managed.services.intentDrafts.read({} as any, current)));
  for (let i = 0; i < 20 && entered < 4; i++) await Promise.resolve(); assert.equal(entered, 4);
  t.mock.timers.tick(5001); await Promise.all(pending);
  await assert.rejects(managed.services.intentDrafts.read({} as any, current)); assert.equal(entered, 4);
  const stop = managed.shutdown(); await Promise.resolve(); assert.equal(f.state.closed, 0);
  release(); await stop; assert.equal(f.state.closed, 1); assert.deepEqual(f.state.calls, []);
});
test('timed-out service work cannot restore acknowledgement or bypass the final current check after shutdown', async t => {
  const f = intentJourneyFixture(); let entered!: () => void, release!: () => void, late = 0;
  const started = new Promise<void>(resolve => { entered = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  f.services.intentDrafts.read = async (_input, revalidate) => { entered(); await held; await revalidate(); late++; return null; };
  t.mock.timers.enable({ apis: ['setTimeout'] }); const managed = manageIntentJourney(f.configuration, f.owned, current);
  const read = assert.rejects(managed.services.intentDrafts.read({} as any, current)); await started;
  t.mock.timers.tick(120001); await read; const stop = managed.shutdown(); await Promise.resolve(); assert.equal(f.state.closed, 0);
  release(); await stop; assert.equal(late, 0); assert.equal(f.state.closed, 1);
});
