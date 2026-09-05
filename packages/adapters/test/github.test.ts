import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { generateKeyPair, exportPKCS8, jwtVerify } from 'jose';
import { createAppJwtSigner, createGitHubReader, CodeHostError, type GitHubBinding } from '../src/code-host/github.ts';

const now = new Date('2026-09-04T12:00:00Z');
const binding: GitHubBinding = { organizationId: 'org-a', installationId: 1, repositoryId: 2, owner: 'example', repository: 'operating', branch: 'main' };
const revision = 'a'.repeat(40), treeSha = 'b'.repeat(40), path = 'organization/authorization.json';
const bytes = Buffer.from('{"version":"test"}\n');
const blobSha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const responses = {
  token: { token: 'synthetic-installation-token', expires_at: new Date(now.getTime() + 3600000).toISOString(), permissions: { contents: 'read', metadata: 'read' }, repositories: [{ id: 2, full_name: 'example/operating' }] },
  head: { ref: 'refs/heads/main', object: { type: 'commit', sha: revision } },
  commit: { sha: revision, tree: { sha: treeSha } },
  tree: { sha: treeSha, truncated: false, tree: [{ path, type: 'blob', mode: '100644', sha: blobSha }] },
  blob: { sha: blobSha, encoding: 'base64', size: bytes.length, content: bytes.toString('base64') },
};
type Stage = keyof typeof responses;
function fixture(overrides: Partial<Record<Stage, unknown>> = {}, clock = () => now) {
  const calls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    assert.equal(url.origin, 'https://api.github.com'); assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('X-GitHub-Api-Version'), '2026-03-10');
    let stage: Stage;
    if (url.pathname === '/app/installations/1/access_tokens') {
      stage = 'token'; assert.equal(init?.method, 'POST'); assert.equal(headers.get('authorization'), 'Bearer synthetic-app-jwt');
      assert.deepEqual(JSON.parse(String(init.body)), { repository_ids: [2], permissions: { contents: 'read' } });
    } else {
      assert.equal(init?.method, 'GET'); assert.equal(headers.get('authorization'), 'Bearer synthetic-installation-token');
      if (url.pathname.endsWith('/git/ref/heads/main')) stage = 'head';
      else if (url.pathname.endsWith(`/git/commits/${revision}`)) stage = 'commit';
      else if (url.pathname.endsWith(`/git/trees/${treeSha}`)) { stage = 'tree'; assert.equal(url.search, '?recursive=1'); }
      else if (/\/git\/blobs\/[a-f0-9]{40}$/.test(url.pathname)) stage = 'blob';
      else throw new Error('Unexpected transport path');
    }
    const body = stage in overrides ? overrides[stage] : responses[stage];
    return body instanceof Response ? body : Response.json(body);
  };
  return { calls, reader: createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch, now: clock }) };
}
const safeFailure = (cause: unknown) => cause instanceof CodeHostError && !cause.message.includes('synthetic');

test('GitHub reader uses one scoped token and returns exact-commit verified artifact bytes', async () => {
  const { reader, calls } = fixture();
  assert.equal(await reader.readHead(), revision);
  assert.deepEqual(await reader.readArtifact(path, revision), {
    organizationId: 'org-a', repositoryId: 2, revision, path, content: bytes.toString(), blobSha,
    contentDigest: createHash('sha256').update(bytes).digest('hex'),
  });
  assert.equal(await reader.readHead(), revision);
  assert.equal(calls.filter((url) => url.includes('access_tokens')).length, 1);
});

test('broader permissions, another repository and stale or overlong tokens fail closed', async () => {
  for (const change of [
    { permissions: { contents: 'write' } }, { permissions: { contents: 'read', issues: 'read' } },
    { repositories: [] }, { repositories: [{ id: 3, full_name: 'example/operating' }] },
    { repositories: [{ id: 2, full_name: 'example/other' }] },
    { expires_at: now.toISOString() }, { expires_at: new Date(now.getTime() + 7200000).toISOString() },
  ]) await assert.rejects(fixture({ token: { ...responses.token, ...change } }).reader.readHead(), safeFailure);
});

