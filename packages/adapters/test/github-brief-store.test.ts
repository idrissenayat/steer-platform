import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BriefCreateRequest } from '@steer/tool-registry';
import { fixture, now, binding, ref, type Override } from './github-brief-fixture.ts';

test('atomic exact Brief and marker persist in native Git; a new adapter recovers the same commit', async (t) => {
  const f = fixture(t), store = f.make(); assert.equal((await store.inspect(ref)).outcome, 'not-found');
  const result = await store.compareAndCreate(f.request); assert.equal(result.outcome, 'committed');
  if (result.outcome !== 'committed') return;
  assert.equal(result.revision, f.head()); assert.equal(result.blobSha, f.request.contentBlobSha);
  assert.equal(f.git(['show', `${result.revision}:${ref.path}`]), f.request.content.trimEnd());
  const marker = JSON.parse(f.git(['show', `${result.revision}:${f.request.operationPath}`]));
  assert.equal(marker.expectedHead, f.request.expectedHead); assert.equal('revision' in marker, false);
  assert.deepEqual(f.git(['diff-tree', '--no-commit-id', '--name-only', '-r', result.revision]).split('\n'), [f.request.operationPath, ref.path]);
  assert.deepEqual(await f.make().inspect(ref), result);
  assert.deepEqual(await f.make().compareAndCreate(f.request), result); assert.equal(f.mutations(), 1); assert.equal(f.approvals(), 1);
});

test('concurrent isolated adapters cannot create two commits at the same expected head', async (t) => {
  const f = fixture(t); const results = await Promise.all([f.make().compareAndCreate(f.request), f.make().compareAndCreate(f.request)]);
  assert.ok(results.some((r) => r.outcome === 'committed')); assert.ok(results.every((r) => ['committed', 'unknown', 'conflict'].includes(r.outcome)));
  assert.equal(f.git(['rev-list', '--count', `${f.request.expectedHead}..${f.head()}`]), '1');
  assert.equal((await f.make().inspect(ref)).outcome, 'committed');
});

test('lost acknowledgement is unknown and a restart reads the original operation without another mutation', async (t) => {
  const f = fixture(t); f.loseAck(); assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown');
  assert.equal((await f.make().inspect(ref)).outcome, 'committed');
  assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'committed'); assert.equal(f.mutations(), 1);
});

test('key reuse with changed bytes, base, digest or subject conflicts without a second write', async (t) => {
  const f = fixture(t); await f.make().compareAndCreate(f.request);
  for (const change of [{ expectedHead: f.head() }, { requestDigest: 'e'.repeat(64) }, { subject: 'someone-else' }])
    assert.equal((await f.make().compareAndCreate({ ...f.request, ...change })).outcome, 'conflict');
  assert.equal(f.mutations(), 1);
});

test('existing target and stale base are conflicts, including non-regular ancestor paths', async (t) => {
  for (const entry of [{ path: ref.path, content: 'existing' }, { path: 'items', content: 'link', mode: '120000' },
    { path: `${ref.path}/child`, content: 'directory' }]) {
    const f = fixture(t); const expectedHead = f.add([entry]);
    assert.equal((await f.make().compareAndCreate({ ...f.request, expectedHead })).outcome, 'conflict'); assert.equal(f.mutations(), 0);
  }
  const f = fixture(t); f.add([{ path: 'another.md', content: 'new head' }]);
  assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'conflict'); assert.equal(f.mutations(), 0);
});

test('head race and branch-protection rejection never trigger force, retry or false receipt', async (t) => {
  for (const race of [true, false]) {
    const f = fixture(t); if (race) f.race(); else f.deny();
    assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown'); assert.equal(f.mutations(), 1);
    assert.equal((await f.make().inspect(ref)).outcome, 'not-found');
  }
});

test('narrow installation tokens reject broader permissions, foreign repository and stale expiration', async (t) => {
  for (const patch of [{ permissions: { contents: 'read', administration: 'write' } },
    { repositories: [{ id: 53, full_name: 'synthetic/fixture' }] },
    { repositories: [{ id: 52, full_name: 'other/fixture' }] }, { expires_at: now.toISOString() }]) {
    const f = fixture(t); f.override((url, _init, value) => url.pathname.includes('access_tokens') ? { ...(value as object), ...patch } : value);
    assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown'); assert.equal(f.mutations(), 0);
  }
  const f = fixture(t); f.override((url, init, value) => url.pathname.includes('access_tokens') && String(init?.body).includes('write')
    ? { ...(value as object), permissions: { contents: 'read', metadata: 'read' } } : value);
  assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown'); assert.equal(f.approvals(), 0); assert.equal(f.mutations(), 0);
});

test('trusted current-authority callback cannot return mismatched, stale, future or expired proof', async (t) => {
  for (const patch of [{ authorizationRevision: 'e'.repeat(40) }, { gate2DecisionDigest: 'e'.repeat(64) },
    { subject: 'other' }, { platformRevision: 'e'.repeat(40) }, { requestDigest: 'e'.repeat(64) },
    { evaluatedAt: new Date(now.getTime() - 6000).toISOString() }, { evaluatedAt: new Date(now.getTime() + 1).toISOString() },
    { validThrough: now.toISOString() }, { validThrough: new Date(now.getTime() + 31000).toISOString() }]) {
    const f = fixture(t); f.proof((value) => ({ ...(value as object), ...patch }));
    assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown'); assert.equal(f.mutations(), 0);
  }
});

