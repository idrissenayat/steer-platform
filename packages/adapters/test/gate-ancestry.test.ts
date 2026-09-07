import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectGateReviewAncestry } from '../src/code-host/gate-ancestry.ts';
import { createGitHubReader, type RepositoryReader } from '../src/code-host/github.ts';
import { fixture, binding, now } from './github-brief-fixture.ts';

const failure = /^Error: Selected gate review ancestry could not be verified\.$/;
const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40);
const noop = () => {};

test('actual GitHub read adapter traverses native merge parents and retains same-target and source-head links', async t => {
  const source = fixture(t), root = source.head();
  const left = source.add([{ path: 'left.txt', content: 'left' }]);
  const right = source.add([{ path: 'right.txt', content: 'right' }], root);
  const merge = source.git(['commit-tree', source.commit(right).tree.sha, '-p', right, '-p', left, '-m', 'Synthetic merge']);
  const reader = createGitHubReader(binding, { fetch: source.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now });
  const result = await collectGateReviewAncestry(reader, { revisions: [root, left, left, merge], maxCommits: 4 }, noop);
  assert.deepEqual(result.links.map(value => value.path), [[left, root], [left], [merge, left]]);
  assert.equal(result.commits.length, 4); assert.ok(Object.isFrozen(result.commits[0]!.parents));
  assert.equal(result.selectedTargetAncestryVerified, true); assert.equal(result.providerGraphVerificationRequired, true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.equal(source.mutations(), 0); assert.equal(source.approvals(), 0);
  assert.equal(source.calls.filter(value => value.path.includes('/git/commits/')).length, 4);
  await assert.rejects(collectGateReviewAncestry(reader, { revisions: [left, right], maxCommits: 4 }, noop), failure);
});

test('GitHub commit reads reject mismatched, missing, duplicate, cyclic or over-wide parent responses', async t => {
  const source = fixture(t), current = source.head();
  const make = () => createGitHubReader(binding, { fetch: source.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now });
  for (const response of [{ sha: a, parents: [] }, { sha: current }, { sha: current, parents: [{ sha: a }, { sha: a }] },
    { sha: current, parents: [{ sha: current }] }, { sha: current, parents: [{ sha: 'invalid' }] },
    { sha: current, parents: Array.from({ length: 17 }, (_, index) => ({ sha: index.toString(16).padStart(40, '0') })) }]) {
    source.override((url, _init, value) => url.pathname.includes('/git/commits/') ? response : value);
    await assert.rejects(make().readCommit!(current), /configured code-host source could not be verified/);
  }
  const before = source.calls.length;
  await assert.rejects(make().readCommit!('main'), /configured code-host source could not be verified/);
  assert.equal(source.calls.length, before);
});

function graph() {
  const calls: string[] = [], parents = new Map([[a, [] as string[]], [b, [a]], [c, [b]]]);
  const reader: RepositoryReader = { binding,
    readHead: async () => { throw new Error('Unexpected head read'); },
    readArtifact: async () => { throw new Error('Unexpected artifact read'); },
    readInventory: async () => { throw new Error('Unexpected inventory read'); },
    readCommit: async revision => { calls.push(revision); return { organizationId: binding.organizationId,
      repositoryId: binding.repositoryId, revision, parents: parents.get(revision) ?? [] }; },
  };
  return { reader, calls, parents };
}

test('commit budget is shared across every selected link and fails before one excess read', async () => {
  const f = graph();
  await assert.rejects(collectGateReviewAncestry(f.reader, { revisions: [a, b, c], maxCommits: 2 }, noop), failure);
  assert.deepEqual(f.calls, [b, a]);
  f.calls.length = 0;
  const result = await collectGateReviewAncestry(f.reader, { revisions: [a, b, c], maxCommits: 3 }, noop);
  assert.equal(result.commits.length, 3); assert.deepEqual(f.calls, [b, a, c]);
});

test('invalid configuration and missing capability cannot start source reads', async () => {
  const f = graph();
  for (const input of [{ revisions: [a], maxCommits: 2 }, { revisions: [a, b], maxCommits: 101 },
    { revisions: [a, b], maxCommits: 0 }, { revisions: [a, b], maxCommits: 1.5 },
    { revisions: ['main', b], maxCommits: 2 }, { revisions: Array(18).fill(a), maxCommits: 2 },
    { revisions: [a, b], maxCommits: 2, organizationId: 'foreign' }]) {
    await assert.rejects(collectGateReviewAncestry(f.reader, input, noop), failure);
  }
  delete f.reader.readCommit;
  await assert.rejects(collectGateReviewAncestry(f.reader, { revisions: [a, b], maxCommits: 2 }, noop), failure);
  assert.deepEqual(f.calls, []);
});

test('scope, revision, shape, duplicate edges and retained cycles fail closed', async () => {
  for (const mode of ['tenant', 'repository', 'revision', 'extra', 'duplicate', 'self', 'cycle']) {
    const f = graph(), read = f.reader.readCommit!;
    f.reader.readCommit = async revision => {
      const value = await read(revision);
      if (mode === 'tenant') value.organizationId = 'foreign';
      if (mode === 'repository') value.repositoryId++;
      if (mode === 'revision') value.revision = a;
      if (mode === 'extra') Object.assign(value, { verified: true });
      if (mode === 'duplicate') value.parents = [a, a];
      if (mode === 'self') value.parents = [revision];
      if (mode === 'cycle') value.parents = revision === b ? [c] : [b];
      return value;
    };
    await assert.rejects(collectGateReviewAncestry(f.reader, { revisions: [a, b], maxCommits: 3 }, noop), failure, mode);
  }
});

test('caller deadline and revocation guards run after slow reads and before another provider read', async () => {
  const f = graph(), read = f.reader.readCommit!; let closed = false;
  f.reader.readCommit = async revision => { const value = await read(revision); closed = true; return value; };
  await assert.rejects(collectGateReviewAncestry(f.reader, { revisions: [a, c], maxCommits: 3 }, () => {
    if (closed) throw new Error('Synthetic expired or revoked invocation');
  }), failure);
  assert.deepEqual(f.calls, [c]);
});
