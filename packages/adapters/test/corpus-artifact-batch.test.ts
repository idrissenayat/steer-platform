import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitHubReader } from '../src/code-host/github.ts';
import { corpusArtifactBatchQuery, planCorpusArtifactBatches, readCorpusArtifactBatch,
  type CorpusBatchReference } from '../src/code-host/corpus-artifact-batch.ts';
import { fixture, binding, now } from './github-brief-fixture.ts';

type Payload = { data: { repository: Record<string, any> }; errors?: unknown };
function setup(t: { after(run: () => void): void }) {
  const git = fixture(t), calls: string[] = [], queries: number[] = [];
  let epoch = now.getTime(), hints = true, tokenMode = 'read';
  let transform: (value: Payload) => Payload | Response = value => value;
  let onQuery: (signal: AbortSignal) => Promise<void> = async () => {};
  let onToken = () => {};
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    if (url.pathname === '/graphql') {
      assert.equal(init?.method, 'POST'); assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-read');
      assert.ok(init?.signal); init.signal.throwIfAborted();
      const { query, variables } = JSON.parse(String(init.body));
      assert.equal(variables.owner, binding.owner); assert.equal(variables.name, binding.repository);
      const ids = Object.keys(variables).filter(key => /^o\d+$/.test(key));
      assert.equal(Object.keys(variables).length, ids.length + 2);
      assert.equal(query, corpusArtifactBatchQuery(ids.length)); assert.doesNotMatch(query, /mutation|createCommit|updateRef/);
      queries.push(ids.length);
      const repository: Payload['data']['repository'] = { databaseId: binding.repositoryId,
        nameWithOwner: `${binding.owner}/${binding.repository}` };
      for (let i = 0; i < ids.length; i++) {
        const oid = variables[`o${i}`], bytes = git.readBlob(oid);
        repository[`b${i}`] = { __typename: 'Blob', oid, byteSize: bytes.length,
          isBinary: false, isTruncated: false, text: bytes.toString('utf8') };
      }
      await onQuery(init.signal); const result = transform({ data: { repository } });
      return result instanceof Response ? result : Response.json(result);
    }
    const response = await git.transport(input, init), value = await response.json();
    if (url.pathname.includes('/access_tokens')) {
      assert.deepEqual(JSON.parse(String(init?.body)).permissions, { contents: 'read' });
      value.expires_at = new Date(epoch + 3600000).toISOString(); value.permissions.contents = tokenMode;
      onToken();
    }
    if (hints && url.pathname.includes('/git/trees/')) for (const entry of value.tree)
      if (entry.type === 'blob') entry.size = git.readBlob(entry.sha).length;
    return Response.json(value);
  };
  const reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: transport, now: () => new Date(epoch) });
  const path = 'intent/0001/BRIEF.md', content = '\ufeff# Intent\nفارسی 🌸 café\r\nTrailing spaces  \n\n';
  const revision = git.add([{ path, content }, { path: 'intent/0001/SPEC.md', content },
    { path: 'private.txt', content: 'NOT IN CORPUS' }]);
  const ref = async () => ({ inventory: await reader.readScopeInventory(revision), revision, path });
  return { git, reader, calls, queries, path, content, revision, ref,
    change: (fn: typeof transform) => { transform = fn; }, onQuery: (fn: typeof onQuery) => { onQuery = fn; },
    hints: (value: boolean) => { hints = value; }, advance: (ms: number) => { epoch += ms; },
    onToken: (fn: typeof onToken) => { onToken = fn; },
    tokenMode: (value: string) => { tokenMode = value; } };
}
function authority() {
  const controller = new AbortController(), sourceCalls: string[] = []; let currentCalls = 0;
  const boundary = { signal: controller.signal,
    current: async function () { assert.equal(this, boundary); currentCalls++; },
    authorizeSource: async function (ref: { revision: string; path: string }) {
      assert.equal(this, boundary); assert.ok(Object.isFrozen(ref)); sourceCalls.push(`${ref.revision}:${ref.path}`);
    } };
  return { boundary, controller, sourceCalls, currentCalls: () => currentCalls };
}
const failure = { message: 'Corpus batch could not be verified.' };

