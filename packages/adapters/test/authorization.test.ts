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
