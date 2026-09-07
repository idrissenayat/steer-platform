import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { createGitAuthorizationHarness } from './git-authorization-harness.ts';

/** Seed exactly two new leaves in the owned disposable Git repo. This is test
 * history, NOT a successful platform save, provider attestation or human approval. */
export async function seedBriefMarker(source: Awaited<ReturnType<typeof createGitAuthorizationHarness>>, subject: string) {
  const exec = promisify(execFile);
  const git = async (...args: string[]) => (await exec('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false',
    '-c', 'user.name=STEER synthetic fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: source.directory, timeout: 10000 })).stdout.trim();
  assert.equal(await git('status', '--porcelain'), '');
  const path = 'items/0156-recorded-fixture/BRIEF.md', idempotencyKey = '15600000-0000-4000-8000-000000000001';
  const content = '# Brief: Disposable recorded operation\n\nThis is seeded fixture history, not a platform save.\n';
  const expectedHead = await git('rev-parse', 'HEAD');
  const contentDigest = createHash('sha256').update(content).digest('hex');
  const blobSha = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
  const reference = { organizationId: source.reader.binding.organizationId, repository: `github:${source.reader.binding.repositoryId}`,
    branch: source.reader.binding.branch, path, subject, idempotencyKey };
  const requestDigest = createHash('sha256').update('0156 synthetic prior request; not an authority claim').digest('hex');
  const marker = { ...reference, version: 'steer-brief-operation/v1', expectedHead, contentDigest, blobSha, requestDigest };
  const markerPath = `.steer/authoring/operations/${idempotencyKey}.json`;
  for (const [relative, bytes] of [[path, content], [markerPath, `${JSON.stringify(marker)}\n`]] as const) {
    await mkdir(dirname(join(source.directory, relative)), { recursive: true, mode: 0o700 });
    await writeFile(join(source.directory, relative), bytes, { flag: 'wx', mode: 0o600 });
  }
  await git('add', '--', path, markerPath);
  assert.deepEqual((await git('diff', '--cached', '--name-only')).split('\n').sort(), [path, markerPath].sort());
  await git('commit', '-m', 'Seed disposable prior operation, not a platform save');
  const revision = await git('rev-parse', 'HEAD');
  return { reference, markerPath, content, receipt: { ...reference, outcome: 'committed' as const, expectedHead, revision, contentDigest, blobSha, requestDigest } };
}