test('native batch preserves exact bytes and independent revision/path grants while sharing only immutable objects', async t => {
  const f = setup(t), first = await f.ref(), a = authority();
  const nextRevision = f.git.add([{ path: 'intent/0001/EXAM.md', content: '# Independent exam\n' }]);
  const nextInventory = await f.reader.readScopeInventory(nextRevision);
  const refs = [first, { ...first, path: 'intent/0001/SPEC.md' },
    { inventory: nextInventory, revision: nextRevision, path: f.path },
    { inventory: nextInventory, revision: nextRevision, path: 'intent/0001/EXAM.md' }];
  const ordinary = await Promise.all(refs.map(ref => f.reader.readArtifact(ref.path, ref.revision)));
  const before = f.calls.length, result = await readCorpusArtifactBatch(f.reader, refs, a.boundary);
  assert.deepEqual(result, ordinary); assert.equal(result[0]!.content, f.content); assert.ok(result.every(Object.isFrozen));
  assert.equal(f.calls.length - before, 1); assert.deepEqual(f.queries, [2]); assert.equal(a.currentCalls(), 3);
  assert.deepEqual(a.sourceCalls, [...refs, ...refs].map(ref => `${ref.revision}:${ref.path}`));
  await readCorpusArtifactBatch(f.reader, refs, a.boundary);
  assert.deepEqual(f.queries, [2, 2]); assert.equal(a.currentCalls(), 6); assert.equal(f.git.mutations(), 0);
});

test('all references require exact native membership before policy or content access, without fallback', async t => {
  const f = setup(t), ref = await f.ref(), foreign = setup(t), foreignRef = await foreign.ref(), a = authority();
  const before = f.calls.length;
  const invalid: CorpusBatchReference[][] = [[], Array.from({ length: 101 }, (_, i) => ({ ...ref, path: `intent/${i}/BRIEF.md` })),
    [ref, ref], [ref, { ...ref, inventory: { ...ref.inventory } }], [{ ...ref, inventory: foreignRef.inventory }],
    [{ ...ref, inventory: null }], [{ ...ref, inventory: structuredClone(ref.inventory) }],
    [{ ...ref, revision: 'a'.repeat(40) }], [{ ...ref, revision: 'HEAD' }],
    ...['private.txt', 'intent/0001', 'intent/0001/MISSING.md', '../private.txt', 'intent//BRIEF.md', 'intent/./BRIEF.md', 'intent/\u0000.md']
      .map(path => [ref, { ...ref, path }]),
    Array.from({ length: 5 }, (_, i) => ({ ...ref, path: `intent/${i}/BRIEF.md`, inventory: {} }))];
  for (const refs of invalid) await assert.rejects(readCorpusArtifactBatch(f.reader, refs, a.boundary));
  await assert.rejects(readCorpusArtifactBatch({ ...f.reader }, [ref], a.boundary), failure);
  const original = f.reader.readArtifact; f.reader.readArtifact = (...args) => original(...args);
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], a.boundary), failure);
  assert.equal(a.currentCalls(), 0); assert.deepEqual(a.sourceCalls, []); assert.equal(f.calls.length, before);
});

test('symlinks and executable files cannot be read through a regular corpus membership proof', async t => {
  const f = setup(t), a = authority();
  const revision = f.git.add([{ path: 'intent/0001/link.md', content: 'BRIEF.md', mode: '120000' },
    { path: 'intent/0001/run.md', content: '# executable', mode: '100755' }]);
  const inventory = await f.reader.readScopeInventory(revision), before = f.calls.length;
  for (const path of ['intent/0001/link.md', 'intent/0001/run.md'])
    await assert.rejects(readCorpusArtifactBatch(f.reader, [{ inventory, revision, path }], a.boundary), failure);
  assert.equal(f.calls.length, before); assert.equal(a.currentCalls(), 0);
});

test('same object in another revision never inherits the earlier source grant', async t => {
  const f = setup(t), first = await f.ref(), a = authority();
  const revision = f.git.add([{ path: 'intent/0001/EXAM.md', content: '# Exam' }]), inventory = await f.reader.readScopeInventory(revision);
  const refs = [first, { inventory, revision, path: f.path }];
  a.boundary.authorizeSource = async ref => { if (ref.revision === revision) throw new Error('private denial'); };
  await assert.rejects(readCorpusArtifactBatch(f.reader, refs, a.boundary), failure); assert.deepEqual(f.queries, []);
  a.boundary.authorizeSource = async () => {};
  f.onQuery(async () => { a.boundary.authorizeSource = async () => { throw new Error('late private denial'); }; });
  await assert.rejects(readCorpusArtifactBatch(f.reader, refs, a.boundary), failure); assert.deepEqual(f.queries, [1]);
});