test('invalid path or mutable revision is rejected before any network request', async () => {
  const { reader, calls } = fixture();
  for (const invalid of ['../secret', '/absolute', 'a//b', 'a/./b', 'a/../b', 'a\\b', 'a\0b']) {
    await assert.rejects(reader.readArtifact(invalid, revision), safeFailure);
  }
  await assert.rejects(reader.readArtifact(path, 'main'), safeFailure);
  assert.equal(calls.length, 0);
  assert.throws(() => createGitHubReader({ ...binding, repository: '..' }, { appJwt: async () => '' }), CodeHostError);
});

test('wrong commit/tree identity, truncated trees, symlinks and duplicate paths deny', async () => {
  const entry = responses.tree.tree[0]!;
  for (const overrides of [
    { commit: { ...responses.commit, sha: 'c'.repeat(40) } },
    { tree: { ...responses.tree, sha: 'c'.repeat(40) } },
    { tree: { ...responses.tree, truncated: true } },
    { tree: { ...responses.tree, tree: [{ ...entry, mode: '120000' }] } },
    { tree: { ...responses.tree, tree: [{ ...entry, type: 'commit', mode: '160000' }] } },
    { tree: { ...responses.tree, tree: [entry, entry] } },
  ]) await assert.rejects(fixture(overrides).reader.readArtifact(path, revision), safeFailure);
});

test('incorrect blob identity, bytes, size, encoding and noncanonical base64 deny', async () => {
  for (const change of [
    { sha: 'c'.repeat(40) }, { content: Buffer.from('changed').toString('base64') },
    { size: bytes.length + 1 }, { size: 600000 }, { encoding: 'utf-8' }, { content: 'not-base64!' },
  ]) await assert.rejects(fixture({ blob: { ...responses.blob, ...change } }).reader.readArtifact(path, revision), safeFailure);
});

test('redirects, private provider error responses and oversized streams are not accepted or echoed', async () => {
  for (const response of [
    new Response('synthetic-private-provider-message', { status: 403 }),
    new Response(null, { status: 302, headers: { location: 'https://other.example' } }),
    new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'content-length': '2' } }),
  ]) await assert.rejects(fixture({ head: response }).reader.readHead(), safeFailure);
});

test('App JWT signer uses RSA, configured issuer and a bounded nine-minute issued-at interval', async () => {
  const keys = await generateKeyPair('RS256', { extractable: true });
  const signer = createAppJwtSigner('12345', await exportPKCS8(keys.privateKey), () => now);
  const result = await jwtVerify(await signer(), keys.publicKey, { issuer: '12345', currentDate: now, algorithms: ['RS256'] });
  assert.equal(result.payload.exp! - result.payload.iat!, 540);
  assert.throws(() => createAppJwtSigner('12345', 'synthetic-invalid-key'), CodeHostError);
  assert.throws(() => createAppJwtSigner('0', 'synthetic-invalid-key'), CodeHostError);
});

test('token refresh margin triggers a new restricted request and never reuses a near-expiry token', async () => {
  let current = now;
  const { reader, calls } = fixture({}, () => current);
  assert.equal(await reader.readHead(), revision);
  current = new Date(now.getTime() + 3540000);
  await assert.rejects(reader.readHead(), safeFailure);
  assert.equal(calls.filter((url) => url.includes('access_tokens')).length, 2);
});

test('valid blob hashes do not hide invalid UTF-8 and UTF-8 BOM bytes are preserved', async () => {
  for (const data of [Buffer.from([0xff]), Buffer.from('\ufeffsource-faithful')]) {
    const digest = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
    const source = fixture({
      tree: { ...responses.tree, tree: [{ ...responses.tree.tree[0], sha: digest }] },
      blob: { sha: digest, size: data.length, encoding: 'base64', content: data.toString('base64') },
    }).reader;
    if (data[0] === 0xff) await assert.rejects(source.readArtifact(path, revision), safeFailure);
    else assert.equal((await source.readArtifact(path, revision)).content, data.toString());
  }
});

