import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordedBriefActivities } from '../src/activities.ts';
import { parseRecordedBriefTarget, recordedBriefWorkflowId, parseRecordedBriefCheckpoint } from '../src/contracts.ts';
import { createWorkerRecordedBriefRuntime } from '../src/runtime.ts';
import { startRecordedBriefProjection } from '../src/client.ts';
import type { Client } from '@temporalio/client';
import type { ArtifactReader } from '@steer/adapters/github';

const scope = { organizationId: 'synthetic', repository: 'github:1', itemId: 'items/0165-fixture' };
const target = { scope, idempotencyKey: '16500000-0000-4000-8000-000000000001' };
const checkpoint = { revision: 'a'.repeat(40), status: 'observed' as const, outcome: 'applied' as const };
const database = { host: '127.0.0.1', port: 5432, database: 'synthetic', transport: { kind: 'isolated-loopback-test' } };
const source = { branch: 'synthetic', path: `${scope.itemId}/BRIEF.md`, subject: 'synthetic-human' };
const options = { target, database, source }, secrets = { databasePassword: 'unused-synthetic-password' };
function fixture() {
  let reads = 0, receipts = 0;
  const reader: ArtifactReader = { binding: { organizationId: scope.organizationId, repositoryId: 1, installationId: 1,
    owner: 'synthetic', repository: 'synthetic', branch: source.branch },
    readHead: async () => { reads++; throw new Error('private source'); }, readArtifact: async () => { reads++; throw new Error('private source'); } };
  const principal = { subject: 'synthetic-projector', organizationId: scope.organizationId, type: 'agent', hats: [],
    toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 600000).toISOString() };
  return { reader, authenticate: async (): Promise<unknown> => principal,
    readReceipt: async (): Promise<unknown> => { receipts++; throw new Error('private receipt'); }, counts: () => ({ reads, receipts }) };
}
test('recorded targets and checkpoints are exact, bounded and content-free', () => {
  assert.deepEqual(parseRecordedBriefTarget(target), target);
  assert.deepEqual(parseRecordedBriefCheckpoint(checkpoint), checkpoint);
  assert.deepEqual(parseRecordedBriefCheckpoint({ ...checkpoint, status: 'different-revision', outcome: null }), { ...checkpoint, status: 'different-revision', outcome: null });
  for (const invalid of [{ ...target, receipt: {} }, { ...target, idempotencyKey: target.idempotencyKey + '\n' },
    { ...target, idempotencyKey: 'arbitrary' }, { ...target, scope: { ...scope, token: 'secret' } }]) assert.throws(() => parseRecordedBriefTarget(invalid));
  for (const invalid of [{ ...checkpoint, content: 'private' }, { ...checkpoint, status: 'approved' },
    { ...checkpoint, outcome: null }, { ...checkpoint, status: 'different-revision' }, { ...checkpoint, revision: 'unknown' },
    { ...checkpoint, revision: checkpoint.revision + '\n' }]) assert.throws(() => parseRecordedBriefCheckpoint(invalid));
  for (const changed of [{ ...target, scope: { ...scope, organizationId: 'other' } }, { ...target, scope: { ...scope, repository: 'github:2' } },
    { ...target, scope: { ...scope, itemId: 'items/0165-other' } }, { ...target, idempotencyKey: '16500000-0000-4000-8000-000000000002' }]) {
    assert.notEqual(recordedBriefWorkflowId(target), recordedBriefWorkflowId(changed));
  }
});
test('fixed activity rejects foreign operations and sanitizes malformed or failed results without overlap', async () => {
  let calls = 0, release!: () => void;
  const activities = createRecordedBriefActivities(target, { runOnce: async () => {
    calls++; await new Promise<void>(resolve => { release = resolve; }); return { ...checkpoint, secret: 'private receipt' };
  } });
  await assert.rejects(activities.projectRecordedBrief({ ...target, idempotencyKey: '16500000-0000-4000-8000-000000000002' }));
  assert.equal(calls, 0); const pending = activities.projectRecordedBrief(target);
  await assert.rejects(activities.projectRecordedBrief(target), /already active/); release();
  await assert.rejects(pending, /^Error: Recorded Brief projection did not complete\.$/); assert.equal(calls, 1);
});
test('client sends only exact reference, rejects duplicate IDs and bounds execution without automatic workflow retries', async () => {
  let request: unknown;
  const client = { workflow: { start: async (name: string, value: unknown) => { assert.equal(name, 'projectRecordedBrief'); request = value; } } } as unknown as Client;
  await startRecordedBriefProjection(client, 'synthetic-receipts', target);
  const value = request as { args: unknown[]; workflowId: string; workflowExecutionTimeout: string; retry?: unknown; workflowIdReusePolicy: string; workflowIdConflictPolicy: string };
  assert.deepEqual(value.args, [target]); assert.equal(value.workflowId, recordedBriefWorkflowId(target));
  assert.equal(value.workflowExecutionTimeout, '5 minutes'); assert.equal(value.retry, undefined);
  assert.equal(value.workflowIdReusePolicy, 'REJECT_DUPLICATE'); assert.equal(value.workflowIdConflictPolicy, 'FAIL');
  assert.throws(() => startRecordedBriefProjection(client, 'invalid queue', target));
  assert.throws(() => startRecordedBriefProjection(client, 'synthetic', { ...target, receipt: {} }));
});
test('owned recorded worker rejects invalid bindings without source access and closes its lazy pool', async () => {
  const f = fixture();
  for (const invalid of [{ ...options, token: 'private' }, { ...options, source: { ...source, path: 'items/0165-other/BRIEF.md' } },
    { ...options, source: { ...source, subject: '' } }, { ...options, source: { ...source, branch: 'other' } },
    { ...options, target: { ...target, scope: { ...scope, organizationId: 'foreign' } } },
    { ...options, target: { ...target, scope: { ...scope, repository: 'github:2' } } },
    { ...options, database: { ...database, host: 'remote.invalid' } }, { ...options, database: { ...database, user: 'postgres' } }]) {
    await assert.rejects(createWorkerRecordedBriefRuntime(invalid, secrets, f), /configuration could not be initialized/);
  }
  await assert.rejects(createWorkerRecordedBriefRuntime(options, { ...secrets, providerKey: 'private' }, f));
  const runtime = await createWorkerRecordedBriefRuntime(options, secrets, f);
  assert.equal(runtime.status().database.connections, 0); assert.deepEqual(f.counts(), { reads: 0, receipts: 0 });
  await assert.rejects(runtime.activities.projectRecordedBrief(target), /^Error: Recorded Brief projection did not complete\.$/);
  assert.deepEqual(f.counts(), { reads: 0, receipts: 1 }); assert.equal(runtime.status().database.connections, 0);
  const closed = runtime.shutdown(); assert.equal(closed, runtime.shutdown()); await closed;
  assert.equal(runtime.status().database.closed, true); await assert.rejects(runtime.activities.projectRecordedBrief(target));
});
test('receipt worker denies invalid projectors before readback and drains actual admitted work before closing', async () => {
  for (const principal of [null, { subject: 'human', organizationId: scope.organizationId, type: 'human', hats: [],
    toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 60000).toISOString() }]) {
    const f = fixture(); f.authenticate = async () => principal;
    const runtime = await createWorkerRecordedBriefRuntime(options, secrets, f);
    await assert.rejects(runtime.activities.projectRecordedBrief(target)); assert.deepEqual(f.counts(), { reads: 0, receipts: 0 }); await runtime.shutdown();
  }
  const f = fixture(); let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  f.readReceipt = async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); throw new Error('private late readback'); };
  const runtime = await createWorkerRecordedBriefRuntime(options, secrets, f);
  const run = assert.rejects(runtime.activities.projectRecordedBrief(target), /^Error: Recorded Brief projection did not complete\.$/);
  await started; const closed = runtime.shutdown(); assert.equal(closed, runtime.shutdown());
  assert.equal(runtime.status().active, true); assert.equal(runtime.status().database.closed, false);
  release(); await run; await closed; assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().active, false);
});
