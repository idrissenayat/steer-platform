import assert from 'node:assert/strict';
import { join } from 'node:path';
import type { Pool } from 'pg';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, type WorkflowBundle } from '@temporalio/worker';
import { createGitAuthorizationHarness } from '../../api/test/git-authorization-harness.ts';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import type { AuthorizationRecord } from '@steer/adapters/identity';
import { projectionKey } from '@steer/data/ingestion';
import { createWorkerRecordedBriefRuntime, createWorkerProjectionRuntime } from '../src/runtime.ts';
import { createRecordedBriefWorker } from '../src/worker.ts';
import { startRecordedBriefProjection } from '../src/client.ts';
import { recordedBriefWorkflowId } from '../src/contracts.ts';

function historyText(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  if (value && typeof value === 'object') return Object.values(value).map(historyText).join('\n');
  return typeof value === 'string' ? value : '';
}

/** Real Temporal/Git/SQL, synthetic readback provenance. Parent owns disposable database and temp tree. */
export async function testRecordedBriefWorkflow(env: TestWorkflowEnvironment, bundle: WorkflowBundle, temporary: string,
  database: unknown, password: string, admin: Pool, check: (name: string, run: () => Promise<void>) => Promise<void>) {
  const organizationId = 'synthetic-recorded-projection', repository = 'github:1';
  const grant: AuthorizationRecord = { issuer: 'https://synthetic.invalid/issuer', subject: 'synthetic-recorded-projector', organizationId,
    type: 'agent', hats: [], toolGrants: ['projection.ingest'], active: true, validAfter: new Date(0).toISOString(),
    expiresAt: new Date(Date.now() + 600000).toISOString() };
  const source = await createGitAuthorizationHarness(join(temporary, 'recorded-0165'), grant, 'canonical');
  const resolve = createGitAuthorizationResolver(source.reader, source.authorizationPath);
  const authenticate = async () => {
    const current = await resolve({ issuer: grant.issuer, subject: grant.subject, organizationId });
    if (!current?.active || Date.parse(current.validAfter) > Date.now() || Date.parse(current.expiresAt) <= Date.now()) return null;
    return { subject: current.subject, organizationId, type: current.type, hats: current.hats, toolGrants: current.toolGrants, expiresAt: current.expiresAt };
  };
  const revision = await source.reader.readHead(), snapshot = await source.reader.readArtifact(source.artifactPath, revision);
  const scope = { organizationId, repository, itemId: source.artifactPath.slice(0, -'/BRIEF.md'.length) };
  const subject = 'synthetic-private-receipt-subject';
  const reference = { organizationId, repository, branch: source.reader.binding.branch, path: source.artifactPath, subject };
  const receipt = (idempotencyKey: string) => ({ gateSigned: false, result: { ...reference, idempotencyKey,
    outcome: 'committed', expectedHead: revision, revision, requestDigest: 'c'.repeat(64), contentDigest: snapshot.contentDigest, blobSha: snapshot.blobSha } });
  const key = (n: number) => `16500000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const target = (n: number) => ({ scope, idempotencyKey: key(n) });
  const queue = 'steer-0165-recorded'; let receiptReads = 0;
  let runtime: Awaited<ReturnType<typeof createWorkerRecordedBriefRuntime>> | undefined;
  let worker: Worker | undefined, running: Promise<void> | undefined;
  const count = async () => Number((await admin.query('SELECT count(*) AS count FROM steer.ingestion_events WHERE organization_id=$1', [organizationId])).rows[0].count);
  const row = async () => (await admin.query('SELECT value, source_revision FROM steer.projection_records WHERE organization_id=$1 AND record_key=$2',
    [organizationId, projectionKey(repository, source.artifactPath)])).rows[0];
  const configure = async (n: number, read: () => Promise<unknown> = async () => receipt(key(n))) => {
    runtime = await createWorkerRecordedBriefRuntime({ target: target(n), database,
      source: { branch: reference.branch, path: reference.path, subject } }, { databasePassword: password },
    { reader: source.reader, authenticate, readReceipt: async () => { receiptReads++; return read(); } });
  };
  const startWorker = async () => {
    worker = await createRecordedBriefWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: bundle }, runtime!.activities);
    running = worker.run();
  };
  const stop = async () => {
    try { if (worker) { worker.shutdown(); await running; } }
    finally {
      worker = undefined; running = undefined;
      if (runtime) { await runtime.shutdown(); assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().active, false); }
    }
  };
  try {
    await check('recorded Brief workflow survives queued runtime recreation and projects exact native Git bytes into PostgreSQL', async () => {
      await configure(1); assert.equal(runtime!.status().database.connections, 0);
      const handle = await startRecordedBriefProjection(env.client, queue, target(1));
      await stop(); assert.equal(receiptReads, 0); assert.equal(await count(), 0);
      await configure(1); await startWorker();
      assert.deepEqual(await handle.result(), { revision, status: 'observed', outcome: 'applied' });
      assert.equal((await row()).value.content, snapshot.content); assert.equal((await row()).source_revision, revision); assert.equal(await count(), 1);
      const reads = receiptReads, history = await handle.fetchHistory();
      for (const privateValue of [subject, password, snapshot.content, 'requestDigest', 'gateSigned']) assert.equal(historyText(history).includes(privateValue), false);
      await Worker.runReplayHistory({ workflowBundle: bundle }, history, recordedBriefWorkflowId(target(1)));
      assert.equal(receiptReads, reads); assert.equal(await count(), 1);
      await assert.rejects(startRecordedBriefProjection(env.client, queue, target(1)));
      assert.equal((await runtime!.activities.projectRecordedBrief(target(1))).outcome, 'duplicate'); assert.equal(await count(), 1);
    });
    await check('wrong workflow identity and foreign operation fail before current receipt readback', async () => {
      const before = receiptReads;
      const foreign = await startRecordedBriefProjection(env.client, queue, target(2)); await assert.rejects(foreign.result());
      const wrong = await env.client.workflow.start('projectRecordedBrief', { workflowId: 'steer-0165-wrong', taskQueue: queue, args: [target(1)] });
      await assert.rejects(wrong.result()); assert.equal(receiptReads, before); assert.equal(await count(), 1);
    });
    await stop();
    await check('changed receipt operation and revoked current Git grants fail once without private history or additional ingestion', async () => {
      let n = 3;
      for (const read of [async () => receipt(key(99)),
        async () => ({ ...receipt(key(4)), result: { ...receipt(key(4)).result, subject: 'other-human' } }),
        async () => { await source.publish([{ ...grant, active: false }]); return receipt(key(5)); }]) {
        await configure(n, read); await startWorker(); const before = receiptReads;
        const handle = await startRecordedBriefProjection(env.client, queue, target(n)); await assert.rejects(handle.result());
        assert.equal(receiptReads, before + 1); assert.equal(await count(), 1);
        const history = historyText(await handle.fetchHistory());
        for (const text of [subject, 'other-human', snapshot.content, password]) assert.equal(history.includes(text), false);
        await stop(); n++;
      }
      await configure(6); await startWorker(); const before = receiptReads;
      const handle = await startRecordedBriefProjection(env.client, queue, target(6)); await assert.rejects(handle.result());
      assert.equal(receiptReads, before); assert.equal(await count(), 1); await stop();
      await source.publish([grant]);
    });
    await check('recorded workflow never rewinds a different PostgreSQL selection after a newer native Git reconciliation', async () => {
      const newer = await source.reader.readHead(); assert.notEqual(newer, revision);
      const projection = await createWorkerProjectionRuntime({ scope, database, selector: { paths: [source.artifactPath] } },
        { databasePassword: password }, { reader: source.reader, authenticate });
      try { await projection.activities.reconcile(scope); } finally { await projection.shutdown(); }
      const before = await count(); assert.equal((await row()).source_revision, newer);
      await configure(7); await startWorker();
      const handle = await startRecordedBriefProjection(env.client, queue, target(7));
      assert.deepEqual(await handle.result(), { revision, status: 'different-revision', outcome: null });
      assert.equal((await row()).source_revision, newer); assert.equal(await count(), before);
    });
  } finally { await stop(); }
}
