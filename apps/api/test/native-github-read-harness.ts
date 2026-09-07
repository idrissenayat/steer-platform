import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { promisify } from 'node:util';
import { jwtVerify } from 'jose';
import type { createGitAuthorizationHarness } from './git-authorization-harness.ts';

/** Read-only provider HTTP fixture over the owned native Git repository. No network fallback. */
export function createNativeGitHubReadHarness(source: Awaited<ReturnType<typeof createGitAuthorizationHarness>>, certificate: Buffer) {
  const exec = promisify(execFile), binding = source.reader.binding;
  const publicKey = new X509Certificate(certificate).publicKey;
  const repo = `/repos/${binding.owner}/${binding.repository}`;
  let assertions = 0, reads = 0, histories = 0, comparisons = 0;
  const git = async (...args: string[]) => (await exec('git', ['-C', source.directory,
    '-c', 'core.hooksPath=/dev/null', ...args], { timeout: 10000, encoding: 'buffer' })).stdout;
  const metadata = async (sha: string) => {
    const content = (await git('cat-file', '-p', sha)).toString('utf8');
    return { sha, tree: { sha: /^tree ([a-f0-9]{40})$/m.exec(content)![1] },
      parents: [...content.matchAll(/^parent ([a-f0-9]{40})$/gm)].map(value => ({ sha: value[1]! })) };
  };
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.origin, 'https://api.github.com');
    assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store'); assert.ok(init?.signal);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('X-GitHub-Api-Version'), '2026-03-10');
    if (url.pathname === `/app/installations/${binding.installationId}/access_tokens`) {
      assert.equal(init?.method, 'POST');
      const jwt = headers.get('authorization')?.replace(/^Bearer /, ''); assert.ok(jwt);
      await jwtVerify(jwt, publicKey, { issuer: '1', algorithms: ['RS256'] }); assertions++;
      assert.deepEqual(JSON.parse(String(init.body)), { repository_ids: [binding.repositoryId], permissions: { contents: 'read' } });
      return Response.json({ token: 'synthetic-browser-read', expires_at: new Date(Date.now() + 3600000).toISOString(),
        repositories: [{ id: binding.repositoryId, full_name: `${binding.owner}/${binding.repository}` }],
        permissions: { contents: 'read', metadata: 'read' } });
    }
    assert.equal(init?.method, 'GET'); assert.equal(headers.get('authorization'), 'Bearer synthetic-browser-read');
    reads++;
    if (url.pathname === `${repo}/git/ref/heads/${binding.branch}`) {
      return Response.json({ ref: `refs/heads/${binding.branch}`, object: { type: 'commit', sha: await source.reader.readHead() } });
    }
    if (url.pathname === `${repo}/commits`) {
      const revision = url.searchParams.get('sha'), path = url.searchParams.get('path');
      assert.match(revision ?? '', /^[a-f0-9]{40}$/);
      assert.match(path ?? '', /^\.steer\/authoring\/operations\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.json$/);
      assert.deepEqual([...url.searchParams.keys()].sort(), ['path', 'per_page', 'sha']); assert.equal(url.searchParams.get('per_page'), '2');
      histories++;
      const ids = (await git('log', '--format=%H', '-2', revision!, '--', path!)).toString('utf8').trim().split('\n').filter(Boolean);
      return Response.json(await Promise.all(ids.map(metadata)));
    }
    const comparison = /^\/compare\/([a-f0-9]{40})\.\.\.([a-f0-9]{40})$/.exec(url.pathname.slice(repo.length));
    if (url.pathname.startsWith(`${repo}/`) && comparison) {
      assert.equal(url.search, '?per_page=100&page=1'); comparisons++;
      const [, base, head] = comparison;
      const common = (await git('merge-base', base!, head!)).toString('utf8').trim();
      const ids = (await git('rev-list', '--reverse', '--max-count=101', `${base}..${head}`)).toString('utf8').trim().split('\n').filter(Boolean);
      const behind = Number((await git('rev-list', '--count', `${head}..${base}`)).toString('utf8').trim());
      return Response.json({ status: behind === 0 && ids.length > 0 ? 'ahead' : 'diverged', ahead_by: ids.length,
        behind_by: behind, total_commits: ids.length, base_commit: { sha: base }, merge_base_commit: { sha: common }, commits: await Promise.all(ids.map(metadata)) });
    }
    const match = /^\/git\/(commits|trees|blobs)\/([a-f0-9]{40})$/.exec(url.pathname.slice(repo.length));
    assert.ok(url.pathname.startsWith(`${repo}/`) && match, 'Unexpected synthetic provider route.');
    const [, kind, sha] = match;
    if (kind === 'commits') {
      return Response.json(await metadata(sha!));
    }
    if (kind === 'trees') {
      assert.equal(url.search, '?recursive=1');
      const tree = (await git('ls-tree', '-rz', sha!)).toString('utf8').split('\0').filter(Boolean).map(row => {
        const entry = /^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/.exec(row); assert.ok(entry);
        return { mode: entry[1], type: entry[2], sha: entry[3], path: entry[4] };
      });
      return Response.json({ sha, truncated: false, tree });
    }
    const bytes = await git('cat-file', 'blob', sha!);
    return Response.json({ sha, encoding: 'base64', size: bytes.length, content: bytes.toString('base64') });
  };
  return { transport, stats: () => ({ assertions, reads, histories, comparisons }) };
}
