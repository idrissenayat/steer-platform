import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, type WorkflowBundle } from '@temporalio/worker';
import { createGitHubReader, createAppJwtSigner } from '@steer/adapters/github';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import { createOidcAuthenticator } from '@steer/adapters/identity';
import { projectionKey } from '@steer/data/ingestion';
import { recordedRuntimeFixture } from '../../api/test/recorded-runtime-fixture.ts';
import { createWorkerRecordedBriefRuntime, createWorkerRecordedBriefRecoveryRuntime } from '../src/runtime.ts';
import { createRecordedBriefWorker, createRecordedBriefRecoveryWorker } from '../src/worker.ts';
import { createRecordedBriefActivities } from '../src/activities.ts';
import { startRecordedBriefProjection, startRecordedBriefRecovery, createRecordedBriefFailedParentGuard } from '../src/client.ts';
import { recordedBriefRecoveryWorkflowId } from '../src/contracts.ts';

function historyText(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  if (value && typeof value === 'object') return Object.values(value).map(historyText).join('\n');
  return typeof value === 'string' ? value : '';
}
/** Real local Temporal/Git/SQL. Receipt provenance and issuer transports are synthetic. */
export async function testRecordedBriefRecovery(env: TestWorkflowEnvironment, bundle: WorkflowBundle,
  database: unknown, password: string, admin: Pool, check: (name: string, run: () => Promise<void>) => Promise<void>) {
  for (const [index, mode] of ['before-sql', 'after-sql'].entries()) {
    const cleanup: (() => void)[] = [];
    let original: Awaited<ReturnType<typeof createWorkerRecordedBriefRuntime>> | undefined;
    let recovery: Awaited<ReturnType<typeof createWorkerRecordedBriefRecoveryRuntime>> | undefined;
    let worker: Worker | undefined, running: Promise<void> | undefined;
    const stop = async () => { try { if (worker) { worker.shutdown(); await running; } } finally { worker = undefined; running = undefined; } };
    try {
      const f = await recordedRuntimeFixture({ after: fn => { cleanup.push(fn); } }, { selection: {
        itemId: `items/0181-${mode}`, idempotencyKey: `18100000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` } });
      const grant = { ...f.grant, toolGrants: ['projection.ingest'] }; f.publish(grant);
      const path = `${f.target.scope.itemId}/BRIEF.md`, subject = 'synthetic-recovery-receipt-human';
      const revision = f.source.add([{ path, content: `# Brief\n\nSynthetic recovery ${mode} café.\n` }]);
      const reader = createGitHubReader(f.profile.github.binding, { appJwt: createAppJwtSigner('1', f.secrets.githubPrivateKeyPem), fetch: f.ports.github });
      const snapshot = await reader.readArtifact(path, revision);
      const verify = createOidcAuthenticator({ issuer: f.profile.browser.issuer, jwksUri: f.profile.browser.jwksUri,
        audience: f.profile.browser.audience, clientIds: [f.profile.browser.clientId] },
      { fetch: f.ports.identity, resolveAuthorization: createGitAuthorizationResolver(reader, f.profile.github.authorizationPath) });
      let reads = 0;
      const ports = { reader, authenticate: () => verify(f.request('status')), readReceipt: async () => {
        reads++; return { gateSigned: false, result: { organizationId: f.target.scope.organizationId, repository: f.target.scope.repository,
          branch: reader.binding.branch, path, subject, idempotencyKey: f.target.idempotencyKey, outcome: 'committed', expectedHead: revision,
          revision, requestDigest: 'c'.repeat(64), contentDigest: snapshot.contentDigest, blobSha: snapshot.blobSha } };
      } };
      const source = { branch: reader.binding.branch, path, subject }, sourceTaskQueue = `steer-0181-original-${index}`, taskQueue = `steer-0181-recovery-${index}`;
      const row = async () => (await admin.query('SELECT value, source_revision FROM steer.projection_records WHERE organization_id=$1 AND record_key=$2',
        [f.target.scope.organizationId, projectionKey(f.target.scope.repository, path)])).rows[0];
      const events = async () => Number((await admin.query('SELECT count(*) AS count FROM steer.ingestion_events WHERE organization_id=$1 AND event_id=$2',
        [f.target.scope.organizationId, `source:${createHash('sha256').update(JSON.stringify([f.target.scope.repository, path, revision])).digest('hex')}`])).rows[0].count);
      await check(`one fixed recovery after ${mode} failure preserves the original failed run and exact Git/PostgreSQL idempotency`, async () => {
        original = await createWorkerRecordedBriefRuntime({ target: f.target, database, source }, { databasePassword: password }, ports);
        let originalAttempts = 0;
        worker = await createRecordedBriefWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: sourceTaskQueue, workflowBundle: bundle },
          createRecordedBriefActivities(f.target, { runOnce: async () => {
            originalAttempts++; if (mode === 'after-sql') await original!.activities.projectRecordedBrief(f.target);
            throw new Error('private synthetic original acknowledgment failure');
          } })); running = worker.run();
        const failed = await startRecordedBriefProjection(env.client, sourceTaskQueue, f.target); await assert.rejects(failed.result());
        assert.equal(originalAttempts, 1); const failedRunId = (await failed.describe()).runId;
        assert.equal(await events(), mode === 'after-sql' ? 1 : 0);
        await stop(); await original.shutdown();
        const plan = { target: f.target, failedRunId }, configuration = { namespace: 'default', sourceTaskQueue, taskQueue, plan };
        const before = reads;
        await assert.rejects(startRecordedBriefRecovery(env.client, { ...configuration, plan: { ...plan, failedRunId: '18100000-0000-4000-8000-000000000099' } }));
        const starts = await Promise.allSettled([startRecordedBriefRecovery(env.client, configuration), startRecordedBriefRecovery(env.client, configuration)]);
        assert.equal(starts.filter(r => r.status === 'fulfilled').length, 1); assert.equal(starts.filter(r => r.status === 'rejected').length, 1);
        assert.equal(reads, before);
        const handle = env.client.workflow.getHandle(recordedBriefRecoveryWorkflowId(plan));
        const parent = createRecordedBriefFailedParentGuard(env.client, { namespace: 'default', taskQueue: sourceTaskQueue, plan });
        const configure = async () => { recovery = await createWorkerRecordedBriefRecoveryRuntime({ plan, database, source }, { databasePassword: password }, { ...ports, parent }); };
        await configure(); await recovery!.shutdown(); await configure(); assert.equal(reads, before);
        worker = await createRecordedBriefRecoveryWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue, workflowBundle: bundle }, recovery!.activities);
        running = worker.run();
        assert.deepEqual(await handle.result(), { revision, status: 'observed', outcome: mode === 'after-sql' ? 'duplicate' : 'applied' });
        assert.equal(await events(), 1); assert.equal((await row()).value.content, snapshot.content); assert.equal((await row()).source_revision, revision);
        assert.equal((await failed.describe()).status.name, 'FAILED'); assert.equal((await failed.describe()).runId, failedRunId);
        const completedReads = reads, history = await handle.fetchHistory();
        for (const value of [subject, grant.subject, password, snapshot.content, 'private synthetic original acknowledgment failure']) assert.equal(historyText(history).includes(value), false);
        await Worker.runReplayHistory({ workflowBundle: bundle }, history, recordedBriefRecoveryWorkflowId(plan)); assert.equal(reads, completedReads);
        await assert.rejects(startRecordedBriefRecovery(env.client, configuration)); assert.equal(reads, completedReads); assert.equal(await events(), 1);
        const wrong = await env.client.workflow.start('recoverRecordedBrief', { workflowId: `steer-0181-wrong-${index}`, taskQueue, args: [plan] });
        await assert.rejects(wrong.result()); assert.equal(reads, completedReads);
        f.publish({ ...grant, active: false }); await assert.rejects(recovery!.activities.recoverRecordedBrief(plan)); assert.equal(reads, completedReads);
        assert.equal(await events(), 1); assert.equal(f.source.mutations(), 0);
      });
    } finally { try { await stop(); } finally { try { await original?.shutdown(); } finally { try { await recovery?.shutdown(); } finally { for (const close of cleanup.reverse()) close(); } } } }
  }
}
