import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitHubReader } from '@steer/adapters/github';
import { createCorpusReadGraph, type CorpusGraphSnapshot } from '../../../packages/adapters/src/code-host/corpus-read-graph.ts';
import { corpusBatchPrototypeFixture } from './corpus-batch-prototype.fixture.ts';
import { now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import type { IntentCorpusAuthority } from '../../../packages/adapters/src/code-host/intent-corpus-evidence.ts';

async function setup(t: { after(run: () => void): void }, custom?: (f: Awaited<ReturnType<typeof corpusBatchPrototypeFixture>>) => IntentCorpusAuthority,
  monotonicNow?: () => number) {
  const f = await corpusBatchPrototypeFixture(t, { nativeBatch: true });
  const reader = createGitHubReader(f.binding, { appJwt: async () => 'synthetic-app-jwt', now: () => now, fetch: f.repository });
  const scope = { organizationId: f.evidence.organizationId, productId: f.evidence.productId, repository: f.evidence.repository, branch: f.binding.branch };
  const authority = custom?.(f) ?? f.authority;
  const graph = createCorpusReadGraph(reader, scope, authority, monotonicNow ? { monotonicNow } : {});
  t.after(() => graph.shutdown());
  return { ...f, reader, scope, graph, graphAuthority: authority };
}
const error = { message: 'The complete corpus graph could not be verified; this does not establish new intent.' };
const returnGraph = async (snapshot: CorpusGraphSnapshot) => snapshot;

test('actual native reader graph preserves 34 semantic sources at two revisions, including candidate and amendment dependencies', async t => {
  const f = await setup(t), first = f.native.git.head();
  f.native.git.add([{ path: 'graph-control.md', content: 'new revision, same original sources\n' }]); const second = f.native.git.head();
  const identity = createGitHubReader(f.binding, { appJwt: async () => 'synthetic-app-jwt', now: () => now, fetch: f.repository });
  let callerChecks = 0, used = false;
  const current = async () => { callerChecks++; await identity.readHead(); };
  const result = await f.graph.withReadSet([first, second], current, async snapshot => {
    used = true; assert.ok(Object.isFrozen(snapshot)); assert.ok(Object.isFrozen(snapshot.contexts));
    assert.equal(snapshot.observedHead, second); return snapshot;
  });
  assert.equal(used, true); assert.equal(result.contexts.length, 2);
  assert.deepEqual(result.scope, f.scope); assert.equal(result.authoritativeClearance, false);
  for (const context of result.contexts) {
    assert.ok(Object.isFrozen(context)); assert.equal(context.files.length, 42); assert.equal(context.semantic.length, 34);
    for (const source of f.evidence.inventory) {
      const actual = context.semantic.find(s => s.path === source.path)!;
      assert.equal(actual.contentDigest, source.contentDigest); assert.equal(actual.blobSha, source.blobOid);
      assert.equal(actual.status, source.status); assert.equal(actual.revision, context.revision);
      assert.equal(actual.content, f.evidence.documents.find(d => d.sourceId === source.sourceId)!.content);
    }
  }
  assert.deepEqual(f.queries, [16, 16, 2, 2, 6]); assert.equal(f.grants.length, 252); assert.equal(callerChecks, 19);
  assert.equal(f.wire.length, 32); assert.equal(f.native.git.mutations(), 0);
  console.log('Native corpus graph component: '+JSON.stringify({revisions:2,semanticSourcesPerRevision:34,physicalPathsPerRevision:42,
    sourcePolicyCalls:f.grants.length,callerChecks,allSimulatedProviderAttempts:f.wire.length,queryAliases:f.queries,
    currentCaller:'native Git head stand-in, not OIDC or HTTP',sourcePolicy:'synthetic',wholeActionAccepted:false,factoryInstalled:false}));
  f.native.git.add([{ path: 'items/0003-existing/BRIEF.md', content: '\ufeff# Changed current bytes 🌸\r\n\n' }]);
  const next = await f.graph.withReadSet([first, f.native.git.head()], async () => {}, returnGraph);
  assert.notEqual(next.contexts[0]!.semantic.find(s => s.path === 'items/0003-existing/BRIEF.md')!.content,
    next.contexts[1]!.semantic.find(s => s.path === 'items/0003-existing/BRIEF.md')!.content);
});

test('each revision needs its own grant even when all immutable source objects match', async t => {
  let forbidden = '';
  const f = await setup(t, f => ({ ...f.authority, authorizeSource: async ref => {
    if (ref.revision === forbidden) throw new Error('sensitive denial'); await f.authority.authorizeSource(ref);
  } }));
  const first = f.native.git.head(); forbidden = f.native.git.add([{ path: 'different-revision.md', content: 'same corpus' }]);
  let used = false;
  await assert.rejects(f.graph.withReadSet([first, forbidden], async () => {}, async () => { used = true; }), error);
  assert.equal(used, false); assert.deepEqual(f.queries, []);
});

test('dependent readback precedes final source, selection, all-grants and head closure', async t => {
  for (const mode of ['source', 'selection', 'grants', 'head', 'abort', 'reader-port', 'policy-port', 'callback-error']) {
    const f = await setup(t); let reached = false; const controller = new AbortController();
    const first = f.native.git.head();
    await assert.rejects(f.graph.withReadSet([first], async () => {}, async snapshot => {
      assert.equal(snapshot.contexts[0]!.files.length, 42); reached = true;
      if (mode === 'source') f.state.source = false;
      if (mode === 'selection') { const select = f.graphAuthority.select; f.graphAuthority.select = async ref => ({ ...await select(ref) as object, authorityDigest: 'f'.repeat(64) }); }
      if (mode === 'grants') f.state.revision = 'changed';
      if (mode === 'head') f.native.git.add([{ path: 'changed-after-records.md', content: 'changed' }]);
      if (mode === 'abort') controller.abort();
      if (mode === 'reader-port') { const readHead = f.reader.readHead; f.reader.readHead = () => readHead(); }
      if (mode === 'policy-port') f.graphAuthority.authorizeSource = async () => {};
      if (mode === 'callback-error') throw new Error('sensitive callback failure');
      return 'must never escape';
    }, controller.signal), error);
    assert.equal(reached, true, mode);
  }
});

test('late selection changes through an unchanged method are detected after dependent readback', async t => {
  let changed = false, lateChecks = 0;
  const f = await setup(t, f => ({ ...f.authority, select: async ref => {
    const original = await f.authority.select(ref);
    if (changed) { lateChecks++; return { ...original as object, authorityDigest: 'f'.repeat(64) }; } return original;
  } }));
  await assert.rejects(f.graph.withReadSet([f.native.git.head()], async () => {}, async () => { changed = true; }), error);
  assert.equal(lateChecks, 1);
});

test('inaccessible/unresolved/malformed selection cannot become an empty successful corpus; explicit out-of-product may exclude', async t => {
  let selection = 'inaccessible';
  const f = await setup(t, f => ({ ...f.authority, select: async ref => ({ ...ref, selection, authorityDigest: 'a'.repeat(64) }) }));
  for (const value of ['inaccessible', 'unresolved', 'unexpected']) {
    selection = value;
    await assert.rejects(f.graph.withReadSet([f.native.git.head()], async () => {}, returnGraph), error);
    assert.deepEqual(f.queries, []);
  }
  selection = 'out-of-product';
  const result = await f.graph.withReadSet([f.native.git.head()], async () => {}, returnGraph);
  assert.deepEqual(result.contexts[0]!.files, []); assert.deepEqual(f.queries, []);
});

test('missing root documents and malformed/nonregular proposal entries reject before content dispatch', async t => {
  for (const mode of ['missing', 'proposal-name', 'proposal-directory', 'symlink']) {
    const f = await setup(t);
    const change = mode === 'missing' ? { path: 'items/0003-existing/SPEC.md', content: null }
      : mode === 'proposal-name' ? { path: 'items/0003-existing/proposals/not-a-uuid.json', content: '{}' }
      : mode === 'proposal-directory' ? { path: 'items/0003-existing/proposals', content: 'not a directory' }
      : { path: 'items/0003-existing/BRIEF.md', content: 'SPEC.md', mode: '120000' };
    const revision = f.native.git.add([change]);
    await assert.rejects(f.graph.withReadSet([revision], async () => {}, returnGraph), error);
    assert.deepEqual(f.queries, [], mode);
  }
});

test('corrupt pointer/manifest/document evidence and changed candidate root Brief cannot reach dependent work', async t => {
  for (const mode of ['pointer', 'manifest', 'document', 'root-brief']) {
    const f = await setup(t);
    const baseline = await f.graph.withReadSet([f.native.git.head()], async () => {}, returnGraph);
    const files = baseline.contexts[0]!.files;
    const pointer = files.find(file => file.path.endsWith('/CANDIDATE.json'))!;
    const manifest = files.find(file => file.path.endsWith('/MANIFEST.json'))!;
    const document = files.find(file => /\/candidates\/.+\/EXAM.md$/.test(file.path))!;
    const path = mode === 'pointer' ? pointer.path : mode === 'manifest' ? manifest.path : mode === 'document' ? document.path
      : pointer.path.replace(/CANDIDATE.json$/, 'BRIEF.md');
    const revision = f.native.git.add([{ path, content: '# substituted evidence\n' }]); let used = false;
    await assert.rejects(f.graph.withReadSet([revision], async () => {}, async () => { used = true; }), error);
    assert.equal(used, false, mode);
  }
});

test('four cancelled calls retain admission until held authority work drains; close/shutdown do not leak late IO', async t => {
  let release!: () => void, entered = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  const f = await setup(t, f => ({ ...f.authority, authorize: async () => { entered++; await held; return f.authority.authorize(); } }));
  try {
    const controllers = Array.from({ length: 4 }, () => new AbortController());
    const rejected = controllers.map(controller => assert.rejects(f.graph.withReadSet([f.native.git.head()], async () => {}, returnGraph, controller.signal), error));
    for (let i = 0; i < 10 && entered < 4; i++) await Promise.resolve();
    assert.equal(entered, 4);
    await assert.rejects(f.graph.withReadSet([f.native.git.head()], async () => {}, returnGraph), error);
    controllers.forEach(controller => controller.abort()); await Promise.all(rejected);
    await assert.rejects(f.graph.withReadSet([f.native.git.head()], async () => {}, returnGraph), error); assert.equal(entered, 4);
    let stopped = false; const stopping = f.graph.shutdown().then(() => { stopped = true; });
    await Promise.resolve(); assert.equal(stopped, false); release(); await stopping;
    assert.equal(stopped, true); assert.deepEqual(f.wire, []);
  } finally { release(); }
});

test('close promptly rejects a held dependent callback, and shutdown waits for that exact callback', async t => {
  const f = await setup(t); let entered!: () => void, release!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  try {
    const rejected = assert.rejects(f.graph.withReadSet([f.native.git.head()], async () => {}, async () => { entered(); await held; return 'late'; }), error);
    await ready; f.graph.close(); await rejected; let stopped = false;
    const stopping = f.graph.shutdown().then(() => { stopped = true; }); await Promise.resolve(); assert.equal(stopped, false);
    const queries = f.queries.length; release(); await stopping; assert.equal(f.queries.length, queries);
  } finally { release(); }
});

test('invalid, backwards or expired monotonic lifetime denies return; invalid revisions deny before IO', async t => {
  let clock = 100;
  const f = await setup(t, undefined, () => clock), revision = f.native.git.head();
  for (const revisions of [[], ['HEAD'], [revision, revision], Array.from({ length: 5 }, () => revision)])
    await assert.rejects(f.graph.withReadSet(revisions, async () => {}, returnGraph));
  assert.deepEqual(f.wire, []);
  for (const value of [NaN, Infinity, 99, 30100]) {
    clock = 100;
    await assert.rejects(f.graph.withReadSet([revision], async () => {}, async () => { clock = value; }), error);
  }
  clock = 100;
  assert.equal((await f.graph.withReadSet([revision], async () => {}, returnGraph)).contexts[0]!.semantic.length, 34);
});

test('four revisions partition reference waves without dropping paths; over-limit consumed source sets deny', async t => {
  const f = await setup(t), revisions = [f.native.git.head()];
  for (let i = 0; i < 3; i++) revisions.push(f.native.git.add([{ path: 'four-revisions.md', content: `revision ${i}` }]));
  const result = await f.graph.withReadSet(revisions, async () => {}, returnGraph);
  assert.equal(result.contexts.length, 4); assert.ok(result.contexts.every(c => c.files.length === 42 && c.semantic.length === 34));
  // Root references precede pointer references. The 100-reference split contains
  // 32 distinct root objects, then 28 roots plus two pointer objects, not two
  // identical copies of the two-revision object's partition.
  assert.equal(f.grants.length, 504); assert.deepEqual(f.queries, [16, 16, 16, 14, 2, 6]);
  const changes = Array.from({ length: 34 }, (_, i) => ['BRIEF', 'SPEC'].map(name => ({
    path: `intent/${9000 + i}/${name}.md`, content: `# ${name} ${i}\n` }))).flat();
  const revision = f.native.git.add(changes), before = f.queries.length;
  await assert.rejects(f.graph.withReadSet([revision], async () => {}, returnGraph), error);
  assert.equal(f.queries.length, before);
});