test('late denial using an unchanged source port and nonvoid authority results reject the entire batch', async t => {
  const f = setup(t), ref = await f.ref(), a = authority(); let denied = false;
  a.boundary.authorizeSource = async () => { if (denied) throw new Error('sensitive source'); };
  f.onQuery(async () => { denied = true; });
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], a.boundary), failure);
  denied = false; f.onQuery(async () => {});
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], { ...a.boundary, current: async () => true } as any), failure);
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], { ...a.boundary, current: async () => {},
    authorizeSource: async () => true } as any), failure);
  assert.equal(f.queries.length, 1);
});

test('partial, substituted, binary, truncated or malformed provider results cannot produce a partial return', async t => {
  const f = setup(t), ref = await f.ref();
  const edits: Array<(v: Payload) => void> = [
    v => { v.data.repository.databaseId++; }, v => { v.data.repository.nameWithOwner = 'another/private'; },
    v => { delete v.data.repository.b0; }, v => { v.data.repository.b0 = null; },
    v => { v.data.repository.b0.__typename = 'Tree'; }, v => { v.data.repository.b0.oid = 'f'.repeat(40); },
    v => { v.data.repository.b0.text = 'sensitive substitution'; }, v => { v.data.repository.b0.byteSize++; },
    v => { v.data.repository.b0.isBinary = true; }, v => { v.data.repository.b0.isBinary = null; },
    v => { v.data.repository.b0.isTruncated = true; }, v => { v.data.repository.b0.text = null; },
    v => { v.data.repository.b0.text = '\ud800'; }, v => { v.errors = [{ message: 'sensitive provider detail' }]; },
    v => { v.data.repository.extra = 'unexpected'; }, v => { v.data.repository.b0.extra = 'unexpected'; },
  ];
  for (const edit of edits) {
    f.change(v => { edit(v); return v; });
    await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], authority().boundary), failure);
  }
  f.change(v => v); assert.equal((await readCorpusArtifactBatch(f.reader, [ref], authority().boundary))[0]!.content, f.content);
  assert.equal(f.git.mutations(), 0);
});

test('oversized and invalid UTF-8 streams reject and release/cancel the response reader', async t => {
  const f = setup(t), ref = await f.ref(); let cancelled = false;
  f.change(() => new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(2097153)); },
    cancel() { cancelled = true; } })));
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], authority().boundary), failure); assert.equal(cancelled, true);
  f.change(() => new Response(new Uint8Array([0xff])));
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], authority().boundary), failure);
});

test('native queries obey alias and byte limits; later batch corruption discards earlier results', async t => {
  const f = setup(t), a = authority();
  const revision = f.git.add(Array.from({ length: 17 }, (_, i) => ({ path: `intent/0001/document-${i}.md`, content: `# ${i}\n` })));
  const inventory = await f.reader.readScopeInventory(revision);
  const refs = Array.from({ length: 17 }, (_, i) => ({ inventory, revision, path: `intent/0001/document-${i}.md` }));
  assert.equal((await readCorpusArtifactBatch(f.reader, refs, a.boundary)).length, 17);
  assert.deepEqual(f.queries, [16, 1]); assert.equal(a.currentCalls(), 5); assert.equal(a.sourceCalls.length, 34);
  let batches = 0; f.change(v => { if (++batches === 2) v.data.repository.b0.isTruncated = true; return v; });
  await assert.rejects(readCorpusArtifactBatch(f.reader, refs, authority().boundary), failure);
  assert.deepEqual(f.queries, [16, 1, 16, 1]);
});

test('unknown sizes conservatively pack two objects; exact 128-KiB escaped bytes remain intact', async t => {
  const f = setup(t); f.hints(false);
  const texts = ['a', 'b', 'c'].map(c => c + '\u0001'.repeat(131071));
  const revision = f.git.add(texts.map((content, i) => ({ path: `intent/0001/large-${i}.md`, content })));
  const inventory = await f.reader.readScopeInventory(revision);
  const refs = texts.map((_, i) => ({ inventory, revision, path: `intent/0001/large-${i}.md` }));
  const result = await readCorpusArtifactBatch(f.reader, refs, authority().boundary);
  assert.deepEqual(result.map(v => v.content), texts); assert.deepEqual(f.queries, [2, 1]);
});

