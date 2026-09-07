import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createNativeGitHubReadHarness } from './native-github-read-harness.ts';

/** TEST ONLY: no network. Permit one fixed Brief creation in the owned synthetic Git repository. */
export function createNativeGitHubCreateHarness(source: Parameters<typeof createNativeGitHubReadHarness>[0], certificate: Buffer, path: string) {
  assert.equal(path, 'items/0167-created-fixture/BRIEF.md');
  const read = createNativeGitHubReadHarness(source, certificate), exec = promisify(execFile);
  let mutations = 0, loseAck = false;
  const git = async (args: string[]) => (await exec('git', ['-C', source.directory, '-c', 'core.hooksPath=/dev/null',
    '-c', 'commit.gpgsign=false', '-c', 'user.name=Synthetic fixture', '-c', 'user.email=fixture@example.invalid', ...args],
    { timeout: 10000 })).stdout.trim();
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.origin, 'https://api.github.com');
    assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store'); assert.ok(init?.signal);
    if (url.pathname === `/app/installations/${source.reader.binding.installationId}/access_tokens` && JSON.parse(String(init?.body)).permissions.contents === 'write') {
      // The read harness verifies the actual synthetic App assertion before any token response.
      const original = JSON.parse(String(init!.body)); assert.deepEqual(original, { repository_ids: [1], permissions: { contents: 'write' } });
      const response = await read.transport(input, { ...init, body: JSON.stringify({ repository_ids: [1], permissions: { contents: 'read' } }) });
      const value = await response.json() as Record<string, unknown>;
      return Response.json({ ...value, token: 'synthetic-browser-write', permissions: { contents: 'write', metadata: 'read' } });
    }
    if (url.pathname !== '/graphql') return read.transport(input, init);
    assert.equal(init?.method, 'POST'); assert.equal(new Headers(init.headers).get('authorization'), 'Bearer synthetic-browser-write');
    const value = JSON.parse(String(init.body)); assert.match(value.query, /createCommitOnBranch/);
    const request = value.variables.input; assert.deepEqual(request.branch, { repositoryNameWithOwner: 'synthetic/synthetic', branchName: 'synthetic' });
    assert.deepEqual(Object.keys(request.fileChanges), ['additions']); const additions = request.fileChanges.additions;
    assert.equal(additions.length, 2); const brief = additions.find((entry: { path: string }) => entry.path === path);
    const marker = additions.find((entry: { path: string }) => /^\.steer\/authoring\/operations\/[a-f0-9-]{36}\.json$/.test(entry.path));
    assert.ok(brief && marker); assert.equal(await source.reader.readHead(), request.expectedHeadOid);
    assert.equal(await git(['ls-tree', '-r', '--name-only', request.expectedHeadOid, '--', path, marker.path]), '');
    await git(['read-tree', request.expectedHeadOid]);
    for (const entry of additions) {
      // execFile cannot supply stdin; hash the exact base64 bytes through the owned process pipe.
      const content = Buffer.from(entry.contents, 'base64');
      const blob = await new Promise<string>((resolve, reject) => {
        const child = execFile('git', ['-C', source.directory, 'hash-object', '-w', '--stdin'], { timeout: 10000 }, (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
        child.stdin!.end(content);
      });
      await git(['update-index', '--add', '--cacheinfo', '100644', blob, entry.path]);
    }
    const tree = await git(['write-tree']), revision = await git(['commit-tree', tree, '-p', request.expectedHeadOid, '-m', 'Synthetic browser Brief creation']);
    await git(['update-ref', 'refs/heads/synthetic', revision, request.expectedHeadOid]); mutations++;
    if (loseAck) throw new Error('Synthetic lost acknowledgement');
    return Response.json({ data: { createCommitOnBranch: { commit: { oid: revision }, ref: { name: 'synthetic' } } } });
  };
  return { transport, mutations: () => mutations, loseAck: () => { loseAck = true; } };
}
