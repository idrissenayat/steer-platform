import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RepositoryReader } from '../src/code-host/github.ts';
import { createProjectionJob } from '../src/code-host/projection-job.ts';
const principal = { subject: 'agent', organizationId: 'org', type: 'agent', hats: [], toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 600000).toISOString() };
const revision = 'a'.repeat(40);
const reader: RepositoryReader = { binding: { organizationId: 'org', repositoryId: 1, installationId: 1, owner: 'a', repository: 'a', branch: 'main' },
  readHead: async () => revision, readInventory: async () => ({ organizationId: 'org', repositoryId: 1, revision, treeSha: revision, entries: [] }),
  readArtifact: async () => { throw new Error(); } };
const selector = { selection: { roots: ['intent'], fileNames: ['BRIEF.md'] } };
const sink = () => ({ currentRevision: async () => null, ingest: async () => 'applied' as const });
test('shared projection job refuses invalid current agents and rechecks authority even after an empty manifest', async () => {
  for (const invalid of [null, { ...principal, type: 'human' }, { ...principal, organizationId: 'other' }, { ...principal, hats: ['product-lead'] },
    { ...principal, toolGrants: [] }, { ...principal, expiresAt: new Date(0).toISOString() }]) {
    let reads = 0;
    const job = createProjectionJob({ ...reader, readHead: async () => { reads++; return revision; } }, selector,
      { authenticate: async () => invalid, sink, shutdownResources: async () => {} });
    await assert.rejects(job.runOnce(), /not authorized/); assert.equal(reads, 0); await job.shutdown();
  }
  for (const later of [null, { ...principal, subject: 'other-agent' }]) {
    let checks = 0;
    const job = createProjectionJob(reader, selector, { authenticate: async () => ++checks === 1 ? principal : later, sink, shutdownResources: async () => {} });
    await assert.rejects(job.runOnce(), /not authorized|identity changed/); assert.equal(checks, 2); await job.shutdown();
  }
});
test('shared job shutdown holds resources until actual source work ends and never reopens admission', async () => {
  let enter!: () => void, release!: () => void; let closed = false;
  const started = new Promise<void>((resolve) => { enter = resolve; });
  const job = createProjectionJob({ ...reader, readHead: async () => { enter(); await new Promise<void>((resolve) => { release = resolve; }); return revision; } }, selector,
    { authenticate: async () => principal, sink, shutdownResources: async () => { closed = true; } });
  const run = job.runOnce(); const rejected = assert.rejects(run); await started;
  await assert.rejects(job.runOnce(), /not accepting/); const stop = job.shutdown(); assert.equal(stop, job.shutdown());
  await Promise.resolve(); assert.equal(closed, false); release(); await rejected; await stop;
  assert.equal(closed, true); assert.deepEqual(job.status(), { stopping: true, active: false }); await assert.rejects(job.runOnce());
});

test('resource shutdown failure stays closed, is sanitized and is never silently retried', async () => {
  let closes = 0;
  const job = createProjectionJob(reader, selector, { authenticate: async () => principal, sink,
    shutdownResources: async () => { closes++; throw new Error('private database failure'); } });
  const stopped = job.shutdown(); await assert.rejects(stopped, /^Error: Projection resource shutdown failed\.$/);
  assert.equal(job.shutdown(), stopped); assert.equal(closes, 1); await assert.rejects(job.runOnce(), /not accepting/);
});