test('inventory returns only exact-root and filename-selected regular artifacts at the requested revision', async () => {
  const entry = responses.tree.tree[0]!;
  const f = fixture({ tree: { ...responses.tree, tree: [
    { ...entry, path: 'intent/0002/SPEC.md' }, { ...entry, path: 'intent/0001/BRIEF.md' },
    { ...entry, path: 'intent-extra/0001/BRIEF.md' }, { ...entry, path: 'intent/0001/notes.txt' },
    { ...entry, path: 'tools/run', mode: '100755' }, { ...entry, path: 'intent', mode: '040000', type: 'tree' },
  ] } });
  assert.deepEqual(await f.reader.readInventory({ roots: ['intent'], fileNames: ['BRIEF.md', 'SPEC.md'] }, revision), {
    organizationId: binding.organizationId, repositoryId: binding.repositoryId, revision, treeSha,
    entries: [{ path: 'intent/0001/BRIEF.md', blobSha }, { path: 'intent/0002/SPEC.md', blobSha }],
  });
  assert.equal(f.calls.length, 3); assert.ok(!f.calls.some((url) => url.includes('/git/blobs/')));
  assert.deepEqual((await f.reader.readInventory({ roots: ['other'], fileNames: ['BRIEF.md'] }, revision)).entries, []);
});

test('invalid inventory selectors and mutable revisions deny before provider requests', async () => {
  const f = fixture();
  for (const selection of [{ roots: [], fileNames: ['BRIEF.md'] }, { roots: ['../intent'], fileNames: ['BRIEF.md'] },
    { roots: ['intent', 'intent/nested'], fileNames: ['BRIEF.md'] }, { roots: ['', 'intent'], fileNames: ['BRIEF.md'] },
    { roots: ['intent'], fileNames: ['BRIEF.md', 'BRIEF.md'] }, { roots: ['intent'], fileNames: ['x/BRIEF.md'] }]) {
    await assert.rejects(f.reader.readInventory(selection, revision), safeFailure);
  }
  await assert.rejects(f.reader.readInventory({ roots: [''], fileNames: ['BRIEF.md'] }, 'main'), safeFailure);
  assert.equal(f.calls.length, 0);
});

test('inventory rejects incomplete, ambiguous, oversized and nonregular selected trees instead of skipping entries', async () => {
  const entry = { ...responses.tree.tree[0]!, path: 'intent/0001/BRIEF.md' };
  for (const tree of [
    { ...responses.tree, truncated: true }, { ...responses.tree, sha: 'c'.repeat(40) },
    { ...responses.tree, tree: [entry, entry] }, { ...responses.tree, tree: [{ ...entry, path: '../intent/BRIEF.md' }] },
    ...['100755', '120000', 'unknown'].map((mode) => ({ ...responses.tree, tree: [{ ...entry, mode }] })),
    { ...responses.tree, tree: [{ ...entry, type: 'commit', mode: '160000' }] },
    { ...responses.tree, tree: Array.from({ length: 101 }, (_, i) => ({ ...entry, path: `intent/${i}/BRIEF.md` })) },
    { ...responses.tree, tree: Array.from({ length: 10001 }, (_, i) => ({ ...entry, path: `other/${i}/note` })) },
  ]) await assert.rejects(fixture({ tree }).reader.readInventory({ roots: ['intent'], fileNames: ['BRIEF.md'] }, revision), safeFailure);
  await assert.rejects(fixture({ commit: { ...responses.commit, sha: 'c'.repeat(40) } }).reader.readInventory({ roots: [''], fileNames: ['BRIEF.md'] }, revision), safeFailure);
});
