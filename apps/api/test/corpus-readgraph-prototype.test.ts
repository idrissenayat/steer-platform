import assert from 'node:assert/strict';
import test from 'node:test';
import { corpusBatchPrototypeFixture } from './corpus-batch-prototype.fixture.ts';
import { collectCorpusReadgraphPrototype } from './corpus-readgraph-prototype.ts';
import type { IntentCorpusAuthority } from '../../../packages/adapters/src/code-host/intent-corpus-evidence.ts';

test('two pinned revisions share immutable bodies but retain every revision/path policy', async t => {
  const f = await corpusBatchPrototypeFixture(t), baseline = await f.run(), first = baseline.revision;
  f.native.git.add([{ path: 'graph-control.md', content: 'new revision, same source objects\n' }]);
  const second = f.native.git.head(), reader = f.native.reader(f.binding.organizationId); let callers = 0;
  const graph = await collectCorpusReadgraphPrototype(f.binding, f.evidence.productId, [first, second], f.repository, f.authority,
    async () => { callers++; await reader.readHead(); });
  assert.equal(graph.requests, 12); assert.equal(callers, 16); assert.equal(graph.uniqueBlobObjects, 40);
  assert.equal(graph.sourcePolicyQueries, 252); assert.equal(graph.contexts.length, 2);
  for (const c of graph.contexts) { assert.equal(c.files.length, 42); assert.deepEqual(c.semantic, baseline.semantic); }
  assert.deepEqual(graph.waves.map(w => [w.paths, w.fetchedObjects, w.batches]), [[68, 34, 3], [4, 2, 1], [12, 4, 1]]);
  assert.equal(graph.productionInstalled, false);
  // A same-path changed blob remains distinct; a new invocation has no old cache.
  f.native.git.add([{ path: 'items/0003-existing/BRIEF.md', content: '# A different immutable source\n' }]);
  const changed = await collectCorpusReadgraphPrototype(f.binding, f.evidence.productId, [first, f.native.git.head()], f.repository, f.authority, async () => {});
  assert.equal(changed.uniqueBlobObjects, 41);
  assert.notEqual(changed.contexts[0]!.semantic.find(s => s.path === 'items/0003-existing/BRIEF.md')!.content,
    changed.contexts[1]!.semantic.find(s => s.path === 'items/0003-existing/BRIEF.md')!.content);
});
test('permission for one revision never grants an identical blob under another revision', async t => {
  const f = await corpusBatchPrototypeFixture(t), first = f.native.git.head();
  f.native.git.add([{ path: 'graph-permission.md', content: 'new metadata revision\n' }]); const second = f.native.git.head();
  let denied = false;
  const authority: IntentCorpusAuthority = { ...f.authority, authorizeSource: async ref => {
    if (ref.revision === second && ref.path === 'items/0001-existing/BRIEF.md') { denied = true; throw new Error('Synthetic revision policy denied'); }
  } };
  await assert.rejects(collectCorpusReadgraphPrototype(f.binding, f.evidence.productId, [first, second], f.repository, authority, async () => {}));
  assert.equal(denied, true); assert.equal(f.queries.length, 0);
});
test('late caller, source, grants, head, port and binding changes stop the graph before later dispatch', async t => {
  const f = await corpusBatchPrototypeFixture(t), first = f.native.git.head();
  f.native.git.add([{ path: 'graph-authority.md', content: 'second revision\n' }]); const second = f.native.git.head();
  const select = f.authority.select, branch = f.binding.branch;
  for (const mode of ['caller', 'source', 'grants', 'head', 'port', 'binding', 'abort']) {
    f.state.caller = true; f.state.source = true; f.state.revision = 'synthetic-grants-r1'; f.authority.select = select; f.binding.branch = branch;
    let reached = false; const signal = new AbortController(), before = f.queries.length;
    f.afterQuery(() => { if (reached) return; reached = true;
      if (mode === 'caller') f.state.caller = false;
      if (mode === 'source') f.state.source = false;
      if (mode === 'grants') f.state.revision = 'changed';
      if (mode === 'head') f.native.git.add([{ path: 'graph-late-head.md', content: 'changed mid-read\n' }]);
      if (mode === 'port') f.authority.select = async c => select(c);
      if (mode === 'binding') f.binding.branch = 'changed';
      if (mode === 'abort') signal.abort();
    });
    await assert.rejects(collectCorpusReadgraphPrototype(f.binding, f.evidence.productId, [first, second], f.repository, f.authority,
      async () => { if (!f.state.caller) throw new Error('Synthetic caller denied'); }, signal.signal));
    assert.equal(reached, true);
    if (mode !== 'head') assert.equal(f.queries.length - before, 1);
  }
});
test('corrupt, partial and oversized object replies fail closed', async t => {
  const f = await corpusBatchPrototypeFixture(t), first = f.native.git.head();
  for (const alter of [(_raw: any) => null, (raw: any) => { delete raw.data.repository.b0; return raw; },
    (raw: any) => { raw.data.repository.b0.text += 'wrong'; return raw; },
    (raw: any) => { raw.data.repository.b0.isTruncated = true; return raw; },
    (_raw: any) => new Response('x'.repeat(2097153))]) {
    f.override(alter);
    await assert.rejects(collectCorpusReadgraphPrototype(f.binding, f.evidence.productId, [first], f.repository, f.authority, async () => {}));
  }
});
test('revision sets are explicit, bounded and immutable object IDs only', async t => {
  const f = await corpusBatchPrototypeFixture(t), first = f.native.git.head(), before = f.wire.length;
  for (const revisions of [[], ['HEAD'], [first, first], Array.from({ length: 5 }, () => first)])
    await assert.rejects(collectCorpusReadgraphPrototype(f.binding, f.evidence.productId, revisions, f.repository, f.authority, async () => {}));
  assert.equal(f.wire.length, before);
});

