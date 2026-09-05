import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import type { Worker, WorkflowBundle } from '@temporalio/worker';
import { matchesArtifactSelection, type RepositoryReader } from '@steer/adapters/github';
import { createWorkerGateObservationRuntime } from '../src/runtime.ts';
import { createGateWatchWorker } from '../src/worker.ts';
import { startGateWatch } from '../src/client.ts';
import type { GateTarget } from '../src/contracts.ts';

/** Actual owned Git commits; all subjects and records are synthetic and carry no real approval. */
export async function testGitGateSource(env: TestWorkflowEnvironment, bundle: WorkflowBundle, temporary: string,
  check: (name: string, run: () => Promise<void>) => Promise<void>) {
  const directory = join(temporary, 'gate-source'); await mkdir(join(directory, 'gates'), { recursive: true });
  const exec = promisify(execFile);
  const git = async (...args: string[]) => (await exec('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false',
    '-c', 'user.name=Synthetic fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: directory, timeout: 10000 })).stdout.trim();
  const scope = { organizationId: 'synthetic-org', repository: 'github:1', itemId: 'intent/0042' };
  const principal = { subject: 'synthetic-observer', organizationId: scope.organizationId, type: 'agent', hats: [], toolGrants: ['gate.observe'], expiresAt: new Date(Date.now() + 600000).toISOString() };
  await git('init', '--initial-branch=synthetic', '--object-format=sha1');
  await writeFile(join(directory, 'BRIEF.md'), '# Synthetic gate artifact\n', { mode: 0o600 });
  await writeFile(join(directory, 'access.json'), JSON.stringify(principal), { mode: 0o600 });
  const commit = async () => { await git('add', '--', 'BRIEF.md', 'access.json', 'gates'); await git('commit', '--allow-empty', '-m', 'Synthetic gate fixture'); return git('rev-parse', 'HEAD'); };
  const revision = await commit();
  const allowed = new Set(['BRIEF.md', 'gates/record.json']);
  const reader: RepositoryReader = {
    binding: { organizationId: scope.organizationId, repositoryId: 1, installationId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' },
    readHead: () => git('rev-parse', 'HEAD'),
    readInventory: async (selection, at) => {
      assert.match(at, /^[a-f0-9]{40}$/);
      const raw = (await exec('git', ['ls-tree', '-rz', at], { cwd: directory, timeout: 10000 })).stdout;
      const entries = raw.split('\0').filter(Boolean).flatMap((row) => {
        const match = /^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/.exec(row); assert.ok(match);
        const [, mode, type, blobSha, path] = match;
        if (!matchesArtifactSelection(path!, selection)) return [];
        assert.equal(mode, '100644'); assert.equal(type, 'blob'); return [{ path: path!, blobSha: blobSha! }];
      });
      return { organizationId: scope.organizationId, repositoryId: 1, revision: at, treeSha: await git('rev-parse', `${at}^{tree}`), entries };
    },
    readArtifact: async (path, at) => {
      assert.ok(allowed.has(path)); assert.match(at, /^[a-f0-9]{40}$/);
      const content = (await exec('git', ['show', `${at}:${path}`], { cwd: directory, timeout: 10000 })).stdout;
      return { organizationId: scope.organizationId, repositoryId: 1, revision: at, path, content,
        blobSha: await git('rev-parse', `${at}:${path}`), contentDigest: createHash('sha256').update(content).digest('hex') };
    },
  };
  const target: GateTarget = { scope, gate: 2, artifactRevision: revision };
  const source = { artifactPaths: ['BRIEF.md'], recordPath: 'gates/record.json', recordItem: 'synthetic-item' };
  let runtime: ReturnType<typeof createWorkerGateObservationRuntime> | undefined, worker: Worker | undefined, running: Promise<void> | undefined;
  const queue = 'steer-0042-git-gates';
  const start = async (current: GateTarget) => {
    const owned = createWorkerGateObservationRuntime(current, source, { reader, authenticate: async () => JSON.parse(await git('show', 'HEAD:access.json')) }); runtime = owned;
    worker = await createGateWatchWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: bundle }, current,
      { observe: () => owned.activities.observeGate(current) }); running = worker.run();
  };
  const stop = async () => { if (worker) { worker.shutdown(); await running; worker = undefined; running = undefined; } await runtime?.shutdown(); runtime = undefined; };
  const wait = async (handle: { query(name: string): Promise<unknown> }) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await handle.query('gateWatchProgress') as { phase: string }).phase === 'waiting') return; } catch { /* Initial SDK polling. */ }
      await delay(50);
    }
    throw new Error('Synthetic gate watch did not reach durable wait.');
  };
  try {
    await start(target);
    await check('actual Git record commit is observed after gate worker/runtime recreation without converting send-back into approval', async () => {
      const handle = await startGateWatch(env.client, queue, { target, rounds: 2, intervalMs: 3000 }); await wait(handle); await stop();
      const record = { version: 'steer-gate-signature/v1', organization: scope.organizationId, productHome: 'https://github.com/synthetic/synthetic',
        item: source.recordItem, gate: 2, artifactRevision: revision, decision: 'send-back', artifacts: [{ path: 'BRIEF.md', revision }],
        signatures: [{ subject: 'synthetic-human-not-a-real-signature', hat: 'tech-lead', sequence: 1, signedAt: new Date().toISOString() }] };
      const bytes = JSON.stringify(record); await writeFile(join(directory, source.recordPath), bytes, { mode: 0o600 }); const head = await commit();
      await start(target);
      assert.deepEqual(await handle.result(), { outcome: 'decision-recorded', completed: 2, checkpoint: {
        sourceRevision: head, artifactRevision: revision, decisionDigest: createHash('sha256').update(bytes).digest('hex'),
      } });
      await writeFile(join(directory, 'BRIEF.md'), '# Changed synthetic gate artifact\n', { mode: 0o600 }); const changed = await commit();
      assert.deepEqual(await runtime!.activities.observeGate(target), { sourceRevision: changed, artifactRevision: changed, decisionDigest: null });
    });
    await stop();
    const revokedTarget: GateTarget = { ...target, gate: 3, artifactRevision: await reader.readHead() };
    // The old gate-2 record is not a gate-3 record; explicitly use an absent path in this second fixed source binding.
    source.recordPath = 'gates/missing.json'; allowed.add(source.recordPath); await start(revokedTarget);
    await check('Git-committed observer revocation while stopped denies the later gate round after fresh startup', async () => {
      const handle = await startGateWatch(env.client, queue, { target: revokedTarget, rounds: 2, intervalMs: 3000 }); await wait(handle); await stop();
      await writeFile(join(directory, 'access.json'), JSON.stringify({ ...principal, toolGrants: [] }), { mode: 0o600 }); await commit();
      await start(revokedTarget); await assert.rejects(handle.result());
    });
  } finally { await stop(); }
}
