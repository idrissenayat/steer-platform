import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createGitHubBriefStore } from '../src/code-host/github-brief-store.ts';
import type { BriefCreateRequest } from '@steer/tool-registry';

const now = new Date('2026-09-06T15:00:00.000Z');
const binding = { organizationId: 'org', installationId: 1, repositoryId: 52, owner: 'synthetic', repository: 'fixture', branch: 'codex/fixture' };
const config = { organizationId: 'org', repository: 'github:52', branch: binding.branch,
  paths: ['items/0001-demo/BRIEF.md'], platformRevision: 'b'.repeat(40), gate2DecisionDigest: 'c'.repeat(64) };
const ref = { organizationId: 'org', repository: 'github:52', branch: binding.branch, path: config.paths[0]!,
  subject: 'synthetic-human', idempotencyKey: '00000000-0000-4000-8000-000000000124' };
const hash = (content: string) => createHash('sha256').update(content).digest('hex');
type Override = (url: URL, init: RequestInit | undefined, result: unknown) => unknown;

function fixture(t: TestContext) {
  // Only an isolated temporary object database is mutated. No credentials/network,
  // repository checkout, global git config or user's actual identity is used.
  const directory = mkdtempSync(join(tmpdir(), 'steer-0124-git-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'Synthetic', GIT_AUTHOR_EMAIL: 'synthetic@example.invalid',
    GIT_COMMITTER_NAME: 'Synthetic', GIT_COMMITTER_EMAIL: 'synthetic@example.invalid',
    GIT_AUTHOR_DATE: now.toISOString(), GIT_COMMITTER_DATE: now.toISOString() };
  const git = (args: string[], input?: string) => execFileSync('git', ['-C', directory, '-c', 'core.hooksPath=/dev/null', ...args],
    { env, encoding: 'utf8', ...(input === undefined ? {} : { input }), stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  git(['init', '--quiet']); const empty = git(['mktree'], '');
  let head = git(['commit-tree', empty, '-m', 'Synthetic base']);
  git(['update-ref', `refs/heads/${binding.branch}`, head]);
  const initial = head;
  const commit = (revision: string) => {
    const raw = git(['cat-file', '-p', revision]);
    return { sha: revision, tree: { sha: raw.match(/^tree ([a-f0-9]{40})/m)![1]! },
      parents: [...raw.matchAll(/^parent ([a-f0-9]{40})/gm)].map((match) => ({ sha: match[1]! })) };
  };
  const add = (changes: { path: string; content: string | null; mode?: string }[], parent = head) => {
    git(['read-tree', parent]);
    for (const change of changes) {
      if (change.content === null) git(['update-index', '--force-remove', '--', change.path]);
      else {
        const blob = git(['hash-object', '-w', '--stdin'], change.content);
        git(['update-index', '--add', '--cacheinfo', change.mode ?? '100644', blob, change.path]);
      }
    }
    const tree = git(['write-tree']), revision = git(['commit-tree', tree, '-p', parent, '-m', 'Synthetic change']);
    git(['update-ref', `refs/heads/${binding.branch}`, revision, head]); head = revision; return revision;
  };
  const content = '# Brief\n\nSynthetic café 🌸\n';
  const request: BriefCreateRequest = { ...ref, expectedHead: initial, expectedBlob: null,
    requestDigest: 'd'.repeat(64), content, contentDigest: hash(content),
    contentBlobSha: git(['hash-object', '--stdin'], content), operationPath: `.steer/authoring/operations/${ref.idempotencyKey}.json` };
  let mutations = 0, approvals = 0, lostAck = false, deny = false, advanceAtDispatch = false, changeProof = (v: unknown) => v;
  let override: Override = (_url, _init, result) => result;
  const calls: { path: string; method: string }[] = [];
  const transport: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push({ path: url.pathname, method: init?.method ?? '' });
    assert.equal(url.origin, 'https://api.github.com'); assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store'); assert.ok(init?.signal);
    const headers = new Headers(init?.headers); assert.equal(headers.get('X-GitHub-Api-Version'), '2026-03-10');
    let result: unknown;
    if (url.pathname === '/app/installations/1/access_tokens') {
      assert.equal(init?.method, 'POST'); assert.equal(headers.get('authorization'), 'Bearer synthetic-app-jwt');
      const body = JSON.parse(String(init.body)); assert.deepEqual(body.repository_ids, [52]);
      const level = body.permissions.contents; assert.ok(['read', 'write'].includes(level));
      assert.deepEqual(Object.keys(body.permissions), ['contents']);
      result = { token: `synthetic-${level}`, expires_at: new Date(now.getTime() + 3600000).toISOString(),
        repositories: [{ id: 52, full_name: 'synthetic/fixture' }], permissions: { contents: level, metadata: 'read' } };
    } else if (url.pathname === '/graphql') {
      mutations++; assert.equal(init?.method, 'POST'); assert.equal(headers.get('authorization'), 'Bearer synthetic-write');
      assert.equal(approvals > 0, true);
      const { query, variables } = JSON.parse(String(init.body));
      assert.match(query, /createCommitOnBranch/); assert.doesNotMatch(query, /updateRef|force|delete/);
      assert.deepEqual(variables.input.branch, { repositoryNameWithOwner: 'synthetic/fixture', branchName: binding.branch });
      assert.deepEqual(Object.keys(variables.input.fileChanges), ['additions']);
      assert.equal(variables.input.fileChanges.additions.length, 2);
      // Allow competing adapter requests to reach the same native Git CAS boundary.
      await Promise.resolve();
      if (advanceAtDispatch) { advanceAtDispatch = false; add([{ path: 'unrelated.md', content: 'advance' }]); }
      if (deny || variables.input.expectedHeadOid !== head) result = { errors: [{ message: 'Synthetic policy or head rejection' }] };
      else {
        const additions = variables.input.fileChanges.additions.map((entry: { path: string; contents: string }) =>
          ({ path: entry.path, content: Buffer.from(entry.contents, 'base64').toString('utf8') }));
        const revision = add(additions);
        result = { data: { createCommitOnBranch: { commit: { oid: revision }, ref: { name: binding.branch } } } };
        if (lostAck) throw new Error('synthetic lost acknowledgement');
      }
    } else {
      assert.equal(init?.method, 'GET'); assert.equal(headers.get('authorization'), 'Bearer synthetic-read');
      const route = url.pathname.replace('/repos/synthetic/fixture', '');
      if (route === `/git/ref/heads/${binding.branch}`) result = { ref: `refs/heads/${binding.branch}`, object: { type: 'commit', sha: head } };
      else if (route.startsWith('/git/commits/')) result = commit(route.slice('/git/commits/'.length));
      else if (route.startsWith('/git/trees/')) {
        const sha = route.slice('/git/trees/'.length);
        result = { sha, truncated: false, tree: git(['ls-tree', '-r', '-t', sha]).split('\n').filter(Boolean).map((line) => {
          const [mode, type, entrySha, path] = line.split(/[\t ]/); return { mode, type, sha: entrySha, path };
        }) };
      } else if (route.startsWith('/git/blobs/')) {
        const sha = route.slice('/git/blobs/'.length), bytes = execFileSync('git', ['-C', directory, 'cat-file', 'blob', sha]);
        result = { sha, encoding: 'base64', size: bytes.length, content: bytes.toString('base64') };
      } else if (route === '/commits') {
        assert.equal(url.searchParams.get('per_page'), '2');
        result = git(['log', '--format=%H', '-2', url.searchParams.get('sha')!, '--', url.searchParams.get('path')!])
          .split('\n').filter(Boolean).map((revision) => commit(revision));
      } else if (route.startsWith('/compare/')) {
        const [base, end] = route.slice('/compare/'.length).split('...');
        const revisions = git(['rev-list', '--reverse', `${base}..${end}`]).split('\n').filter(Boolean);
        result = { status: 'ahead', ahead_by: revisions.length, behind_by: 0, total_commits: revisions.length,
          base_commit: { sha: base }, merge_base_commit: { sha: git(['merge-base', base!, end!]) }, commits: revisions.map(commit) };
      } else throw new Error(`Unexpected synthetic endpoint: ${route}`);
    }
    const replaced = override(url, init, result); return replaced instanceof Response ? replaced : Response.json(replaced);
  };
  const make = () => createGitHubBriefStore(binding, config, { fetch: transport, appJwt: async () => 'synthetic-app-jwt', now: () => now,
    verifyAuthority: async (input) => { approvals++; return changeProof({ ...ref, kind: 'verified-brief-write-authority',
      requestDigest: input.requestDigest, expectedHead: input.expectedHead, authorizationRevision: input.expectedHead,
      platformRevision: config.platformRevision, gate2DecisionDigest: config.gate2DecisionDigest,
      evaluatedAt: now.toISOString(), validThrough: new Date(now.getTime() + 5000).toISOString() }); } });
  return { request, make, add, git, commit, calls, head: () => head, mutations: () => mutations, approvals: () => approvals,
    override: (value: Override) => { override = value; }, proof: (value: (v: unknown) => unknown) => { changeProof = value; },
    loseAck: () => { lostAck = true; }, deny: () => { deny = true; }, race: () => { advanceAtDispatch = true; } };
}

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
