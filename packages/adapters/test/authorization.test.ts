import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { createGitAuthorizationResolver } from '../src/identity/authorization.ts';
import type { ArtifactReader, ArtifactSnapshot } from '../src/code-host/github.ts';

const lookup = { issuer: 'https://identity.example/realms/steer', subject: 'human-1', organizationId: 'org-a' };
const record = {
  ...lookup, type: 'human', hats: ['product-lead'], toolGrants: ['session.context'], active: true,
  expiresAt: '2026-09-04T12:01:00Z', validAfter: '2026-09-04T11:59:00Z',
};
const document = { version: 'steer-authorization/v1', organizationId: 'org-a', records: [record] };
const path = 'organization/authorization.json', revision = 'a'.repeat(40);
function fixture(value: unknown = document, change: Partial<ArtifactSnapshot> = {}, moved = false) {
  let headCalls = 0;
  const content = JSON.stringify(value);
  const reader: ArtifactReader = {
    binding: { ...lookup, installationId: 1, repositoryId: 2, owner: 'example', repository: 'operating', branch: 'main' },
    readHead: async () => ++headCalls > 1 && moved ? 'b'.repeat(40) : revision,
    readArtifact: async () => ({ organizationId: 'org-a', repositoryId: 2, revision, path, content,
      contentDigest: createHash('sha256').update(content).digest('hex'), blobSha: 'c'.repeat(40), ...change }),
  };
  return createGitAuthorizationResolver(reader, path);
}

test('read-through authorization binds current Git revision, document and exact identity', async () => {
  assert.deepEqual(await fixture()(lookup), record);
  assert.equal(await fixture()({ ...lookup, subject: 'other-human' }), null);
  assert.equal(await fixture()({ ...lookup, organizationId: 'org-b' }), null);
  assert.equal(await fixture()({ ...lookup, issuer: 'https://other.example' }), null);
});

test('transplanted artifact provenance, drifted digest or moving head never authorizes', async () => {
  for (const change of [{ organizationId: 'org-b' }, { repositoryId: 3 }, { path: 'other' },
    { revision: 'b'.repeat(40) }, { contentDigest: 'd'.repeat(64) }]) {
    assert.equal(await fixture(document, change)(lookup), null);
  }
  assert.equal(await fixture(document, {}, true)(lookup), null);
});

test('duplicate identities, cross-tenant records and unknown authority fields deny the whole document', async () => {
  for (const value of [
    { ...document, records: [record, record] },
    { ...document, records: [record, { ...record, subject: 'human-2', organizationId: 'org-b' }] },
    { ...document, organizationId: 'org-b' }, { ...document, allowAll: true },
    { ...document, records: [{ ...record, extraAuthority: true }] },
  ]) assert.equal(await fixture(value)(lookup), null);
});

test('a later source read failure cannot fall back to an earlier accepted grant', async () => {
  const resolver = fixture();
  assert.ok(await resolver(lookup));
  const failing: ArtifactReader = {
    binding: { organizationId: 'org-a', installationId: 1, repositoryId: 2, owner: 'example', repository: 'operating', branch: 'main' },
    readHead: async () => { throw new Error('private-provider-detail'); },
    readArtifact: async () => { throw new Error('must-not-read'); },
  };
  assert.equal(await createGitAuthorizationResolver(failing, path)(lookup), null);
});

function currentFixture() {
  const state = { head: revision, heads: 0, artifacts: 0, failHead: false, failArtifact: false,
    changeDuringRead: false, value: structuredClone(document) };
  const reader: ArtifactReader = {
    binding: { organizationId: 'org-a', installationId: 1, repositoryId: 2, owner: 'example', repository: 'operating', branch: 'main' },
    readHead: async () => { state.heads++; if (state.failHead) throw new Error('PRIVATE head failure'); return state.head; },
    readArtifact: async (_path, head) => {
      state.artifacts++; if (state.failArtifact) throw new Error('PRIVATE artifact failure');
      const content = JSON.stringify(state.value);
      if (state.changeDuringRead) state.head = 'c'.repeat(40);
      return { organizationId: 'org-a', repositoryId: 2, revision: head, path, content,
        contentDigest: createHash('sha256').update(content).digest('hex'), blobSha: 'c'.repeat(40) };
    },
  };
  return { state, reader, resolve: createGitAuthorizationResolver(reader, path) };
}

