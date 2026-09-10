import assert from 'node:assert/strict';
import { createVerifiedDevelopmentHistoryReader, createVerifiedScopeReviewHistoryReader } from '../src/runtime.ts';
import { ownedDevelopmentReadFixture, ownedScopeReadFixture } from './owned-scope-read.fixture.ts';

type Dependencies = Parameters<typeof createVerifiedDevelopmentHistoryReader>[2];
type Binding = NonNullable<Dependencies['ownedRead']>;
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const deferred = () => { let resolve = () => {}; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };

/** Real native SQL and canonical SDK data from the joined application fixture.
 * The grants and provider remain synthetic; this never grants live authority. */
export async function testOwnedDevelopmentHistoryProjection(
  pools: Parameters<typeof createVerifiedDevelopmentHistoryReader>[0], config: unknown,
  deps: Dependencies & { ownedRead: Binding }, input: Parameters<ReturnType<typeof createVerifiedDevelopmentHistoryReader>['read']>[0], expected: unknown,
) {
  const key = deps.records.originals.keyForDraft;
  // The budget is the fixture authority's value, independently re-granted on
  // every read; never inferred from the corpus grant or a browser field.
  const parsed = input as { operationId: string; inputDigest: string };
  const discovery = await deps.ownedRead.authority.authorizeDevelopmentDiscovery({
    configuration: config as Parameters<Binding['authority']['authorizeDevelopmentDiscovery']>[0]['configuration'],
    request: { kind: 'development-history', operationId: parsed.operationId, inputDigest: parsed.inputDigest },
  });
  const make = () => {
    const development = ownedDevelopmentReadFixture(discovery.budgetId, key);
    const scope = ownedScopeReadFixture(discovery.budgetId, deps.ownedRead.scope.records.originals.keyForDraft);
    const records: Dependencies['records'] = { ...deps.records, originals: { ...deps.records.originals }, results: { ...deps.records.results } };
    const binding: Binding = { ...development, scope: { ...deps.ownedRead.scope,
      records: { ...deps.ownedRead.scope.records, originals: { ...deps.ownedRead.scope.records.originals } }, ownedRead: scope } };
    return { development, scope, records, binding, open: () => createVerifiedDevelopmentHistoryReader(pools, config,
      { records, profiles: deps.profiles, ownedRead: binding }) };
  };
  const historicalScope = createVerifiedScopeReviewHistoryReader(pools, config,
    { records: deps.ownedRead.scope.records, profile: deps.ownedRead.scope.profile });
  const legacy = createVerifiedDevelopmentHistoryReader(pools, config, { records: { ...deps.records,
    originals: { ...deps.records.originals, scopeHistory: historicalScope } }, profiles: deps.profiles });
  try { assert.deepEqual(await legacy.read(input, async () => {}), expected); }
  finally { legacy.close(); historicalScope.close(); }
  const baseline = make(), normal = baseline.open();
  try { assert.deepEqual(await normal.read(input, async () => {}), expected);
    assert.ok(baseline.development.state.discovery > 0); assert.ok(baseline.scope.state.discovery > 0);
    assert.equal(baseline.development.state.reads, 2); assert.equal(baseline.scope.state.reads, 2);
  } finally { await normal.shutdown!(); }
  const phase = make(), phaseReader = phase.open(); let escaped: (() => Promise<unknown>) | undefined;
  try {
    const value = await phaseReader.withGenerationRead!(input, async () => {}, async read => {
      escaped = read; const first = await read(), second = await read();
      assert.deepEqual(first, second); assert.deepEqual(first.history, expected);
      assert.equal(first.retained.original.source.draftId, first.history.source.draftId);
      assert.equal(first.retained.latestDraftRevision, first.history.source.latestRevision);
      assert.equal(phase.development.state.reads, 1); assert.equal(phase.scope.state.reads, 1);
      return first.history;
    });
    assert.deepEqual(value, expected); assert.equal(phase.development.state.reads, 2); assert.equal(phase.scope.state.reads, 2);
    await assert.rejects(escaped!()); assert.deepEqual(await phaseReader.read(input, async () => {}), expected);
  } finally { await phaseReader.shutdown!(); }
  for (const failure of ['development-record', 'scope-record', 'development-key', 'scope-key', 'development-revision',
    'scope-revision', 'source', 'scope-source', 'parallel', 'unconsumed', 'close'] as const) {
    const f = make(); let revoked = false;
    f.records.originals.authorizeOriginal = async () => { if (revoked && failure === 'source') throw new Error('PRIVATE late original policy loss'); };
    f.binding.scope.records.originals.authorizeOriginal = async () => { if (revoked && failure === 'scope-source') throw new Error('PRIVATE late scope policy loss'); };
    const owned = f.open();
    try {
      await assert.rejects(owned.withGenerationRead!(input, async () => {}, async read => {
        if (failure === 'unconsumed') return 'no read';
        if (failure === 'parallel') { const first = read(), second = read(); await Promise.all([assert.rejects(first), assert.rejects(second)]); return 'caught errors'; }
        await read(); revoked = true;
        if (failure === 'development-record') f.development.state.deniedRecord = 'development_results';
        if (failure === 'scope-record') f.scope.state.deniedRecord = 'scope_originals';
        if (failure === 'development-key') f.development.state.deniedKey = 'development_originals';
        if (failure === 'scope-key') f.scope.state.deniedKey = 'scope_observations';
        if (failure === 'development-revision') f.development.state.revision = 'changed-after-consumer';
        if (failure === 'scope-revision') f.scope.state.revision = 'changed-after-consumer';
        if (failure === 'close') owned.close();
        return 'must be withheld after dependent work';
      }), { message: 'Development history is unavailable.' });
    } finally { await owned.shutdown!(); }
  }
  const forgotten = make(), forgottenReader = forgotten.open(), gateRead = deferred(), readEntered = deferred();
  let holdCurrent = false, finished = false;
  const pendingPhase = forgottenReader.withGenerationRead!(input, async () => {
    if (holdCurrent) { readEntered.resolve(); await gateRead.promise; }
  }, async read => { holdCurrent = true; void read().catch(() => {}); return 'forgotten pending read'; });
  const phaseRejected = assert.rejects(pendingPhase).then(() => { finished = true; });
  try {
    await readEntered.promise; forgottenReader.close(); await tick(); assert.equal(finished, false);
    gateRead.resolve(); await phaseRejected; assert.equal(finished, true);
  } finally { gateRead.resolve(); await phaseRejected; await forgottenReader.shutdown!(); }
  console.log('PASS owned generation phase: one shared original/history, fresh per-read policy, final dependent-work closure, escaped/parallel/unconsumed denial and forgotten-read drain');
  for (const change of [
    (f: ReturnType<typeof make>) => { f.development.state.deniedRecord = 'development_originals'; },
    (f: ReturnType<typeof make>) => { f.development.state.deniedKey = 'development_results'; },
    (f: ReturnType<typeof make>) => { f.scope.state.deniedRecord = 'scope_observations'; },
    (f: ReturnType<typeof make>) => { f.scope.state.deniedKey = 'scope_originals'; },
    (f: ReturnType<typeof make>) => { f.records.originals.authorizeOriginal = async () => { throw new Error('PRIVATE development source revoked'); }; },
    (f: ReturnType<typeof make>) => { f.binding.scope.records.originals.authorizeOriginal = async () => { throw new Error('PRIVATE scope source revoked'); }; },
    (f: ReturnType<typeof make>) => { f.records.results.authorizeHistoricalResult = async () => { throw new Error('PRIVATE result policy revoked'); }; },
    (f: ReturnType<typeof make>) => { f.binding.scope.profile = { ...(f.binding.scope.profile as object), modelRoute: 'different-model' }; },
    (f: ReturnType<typeof make>) => { const grant = f.records.originals.authorizeOriginal; let calls = 0;
      f.records.originals.authorizeOriginal = async context => { await grant(context);
        if (++calls === 2) f.development.state.revision = 'late-revocation'; }; },
    (f: ReturnType<typeof make>) => { const grant = f.records.originals.authorizeOriginal; let calls = 0;
      f.records.originals.authorizeOriginal = async context => { await grant(context);
        if (++calls === 2) f.scope.state.revision = 'late-scope-revocation'; }; },
    (f: ReturnType<typeof make>) => { let revoked = false, calls = 0;
      f.records.originals.authorizeOriginal = async () => { if (++calls === 2) revoked = true; };
      f.binding.scope.records.originals.authorizeOriginal = async () => { if (revoked) throw new Error('PRIVATE late scope source loss'); }; },
  ]) {
    const f = make(); change(f); const reader = f.open();
    try { await assert.rejects(reader.read(input, async () => {}), { message: 'Development history is unavailable.' }); }
    finally { await reader.shutdown!(); }
  }
  // Parent shutdown cannot finish when its nested scope key provider has not
  // settled, even though both public read results already reject on close.
  const held = make(), gate = deferred(), entered = deferred();
  const provider = held.scope.keys.scope_originals.provider, originalLookup = provider.keyForDraft;
  provider.keyForDraft = async (...args) => { entered.resolve(); await gate.promise; return originalLookup.apply(provider, args); };
  const reader = held.open(), rejection = assert.rejects(reader.read(input, async () => {})); let drained = false;
  try {
    await entered.promise; reader.close(); await rejection;
    const stop = reader.shutdown!().then(() => { drained = true; }); await tick(); assert.equal(drained, false);
    gate.resolve(); await stop; assert.equal(drained, true);
  } finally { gate.resolve(); await reader.shutdown!(); await rejection; }
  console.log('PASS owned development history: exact legacy DTO and separate scope/development grants, late revocation, profile binding and nested-key shutdown drain');
}
