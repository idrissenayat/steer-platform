import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { bundleWorkflowCode, DefaultLogger } from '@temporalio/worker';

// Shared exact official test binary. No real cluster or persistent database.
const version = '1.8.3';
const archives: Record<string, { name: string; digest: string }> = {
  'darwin-arm64': { name: 'darwin_arm64', digest: '77c5bef1753ddfcdcaced2a2d44207aeced1c776e7bcbf94520c7911bd0c4080' },
  'darwin-x64': { name: 'darwin_amd64', digest: '0eed9a02008ba0d1c5417fc1aa706c9016166eae7216ae161ad95eccc6a775ca' },
  'linux-arm64': { name: 'linux_arm64', digest: '5972ce781d7f28644b353e4177007e7da8e48a316b8458267054b24de2308e09' },
  'linux-x64': { name: 'linux_amd64', digest: '6f0afac1e9ddea71f480c43a49f5db5167a244c21db923707f069a79bcabdfea' },
};
export async function createIsolatedTemporalHarness() {
  const binary = archives[`${process.platform}-${process.arch}`]; assert.ok(binary, 'Unsupported isolated Temporal fixture platform.');
  // Preserve the existing child-process fixture's owned-directory guard.
  const directory = await mkdtemp(join(tmpdir(), 'steer-temporal-0036-')), exec = promisify(execFile);
  let environment: TestWorkflowEnvironment | undefined, closed = false;
  const close = async () => {
    if (closed) return;
    try { await environment?.teardown(); }
    finally { await rm(directory, { recursive: true, force: true }); closed = true; }
  };
  try {
    const archive = join(directory, 'temporal.tar.gz');
    await exec('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '60', '--output', archive,
      `https://github.com/temporalio/cli/releases/download/v${version}/temporal_cli_${version}_${binary.name}.tar.gz`], { timeout: 65000 });
    assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'), binary.digest);
    await exec('tar', ['-xzf', archive, '-C', directory, 'temporal'], { timeout: 10000 });
    console.log((await exec(join(directory, 'temporal'), ['--version'])).stdout.trim());
    environment = await TestWorkflowEnvironment.createLocal({ server: { executable: { type: 'existing-path', path: join(directory, 'temporal') },
      ip: '127.0.0.1', ui: false, log: { format: 'json', level: 'error' } } });
    const bundle = await bundleWorkflowCode({ workflowsPath: fileURLToPath(new URL('../src/workflows.ts', import.meta.url)), logger: new DefaultLogger('ERROR') });
    return { environment, bundle, directory, close };
  } catch (error) { await close(); throw error; }
}