test('same-commit document reuse still reads fresh head per lookup and cannot be poisoned by returned records', async () => {
  const f = currentFixture(); await f.resolve.withinRequest(async () => {
  const first = await f.resolve(lookup); assert.ok(first);
  first.toolGrants.push('unauthorized'); first.hats.length = 0; first.active = false;
  for (let i = 0; i < 9; i++) assert.deepEqual(await f.resolve(lookup), record);
  assert.equal(f.state.artifacts, 1); assert.equal(f.state.heads, 11);
  assert.equal(await f.resolve({ ...lookup, subject: 'foreign' }), null);
  assert.equal(f.state.heads, 12); assert.equal(f.state.artifacts, 1);
  });
});

test('changed head rereads revocation, discards the prior commit and never caches failed or moving sources', async () => {
  const f = currentFixture(); await f.resolve.withinRequest(async () => {
  assert.ok(await f.resolve(lookup));
  f.state.head = 'b'.repeat(40); f.state.value.records[0]!.active = false;
  assert.equal((await f.resolve(lookup))!.active, false); assert.equal(f.state.artifacts, 2);
  f.state.head = revision; f.state.value = structuredClone(document); f.state.failArtifact = true;
  assert.equal(await f.resolve(lookup), null); assert.equal(f.state.artifacts, 3);
  f.state.failArtifact = false; f.state.changeDuringRead = true;
  assert.equal(await f.resolve(lookup), null); assert.equal(f.state.artifacts, 4);
  f.state.changeDuringRead = false; assert.ok(await f.resolve(lookup)); assert.equal(f.state.artifacts, 5);
  });
});

test('fresh-head failure clears retained bytes, and binding or reader replacement denies even at the old head', async () => {
  const f = currentFixture(); await f.resolve.withinRequest(async () => {
  assert.ok(await f.resolve(lookup)); f.state.failHead = true;
  assert.equal(await f.resolve(lookup), null); f.state.failHead = false; f.state.failArtifact = true;
  assert.equal(await f.resolve(lookup), null); assert.equal(f.state.artifacts, 2);
  });
  for (const change of ['binding', 'head', 'artifact'] as const) {
    const f = currentFixture(); assert.ok(await f.resolve(lookup));
    if (change === 'binding') (f.reader.binding as { branch: string }).branch = 'foreign';
    if (change === 'head') f.reader.readHead = async () => revision;
    if (change === 'artifact') f.reader.readArtifact = async () => { throw new Error('PRIVATE replaced'); };
    assert.equal(await f.resolve(lookup), null);
  }
});

test('request snapshots never survive completion or cross concurrent requests; unscoped lookups remain read-through', async () => {
  const f = currentFixture();
  for (let i = 0; i < 2; i++) await f.resolve.withinRequest(async () => {
    assert.ok(await f.resolve(lookup)); assert.ok(await f.resolve(lookup));
  });
  assert.equal(f.state.artifacts, 2);
  f.state.failArtifact = true;
  assert.equal(await f.resolve.withinRequest(() => f.resolve(lookup)), null);
  f.state.failArtifact = false;
  await Promise.all([f.resolve.withinRequest(() => f.resolve(lookup)), f.resolve.withinRequest(() => f.resolve(lookup))]);
  assert.equal(f.state.artifacts, 5);
  await f.resolve(lookup); await f.resolve(lookup); assert.equal(f.state.artifacts, 7);
});

test('late work from a completed request cannot revive its snapshot or authorize through a new request', async () => {
  const f = currentFixture(); let release!: () => void, late!: Promise<unknown>;
  const held = new Promise<void>(resolve => { release = resolve; });
  await f.resolve.withinRequest(async () => {
    assert.ok(await f.resolve(lookup));
    late = held.then(() => f.resolve(lookup));
  });
  await f.resolve.withinRequest(async () => { assert.ok(await f.resolve(lookup)); release(); assert.equal(await late, null); });
  assert.equal(f.state.artifacts, 2);
});

test('resolver closure disables async context and denies unscoped, new and late authorization without provider access', async () => {
  const f = currentFixture(); let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const observed = new Promise<void>(resolve => { entered = resolve; });
  const pending = f.resolve.withinRequest(async () => { assert.ok(await f.resolve(lookup)); entered(); await held; return f.resolve(lookup); });
  await observed; f.resolve.close(); f.resolve.close();
  const calls = f.state.heads; release(); assert.equal(await pending, null);
  assert.equal(await f.resolve(lookup), null); assert.equal(f.state.heads, calls);
  await assert.rejects(f.resolve.withinRequest(() => f.resolve(lookup)), /closed/);
});
