import assert from 'node:assert/strict';
import { createDevelopmentOriginalStore } from '@steer/data/development-originals';
import type { IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';
import { createRecordedDevelopmentStarter, createVerifiedScopeReviewReader, type createVerifiedDevelopmentHistoryReader } from '../src/runtime.ts';
import { ownedDevelopmentOriginalFixture, ownedScopeReadFixture } from './owned-scope-read.fixture.ts';

type Dependencies = Parameters<typeof createVerifiedDevelopmentHistoryReader>[2];
/** Actual complete scope and original from the joined native fixture. Synthetic
 * grants/scheduler only; no new records, dispatch, reservation or live authority. */
export async function testOwnedDevelopmentStartClosure(pools: Parameters<typeof createRecordedDevelopmentStarter>[0], config: unknown,
  deps: Dependencies & { ownedRead: NonNullable<Dependencies['ownedRead']> },
  target: Parameters<ReturnType<typeof createVerifiedDevelopmentHistoryReader>['read']>[0]) {
  const s = deps.ownedRead.scope, key = deps.records.originals.keyForDraft;
  const discovery = await deps.ownedRead.authority.authorizeDevelopmentDiscovery({
    configuration: config as Parameters<NonNullable<Dependencies['ownedRead']>['authority']['authorizeDevelopmentDiscovery']>[0]['configuration'],
    request: { kind: 'development-history', operationId: target.operationId, inputDigest: target.inputDigest },
  });
  const scopeService = () => {
    const binding = ownedScopeReadFixture(discovery.budgetId, s.records.originals.keyForDraft);
    return { binding, service: createVerifiedScopeReviewReader(pools, config,
      { records: s.records, profile: s.profile, ownedRead: { ...binding, profiles: deps.profiles } }) };
  };
  const baseline = scopeService(), originals = createDevelopmentOriginalStore(pools, config,
    { ...deps.records.originals, scopeReview: baseline.service });
  const retained = await originals.read({ operationId: target.operationId, inputDigest: target.inputDigest });
  originals.close(); baseline.service.close();
  assert.equal(retained.original.direction.scopeReview?.kind, 'recorded');
  const input = { ...target, draftId: retained.original.source.draftId, revision: retained.original.source.revision,
    revisionDigest: retained.original.source.revisionDigest };
  for (const failure of ['none', 'scope-record', 'key-after-final-scope', 'record-after-final-scope', 'historical-final-scope',
    'scope-after-draft-key', 'key-after-last-scope', 'record-after-last-scope']) {
    const scope = scopeService(); let keyReads = 0;
    const development = ownedDevelopmentOriginalFixture(discovery.budgetId, async (...args) => {
      const value = await key(...args); keyReads++;
      if (keyReads === 2 && failure === 'scope-after-draft-key') scope.binding.state.deniedRecord = 'scope_observations';
      return value;
    });
    let scopeReads = 0, schedules = 0;
    const reader: IntentScopeReader = { scope: scope.service.scope, async read(input, current) {
      const value = await scope.service.read(input, current); scopeReads++;
      if (scopeReads === 2) {
        if (failure === 'key-after-final-scope') development.state.deniedKey = 'development_originals';
        if (failure === 'record-after-final-scope') development.state.deniedRecord = 'development_originals';
        if (failure === 'historical-final-scope') return { ...value, kind: 'steer-scope-review-history/v1', historical: true };
      }
      if (scopeReads === 3) {
        if (failure === 'key-after-last-scope') development.state.deniedKey = 'development_originals';
        if (failure === 'record-after-last-scope') development.state.deniedRecord = 'development_originals';
      }
      return value;
    } };
    const starter = createRecordedDevelopmentStarter(pools, config, { records: { ...deps.records.originals, scopeReview: reader },
      profiles: retained.original.profiles, ownedRead: development,
      authorizeStart: async () => { if (failure === 'scope-record') scope.binding.state.deniedRecord = 'scope_observations'; },
      scheduler: { start: async (_input, current) => { await current(); schedules++; return { outcome: 'unknown' }; } },
    });
    try {
      if (failure === 'none') {
        const result = await starter.start(input, async () => {}); assert.equal(result.documentsReady, false);
        assert.equal(schedules, 1); assert.equal(scopeReads, 9); assert.equal(development.state.reads, 6);
      } else { await assert.rejects(starter.start(input, async () => {})); assert.equal(schedules, 0);
        if (failure !== 'scope-record') assert.equal(scopeReads, failure.endsWith('last-scope') ? 3 : 2); }
    } finally { starter.close(); scope.service.close(); if ('shutdown' in starter) await starter.shutdown(); }
  }
  console.log('PASS owned drafting-start closure: current scope reopens after final development records/keys with fresh purpose grants; cross-boundary scope/record/key loss and historical scope deny before scheduling');
}
