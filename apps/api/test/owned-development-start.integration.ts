import assert from 'node:assert/strict';
import { createDevelopmentOriginalStore } from '@steer/data/development-originals';
import { createIntentDevelopmentStarter } from '@steer/data/intent-development-starter';
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
  for (const failure of ['none', 'scope-record', 'key-after-initial-scope', 'record-after-initial-scope', 'historical-final-scope',
    'scope-after-draft-key', 'key-after-last-scope', 'record-after-last-scope', 'changed-final-source',
    'foreign-final-subject', 'expired-final-scope']) {
    const scope = scopeService(); let keyReads = 0;
    const development = ownedDevelopmentOriginalFixture(discovery.budgetId, async (...args) => {
      const value = await key(...args); keyReads++;
      if (keyReads === 2 && failure === 'scope-after-draft-key') scope.binding.state.deniedRecord = 'scope_observations';
      return value;
    });
    let scopeReads = 0, schedules = 0;
    const reader: IntentScopeReader = { scope: scope.service.scope, async read(input, current) {
      const value = await scope.service.read(input, current); scopeReads++;
      if (scopeReads === 1) {
        if (failure === 'key-after-initial-scope') development.state.deniedKey = 'development_originals';
        if (failure === 'record-after-initial-scope') development.state.deniedRecord = 'development_originals';
      }
      if (scopeReads === 2) {
        if (failure === 'historical-final-scope') return { ...value, kind: 'steer-scope-review-history/v1', historical: true };
        if (failure === 'changed-final-source') return { ...value, source: { ...value.source, revisionDigest: 'f'.repeat(64) } };
        if (failure === 'foreign-final-subject') return { ...value, subject: 'foreign-human' };
        if (failure === 'expired-final-scope') return { ...value, status: 'expired', review: null, batches: null };
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
        assert.equal(schedules, 1); assert.equal(scopeReads, 6); assert.equal(development.state.reads, 6);
      } else { await assert.rejects(starter.start(input, async () => {})); assert.equal(schedules, 0);
        if (failure !== 'scope-record') assert.equal(scopeReads,
          failure.endsWith('last-scope') || failure.includes('final-') ? 2 : 1); }
    } finally { starter.close(); scope.service.close(); if ('shutdown' in starter) await starter.shutdown(); }
  }
  // The data owner still verifies current scope for every original consumed from
  // the trusted hook; a missing/foreign/history port is not a shortcut around it.
  for (const kind of ['missing', 'foreign', 'history']) {
    const scope = scopeService(); let schedules = 0;
    const supplied: IntentScopeReader | undefined = kind === 'missing' ? undefined : {
      scope: { ...scope.service.scope, ...(kind === 'foreign' ? { subject: 'foreign-human' } : {}) },
      async read(input, current) { const result = await scope.service.read(input, current);
        return kind === 'history' ? { ...result, kind: 'steer-scope-review-history/v1', historical: true } : result; },
    };
    const starter = createIntentDevelopmentStarter(pools, config, { records: { ...deps.records.originals, scopeReview: scope.service },
      authorizeStart: async () => {}, scheduler: { start: async () => { schedules++; return { outcome: 'unknown' }; } },
      withOriginalRead: async (_input, _current, work) => { await work(async () => retained, supplied); },
    });
    try { await assert.rejects(starter.start(input, async () => {})); assert.equal(schedules, 0); }
    finally { starter.close(); scope.service.close(); }
  }
  // Closing during actual final scope work must not release development ownership
  // until that read drains, even though development keys have already rechecked.
  {
    const scope = scopeService(), development = ownedDevelopmentOriginalFixture(discovery.budgetId, key);
    let reads = 0, schedules = 0, stopped = false, release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
    const reader: IntentScopeReader = { scope: scope.service.scope, async read(input, current) {
      const result = await scope.service.read(input, current); reads++;
      if (reads === 2) { entered(); await held; } return result;
    } };
    const starter = createRecordedDevelopmentStarter(pools, config, { records: { ...deps.records.originals, scopeReview: reader },
      profiles: retained.original.profiles, ownedRead: development, authorizeStart: async () => {},
      scheduler: { start: async () => { schedules++; return { outcome: 'unknown' }; } },
    });
    const result = assert.rejects(starter.start(input, async () => {}));
    try {
      await reached; assert.equal(development.state.reads, 2);
      if (!('shutdown' in starter)) throw new Error('Owned starter needs drainage');
      const stop = starter.shutdown().then(() => { stopped = true; });
      await new Promise(resolve => setImmediate(resolve)); assert.equal(stopped, false);
      release(); await stop; await result; assert.equal(stopped, true); assert.equal(schedules, 0);
    } finally { release(); starter.close(); scope.service.close(); }
  }
  console.log('PASS owned drafting-start closure: two full current scope reads per phase with the final read after development records/keys under fresh purpose grants; cross-boundary scope/record/key loss and historical scope deny before scheduling');
  // Exact constructed current readers, not the wrappers above, can keep a scope
  // content lease around the original phase. This must halve physical scope-key
  // lookups while preserving final native comparison and cross-purpose denial.
  for (const failure of ['none', 'scope-record', 'scope-key', 'scope-revision', 'development-record',
    'development-key', 'rotated-scope-key', 'source', 'caller', 'method']) {
    let scopeKeys = 0, developmentKeys = 0, schedules = 0, sourceAllowed = true, callerAllowed = true;
    let development: ReturnType<typeof ownedDevelopmentOriginalFixture>;
    const scopeBinding = ownedScopeReadFixture(discovery.budgetId, async (...args) => {
      const value = await s.records.originals.keyForDraft(...args); scopeKeys++;
      if (scopeKeys === 2) {
        assert.equal(developmentKeys, 2, 'Final scope key lookup follows development records/key comparison');
        if (failure === 'development-record') development.state.deniedRecord = 'development_originals';
        if (failure === 'development-key') development.state.deniedKey = 'development_originals';
        if (failure === 'rotated-scope-key') return { ...value, bytes: new Uint8Array(32) };
      }
      return value;
    });
    const sourceRecords = { ...s.records, originals: { ...s.records.originals, authorizeOriginal: async (context: Parameters<typeof s.records.originals.authorizeOriginal>[0]) => {
      if (!sourceAllowed) throw new Error('PRIVATE revoked scope source'); return s.records.originals.authorizeOriginal(context);
    } } };
    const scope = createVerifiedScopeReviewReader(pools, config, { records: sourceRecords, profile: s.profile,
      ownedRead: { ...scopeBinding, profiles: deps.profiles } });
    development = ownedDevelopmentOriginalFixture(discovery.budgetId, async (...args) => {
      const value = await key(...args); developmentKeys++;
      if (developmentKeys === 2) {
        if (failure === 'scope-record') scopeBinding.state.deniedRecord = 'scope_observations';
        if (failure === 'scope-key') scopeBinding.state.deniedKey = 'scope_observations';
        if (failure === 'scope-revision') scopeBinding.state.revision = 'synthetic-changed';
        if (failure === 'source') sourceAllowed = false;
      }
      return value;
    });
    const starter = createRecordedDevelopmentStarter(pools, config, { records: { ...deps.records.originals, scopeReview: scope },
      profiles: retained.original.profiles, ownedRead: development,
      authorizeStart: async () => { if (failure === 'caller') callerAllowed = false;
        if (failure === 'method') scope.read = async () => { throw new Error('Replaced scope port must not run'); }; },
      scheduler: { start: async (_input, current) => { await current(); schedules++; return { outcome: 'unknown' }; } },
    });
    try {
      const current = async () => { if (!callerAllowed) throw new Error('PRIVATE caller'); };
      if (failure === 'none') {
        const result = await starter.start(input, current); assert.equal(result.documentsReady, false);
        assert.equal(schedules, 1); assert.equal(scopeKeys, 6); assert.equal(developmentKeys, 6);
      } else { await assert.rejects(starter.start(input, current)); assert.equal(schedules, 0); }
    } finally { starter.close(); scope.close(); if ('shutdown' in starter) await starter.shutdown(); if ('shutdown' in scope) await scope.shutdown(); }
  }
  {
    let scopeKeys = 0, schedules = 0, stopped = false, release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
    const scopeBinding = ownedScopeReadFixture(discovery.budgetId, async (...args) => {
      const value = await s.records.originals.keyForDraft(...args); if (++scopeKeys === 2) { entered(); await held; } return value;
    });
    const scope = createVerifiedScopeReviewReader(pools, config, { records: s.records, profile: s.profile,
      ownedRead: { ...scopeBinding, profiles: deps.profiles } });
    const development = ownedDevelopmentOriginalFixture(discovery.budgetId, key);
    const starter = createRecordedDevelopmentStarter(pools, config, { records: { ...deps.records.originals, scopeReview: scope },
      profiles: retained.original.profiles, ownedRead: development, authorizeStart: async () => {},
      scheduler: { start: async () => { schedules++; return { outcome: 'unknown' }; } },
    });
    const result = assert.rejects(starter.start(input, async () => {}));
    try {
      await reached; assert.equal(development.state.reads, 2);
      if (!('shutdown' in starter)) throw new Error('Owned starter needs drainage');
      const stop = starter.shutdown().then(() => { stopped = true; });
      await new Promise(resolve => setImmediate(resolve)); assert.equal(stopped, false);
      scope.close(); // An early scope result rejection must still drain its held key.
      await new Promise(resolve => setImmediate(resolve)); assert.equal(stopped, false);
      release(); await stop; await result; assert.equal(stopped, true); assert.equal(schedules, 0);
    } finally { release(); starter.close(); scope.close(); if ('shutdown' in scope) await scope.shutdown(); }
  }
  console.log('PASS owned current-scope projection: one native scope content lease per drafting phase, six physical scope/development key reads across three phases, final scope comparison after development, nine late-denial cases and actual held final scope-key drain');
}
