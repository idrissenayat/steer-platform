import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ArtifactReader } from '@steer/adapters/github';
import type { AuthorizationRecord } from '@steer/adapters/identity';

/** Synthetic local commits, not a GitHub installation or a production reader. */
export async function createGitAuthorizationHarness(temporary: string, record: AuthorizationRecord) {
  const directory = join(temporary, 'synthetic-authorization');
  await mkdir(join(directory, 'access'), { recursive: true, mode: 0o700 });
  const exec = promisify(execFile);
  const git = async (...args: string[]) => (await exec('git', ['-c', 'core.hooksPath=/dev/null',
    '-c', 'commit.gpgsign=false', '-c', 'user.name=STEER synthetic fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { cwd: directory, timeout: 10000 })).stdout.trim();
  await git('init', '--initial-branch=synthetic', '--object-format=sha1');
  const authorizationPath = 'access/authorization.json';
  const publish = async (records: AuthorizationRecord[], organizationId = record.organizationId) => {
    await writeFile(join(directory, authorizationPath), JSON.stringify({ version: 'steer-authorization/v1', organizationId, records }), { mode: 0o600 });
    await git('add', '--', authorizationPath);
    await git('commit', '--allow-empty', '-m', 'Synthetic membership revision');
    return git('rev-parse', 'HEAD');
  };
  await publish([record]);
  let fault: 'none' | 'unavailable' | 'moving-head' | 'digest' = 'none';
  let headReads = 0;
  const reader: ArtifactReader = {
    binding: Object.freeze({ organizationId: record.organizationId, repositoryId: 1, installationId: 1,
      owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' }),
    async readHead() {
      if (fault === 'unavailable') throw new Error('Synthetic source unavailable.');
      const head = await git('rev-parse', 'HEAD');
      if (fault === 'moving-head' && ++headReads % 2 === 0) return '0'.repeat(40);
      return head;
    },
    async readArtifact(path, revision) {
      if (path !== authorizationPath || !/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid synthetic source request.');
      const content = await git('show', `${revision}:${path}`);
      return { organizationId: record.organizationId, repositoryId: 1, revision, path, content,
        contentDigest: fault === 'digest' ? '0'.repeat(64) : createHash('sha256').update(content).digest('hex'),
        blobSha: await git('rev-parse', `${revision}:${path}`) };
    },
  };
  return { reader, authorizationPath, publish, setFault(value: typeof fault) { fault = value; headReads = 0; } };
}