test('dependent readback is awaited before final source closure; late denial withholds the result', async t => {
  const f = await corpusBatchPrototypeFixture(t), first = f.native.git.head();
  let dependentDone = false, finalGrants = 0, rechecks = 0;
  const authority: IntentCorpusAuthority = { ...f.authority, authorizeSource: async ref => {
    await f.authority.authorizeSource(ref); if (dependentDone) finalGrants++;
  } };
  const result = await collectCorpusReadgraphPrototype(f.binding, f.evidence.productId, [first], f.repository, authority,
    async () => {}, new AbortController().signal, async () => { rechecks++; assert.equal(finalGrants, 0); dependentDone = true; });
  assert.equal(rechecks, 1); assert.equal(finalGrants, result.contexts[0]!.files.length);
  for (const mode of ['source', 'selection', 'head', 'abort', 'nonvoid', 'reject']) {
    f.state.source = true; let changed = false, reached = false;
    const signal = new AbortController();
    const selected: IntentCorpusAuthority = { ...f.authority, select: async c => {
      const value = await f.authority.select(c); assert.ok(value && typeof value === 'object');
      return changed ? { ...value, authorityDigest: '0'.repeat(64) } : value;
    } };
    await assert.rejects(collectCorpusReadgraphPrototype(f.binding, f.evidence.productId, [first], f.repository, selected,
      async () => {}, signal.signal, async () => {
        reached = true;
        if (mode === 'source') f.state.source = false;
        if (mode === 'selection') changed = true;
        if (mode === 'head') f.native.git.add([{ path: 'dependent-head.md', content: 'head changed after records\n' }]);
        if (mode === 'abort') signal.abort();
        if (mode === 'nonvoid') return 'invalid' as unknown as void;
        if (mode === 'reject') throw new Error('Synthetic dependent read rejected');
      }));
    assert.equal(reached, true);
  }
});