test('hostile scope, operation path and mismatched content fail before provider I/O', async (t) => {
  const f = fixture(t);
  for (const patch of [{ path: 'intent/0001/EXAM.md' }, { path: `${ref.path}\n` }, { branch: '../main' },
    { repository: 'github:53' }, { organizationId: 'other' }, { operationPath: '.github/workflows/write.yml' },
    { expectedBlob: f.request.contentBlobSha }, { content: 'replacement' }, { content: '\ud800' }, { expectedHead: `${f.request.expectedHead}\n` }])
    await assert.rejects(f.make().compareAndCreate({ ...f.request, ...patch } as BriefCreateRequest));
  assert.equal(f.calls.length, 0);
});

test('failed, truncated, duplicate or corrupt reads never become absence or a write', async (t) => {
  for (const override of [
    ((url, _init, value) => url.pathname.includes('/git/trees/') ? { ...(value as object), truncated: true } : value),
    ((url, _init, value) => url.pathname.includes('/git/ref/') ? new Response('{}', { status: 404 }) : value),
    ((url, _init, value) => url.pathname.includes('/git/trees/') ? { ...(value as object), tree: Array(2).fill({ path: 'x', type: 'blob', mode: '100644', sha: 'a'.repeat(40) }) } : value),
    ((url, _init, value) => url.pathname.includes('/git/trees/') ? new Response('x'.repeat(2 * 1024 * 1024 + 1)) : value),
  ] satisfies Override[]) {
    const f = fixture(t); f.override(override); assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown'); assert.equal(f.mutations(), 0);
  }
});

test('status recovers the creation revision after unrelated commits but rejects marker change, deletion or recreation', async (t) => {
  const f = fixture(t); const created = await f.make().compareAndCreate(f.request);
  f.add([{ path: 'unrelated.md', content: 'later' }]); assert.deepEqual(await f.make().inspect(ref), created);
  const original = f.git(['show', `${f.head()}:${f.request.operationPath}`]) + '\n';
  f.add([{ path: f.request.operationPath, content: 'tampered' }]); assert.equal((await f.make().inspect(ref)).outcome, 'unknown');
  f.add([{ path: f.request.operationPath, content: null }]); assert.equal((await f.make().inspect(ref)).outcome, 'unknown');
  f.add([{ path: f.request.operationPath, content: original }]); assert.equal((await f.make().inspect(ref)).outcome, 'unknown');
});

test('bad readback blobs, foreign mutation receipts, GraphQL partial errors and incomplete ancestry stay unknown', async (t) => {
  for (const override of [
    ((url, _init, value) => url.pathname.includes('/git/blobs/') ? { ...(value as object), content: Buffer.from('corrupt').toString('base64') } : value),
    ((url, _init, value) => url.pathname === '/graphql' ? { data: { createCommitOnBranch: { commit: { oid: 'a'.repeat(40) }, ref: { name: binding.branch } } } } : value),
    ((url, _init, value) => url.pathname === '/graphql' ? { ...(value as object), errors: [{ message: 'partial error' }] } : value),
    ((url, _init, value) => url.pathname.includes('/compare/') ? { ...(value as object), total_commits: 101 } : value),
    ((url, _init, value) => url.pathname.includes('/compare/') ? { ...(value as object), commits: [] } : value),
  ] satisfies Override[]) {
    const f = fixture(t); f.override(override); assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown'); assert.equal(f.mutations(), 1);
  }
});

test('readback rejects unrequested files and merge ancestry even with a matching mutation hash', async (t) => {
  for (const override of [
    ((url, _init, value) => {
      if (!url.pathname.includes('/git/trees/')) return value;
      const tree = value as { tree: { path: string }[] };
      return tree.tree.some((e) => e.path === ref.path) ? { ...tree,
        tree: [...tree.tree, { path: 'unexpected.md', mode: '100644', type: 'blob', sha: 'e'.repeat(40) }] } : value;
    }),
    ((url, _init, value) => {
      if (!url.pathname.includes('/compare/')) return value;
      const comparison = value as { commits: { parents: { sha: string }[] }[] };
      return { ...comparison, commits: comparison.commits.map((c) => ({ ...c, parents: [...c.parents, { sha: 'e'.repeat(40) }] })) };
    }),
  ] satisfies Override[]) {
    const f = fixture(t); f.override(override);
    assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown'); assert.equal(f.mutations(), 1);
  }
});

test('a moving head cannot yield authoritative absence', async (t) => {
  const f = fixture(t); let reads = 0;
  f.override((url, _init, value) => {
    if (url.pathname.includes('/git/ref/') && ++reads === 2)
      return { ref: `refs/heads/${binding.branch}`, object: { type: 'commit', sha: 'e'.repeat(40) } };
    return value;
  });
  assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown'); assert.equal(f.mutations(), 0);
});

test('an unbounded body stream is cancelled at the chunk cap before authority or dispatch', async (t) => {
  const f = fixture(t); let cancelled = false;
  f.override((url, _init, value) => url.pathname.includes('/git/ref/') ? new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array()); }, cancel() { cancelled = true; },
  })) : value);
  assert.equal((await f.make().compareAndCreate(f.request)).outcome, 'unknown');
  assert.equal(cancelled, true); assert.equal(f.approvals(), 0); assert.equal(f.mutations(), 0);
});
