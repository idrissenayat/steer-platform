import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createGitHubBriefStore } from '../src/code-host/github-brief-store.ts';
import type { BriefCreateRequest } from '@steer/tool-registry';

export const now = new Date('2026-09-06T15:00:00.000Z');
export const binding = { organizationId: 'org', installationId: 1, repositoryId: 52, owner: 'synthetic', repository: 'fixture', branch: 'codex/fixture' };
export const config = { organizationId: 'org', repository: 'github:52', branch: binding.branch,
  paths: ['items/0001-demo/BRIEF.md'], platformRevision: 'b'.repeat(40), gate2DecisionDigest: 'c'.repeat(64) };
export const ref = { organizationId: 'org', repository: 'github:52', branch: binding.branch, path: config.paths[0]!,
  subject: 'synthetic-human', idempotencyKey: '00000000-0000-4000-8000-000000000124' };
const hash = (content: string) => createHash('sha256').update(content).digest('hex');
export type Override = (url: URL, init: RequestInit | undefined, result: unknown) => unknown;

export function fixture(t: { after(run: () => void): void }, mutationProfile: 'brief' | 'candidate-bundle' = 'brief') {
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
  const readBlob = (sha: string) => {
    assert.match(sha, /^[a-f0-9]{40}$/);
    return execFileSync('git', ['-C', directory, 'cat-file', 'blob', sha], { stdio: ['pipe', 'pipe', 'pipe'] });
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
      if (mutationProfile === 'brief') assert.equal(variables.input.fileChanges.additions.length, 2);
      else assert.ok([6, 7].includes(variables.input.fileChanges.additions.length));
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
        const sha = route.slice('/git/blobs/'.length), bytes = readBlob(sha);
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
  const verifyAuthority = async (input: BriefCreateRequest) => { approvals++; return changeProof({ ...ref, kind: 'verified-brief-write-authority',
      requestDigest: input.requestDigest, expectedHead: input.expectedHead, authorizationRevision: input.expectedHead,
      platformRevision: config.platformRevision, gate2DecisionDigest: config.gate2DecisionDigest,
      evaluatedAt: now.toISOString(), validThrough: new Date(now.getTime() + 5000).toISOString() }); };
  const make = () => createGitHubBriefStore(binding, config, { fetch: transport, appJwt: async () => 'synthetic-app-jwt', now: () => now, verifyAuthority });
  return { request, make, transport, verifyAuthority, add, git, commit, readBlob, calls, head: () => head, mutations: () => mutations, approvals: () => approvals,
    recordSyntheticApproval: () => { approvals++; },
    override: (value: Override) => { override = value; }, proof: (value: (v: unknown) => unknown) => { changeProof = value; },
    loseAck: () => { lostAck = true; }, deny: () => { deny = true; }, race: () => { advanceAtDispatch = true; } };
}
