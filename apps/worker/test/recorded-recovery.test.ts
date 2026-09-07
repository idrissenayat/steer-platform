import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client } from '@temporalio/client';
import { parseRecordedBriefRecoveryPlan, recordedBriefRecoveryWorkflowId, recordedBriefWorkflowId } from '../src/contracts.ts';
import { createRecordedBriefRecoveryActivities } from '../src/activities.ts';
import { createRecordedBriefFailedParentGuard, startRecordedBriefRecovery } from '../src/client.ts';
import { createWorkerRecordedBriefRecoveryRuntime } from '../src/runtime.ts';

const target = { scope: { organizationId: 'synthetic', repository: 'github:1', itemId: 'items/0181-fixture' }, idempotencyKey: '18100000-0000-4000-8000-000000000001' };
const plan = { target, failedRunId: '18100000-0000-4000-8000-000000000002' };
const checkpoint = { revision: 'a'.repeat(40), status: 'observed', outcome: 'applied' };
const config = { namespace: 'default', sourceTaskQueue: 'original', taskQueue: 'recovery', plan };
function fixture() {
  let reads = 0, starts = 0, request: unknown;
  const good = { workflowId: recordedBriefWorkflowId(target), runId: plan.failedRunId, type: 'projectRecordedBrief', taskQueue: 'original', status: { name: 'FAILED' } };
  let describe: () => Promise<unknown> = async () => good;
  const options = { namespace: 'default' };
  const client = { options, workflow: {
    getHandle: (id: string) => { assert.equal(id, good.workflowId); return { describe: async () => { reads++; return describe(); } }; },
    start: async (name: string, input: unknown) => { assert.equal(name, 'recoverRecordedBrief'); starts++; request = input; return {}; },
  } } as unknown as Client;
  return { client, options, good, describe: (fn: () => Promise<unknown>) => { describe = fn; }, counts: () => ({ reads, starts }), request: () => request };
}
test('recovery plans are closed references with deterministic child identity distinct from the original', () => {
  assert.deepEqual(parseRecordedBriefRecoveryPlan(plan), plan);
  assert.notEqual(recordedBriefRecoveryWorkflowId(plan), recordedBriefWorkflowId(target));
  for (const value of [{ ...plan, reset: true }, { ...plan, failedRunId: 'arbitrary' }, { ...plan, failedRunId: plan.failedRunId + '\n' },
    { ...plan, target: { ...target, content: 'private' } }, { ...plan, target: { ...target, scope: { ...target.scope, token: 'private' } } }]) {
    assert.throws(() => parseRecordedBriefRecoveryPlan(value));
  }
  assert.notEqual(recordedBriefRecoveryWorkflowId(plan), recordedBriefRecoveryWorkflowId({ ...plan, failedRunId: '18100000-0000-4000-8000-000000000003' }));
});
test('parent guard requires exact current original failure and snapshots its trusted configuration', async () => {
  const f = fixture(), supplied = { namespace: 'default', taskQueue: 'original', plan: structuredClone(plan) };
  const guard = createRecordedBriefFailedParentGuard(f.client, supplied);
  supplied.taskQueue = 'other'; supplied.plan.failedRunId = 'other'; supplied.plan.target.scope.itemId = 'other';
  assert.equal(Object.isFrozen(guard.plan.target.scope), true); await guard.verify();
  for (const patch of [{ workflowId: 'other' }, { runId: '18100000-0000-4000-8000-000000000004' }, { type: 'recoverRecordedBrief' },
    { taskQueue: 'other' }, ...['RUNNING', 'COMPLETED', 'CANCELLED', 'TIMED_OUT', 'TERMINATED', 'CONTINUED_AS_NEW', 'UNKNOWN'].map(name => ({ status: { name } }))]) {
    f.describe(async () => ({ ...f.good, ...patch })); await assert.rejects(guard.verify(), /^Error: Recorded Brief failed parent could not be verified\.$/);
  }
  f.describe(async () => { throw new Error('private transport error'); }); await assert.rejects(guard.verify(), /^Error: Recorded Brief failed parent could not be verified\.$/);
  f.describe(async () => { f.options.namespace = 'other'; return f.good; }); await assert.rejects(guard.verify());
  assert.equal(f.counts().starts, 0);
});
test('trusted recovery start preserves normal duplicate protection and cannot drift routing during parent I/O', async () => {
  const f = fixture(), supplied = structuredClone(config);
  f.describe(async () => { supplied.taskQueue = 'foreign'; supplied.plan.target.scope.itemId = 'foreign'; return f.good; });
  await startRecordedBriefRecovery(f.client, supplied);
  assert.deepEqual(f.request(), { workflowId: recordedBriefRecoveryWorkflowId(plan), taskQueue: 'recovery', args: [plan], workflowExecutionTimeout: '5 minutes',
    workflowIdConflictPolicy: 'FAIL', workflowIdReusePolicy: 'REJECT_DUPLICATE' });
  for (const changed of [{ ...config, taskQueue: 'original' }, { ...config, taskQueue: 'invalid queue' }, { ...config, reset: true }]) {
    const other = fixture(); await assert.rejects(startRecordedBriefRecovery(other.client, changed)); assert.deepEqual(other.counts(), { reads: 0, starts: 0 });
  }
  const other = fixture(); other.describe(async () => ({ ...other.good, status: { name: 'RUNNING' } }));
  await assert.rejects(startRecordedBriefRecovery(other.client, config)); assert.equal(other.counts().starts, 0);
});
test('fixed recovery activity rejects foreign failed runs, overlap and malformed output before leaking data', async () => {
  let calls = 0, release!: () => void;
  const activities = createRecordedBriefRecoveryActivities(plan, { runOnce: async () => { calls++; await new Promise<void>(r => { release = r; }); return { ...checkpoint, private: 'source' }; } });
  await assert.rejects(activities.recoverRecordedBrief({ ...plan, failedRunId: '18100000-0000-4000-8000-000000000004' })); assert.equal(calls, 0);
  const pending = activities.recoverRecordedBrief(plan); await assert.rejects(activities.recoverRecordedBrief(plan), /already active/); release();
  await assert.rejects(pending, /^Error: Recorded Brief recovery did not complete\.$/); assert.equal(calls, 1);
});
test('recovery runtime binds parent before allocating work and rechecks it after projector authentication', async () => {
  const options = { plan, database: { host: '127.0.0.1', port: 5432, database: 'unused', transport: { kind: 'isolated-loopback-test' } },
    source: { branch: 'synthetic', path: `${target.scope.itemId}/BRIEF.md`, subject: 'synthetic-human' } };
  let reads = 0, auth = 0, guards = 0, revoked = false;
  const deps = { reader: { binding: { organizationId: 'synthetic', repositoryId: 1, installationId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' },
    readHead: async () => { reads++; throw new Error(); }, readArtifact: async () => { reads++; throw new Error(); } },
    readReceipt: async () => { reads++; throw new Error(); }, authenticate: async () => { auth++; revoked = true; return { subject: 'projector', organizationId: 'synthetic', type: 'agent', hats: [], toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 60000).toISOString() }; },
    parent: { plan, verify: async () => { guards++; if (revoked) throw new Error('private changed parent'); } } };
  await assert.rejects(createWorkerRecordedBriefRecoveryRuntime(options, { databasePassword: 'unused' }, { ...deps, parent: { ...deps.parent, plan: { ...plan, failedRunId: 'wrong' } } }));
  assert.equal(auth + guards + reads, 0);
  const runtime = await createWorkerRecordedBriefRecoveryRuntime(options, { databasePassword: 'unused' }, deps);
  try { await assert.rejects(runtime.activities.recoverRecordedBrief(plan)); assert.deepEqual({ auth, guards, reads }, { auth: 1, guards: 2, reads: 0 }); assert.equal(runtime.status().database.connections, 0); }
  finally { await runtime.shutdown(); assert.equal(runtime.status().database.closed, true); }
});