test('size hints are verified, over-limit files deny before dispatch, and conflicting hints deny during planning', async t => {
  const f = setup(t), a = authority();
  const revision = f.git.add([{ path: 'intent/0001/big.md', content: 'x'.repeat(131073) }]);
  const inventory = await f.reader.readScopeInventory(revision), before = f.calls.length;
  await assert.rejects(readCorpusArtifactBatch(f.reader, [{ inventory, revision, path: 'intent/0001/big.md' }], a.boundary), failure);
  assert.equal(f.calls.length, before); assert.equal(a.currentCalls(), 0);
  const ref = await f.ref(); let i = 0;
  assert.throws(() => planCorpusArtifactBatches([ref, { ...ref, path: 'intent/0001/SPEC.md' }],
    () => ({ objectSha: 'a'.repeat(40), size: ++i })), failure);
  f.git.override((url, _init, value) => {
    if (url.pathname.includes('/git/trees/')) for (const entry of (value as any).tree) if (entry.type === 'blob') entry.size = 0;
    return value;
  });
  f.hints(false); const wrong = await f.ref();
  await assert.rejects(readCorpusArtifactBatch(f.reader, [wrong], authority().boundary), failure);
});

test('batch reuses the restricted installation token, refreshes at the safety margin and clears it on failure', async t => {
  const f = setup(t), ref = await f.ref(), tokens = () => f.calls.filter(path => path.includes('/access_tokens')).length;
  assert.equal(tokens(), 1); await readCorpusArtifactBatch(f.reader, [ref], authority().boundary); assert.equal(tokens(), 1);
  f.advance(3540000); await readCorpusArtifactBatch(f.reader, [ref], authority().boundary); assert.equal(tokens(), 2);
  f.change(v => { v.data.repository.b0.text = 'corrupt'; return v; });
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], authority().boundary), failure);
  f.change(v => v); await readCorpusArtifactBatch(f.reader, [ref], authority().boundary); assert.equal(tokens(), 3);
  f.advance(3540000); f.tokenMode('write'); const count = f.queries.length;
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], authority().boundary), failure);
  assert.equal(tokens(), 4); assert.equal(f.queries.length, count);
});

test('pre-cancel, in-flight cancel, late cancel and replaced boundary/reader ports fail closed', async t => {
  const f = setup(t), ref = await f.ref(), cancelled = authority(); cancelled.controller.abort();
  const before = f.calls.length;
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], cancelled.boundary), failure); assert.equal(f.calls.length, before);
  const inflight = authority(); let reached!: () => void; const started = new Promise<void>(resolve => { reached = resolve; });
  f.onQuery(signal => new Promise<void>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true }); reached();
  }));
  const pending = readCorpusArtifactBatch(f.reader, [ref], inflight.boundary);
  const rejected = assert.rejects(pending, failure); await started; inflight.controller.abort(); await rejected;
  const late = authority(); f.onQuery(async () => { late.controller.abort(); });
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], late.boundary), failure);
  const replaced = authority(); f.onQuery(async () => { replaced.boundary.current = async () => {}; });
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], replaced.boundary), failure);
  f.onQuery(async () => { const original = f.reader.readScopeInventory; f.reader.readScopeInventory = r => original(r); });
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], authority().boundary), failure);
});

test('port replacement or cancellation during token refresh denies before fetching content', async t => {
  const f = setup(t), ref = await f.ref(), replaced = authority();
  f.advance(3540000); f.onToken(() => { replaced.boundary.current = async () => {}; });
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], replaced.boundary), failure);
  const cancelled = authority(); f.onToken(() => { cancelled.controller.abort(); });
  await assert.rejects(readCorpusArtifactBatch(f.reader, [ref], cancelled.boundary), failure);
  assert.deepEqual(f.queries, []);
});

test('query count is bounded and object lookup uses variables, never interpolated paths or mutations', () => {
  for (const count of [0, 17, 1.5, NaN, Infinity]) assert.throws(() => corpusArtifactBatchQuery(count), failure);
  const query = corpusArtifactBatchQuery(16);
  assert.equal((query.match(/object\(oid: \$o\d+\)/g) ?? []).length, 16);
  assert.doesNotMatch(query, /mutation|intent\//);
});
