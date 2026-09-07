import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, type WorkflowBundle } from '@temporalio/worker';
import { Client, Connection } from '@temporalio/client';
import { briefCatalogOutputSchema, briefProjectionOutputSchema, briefSaveOutputSchema } from '@steer/tool-registry';
import { createRuntimePool } from '@steer/data/runtime-pool';
import { createArtifactProjectionReader } from '@steer/data/artifact-reader';
import { projectionKey } from '@steer/data/ingestion';
import { createBriefCreationScenario } from '../../api/test/brief-creation-harness.ts';
import { recordedRuntimeFixture } from '../../api/test/recorded-runtime-fixture.ts';
import { createIdentityRuntime } from '../../api/src/runtime.ts';
import { ref, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { createWorkerRecordedBriefRuntime } from '../src/runtime.ts';
import { createRecordedBriefWorker } from '../src/worker.ts';
import { startRecordedBriefProjection, createManagedRecordedBriefScheduler } from '../src/client.ts';
import { recordedBriefWorkflowId } from '../src/contracts.ts';

function historyText(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  if (value && typeof value === 'object') return Object.values(value).map(historyText).join('\n');
  return typeof value === 'string' ? value : '';
}

/** Real creation/readback, signed current dispatch, Temporal and SQL in one journey.
 * Human/gate/projector authority and provider/JWKS responses remain synthetic. */
export async function testCreatedBriefWorkflow(env: TestWorkflowEnvironment, bundle: WorkflowBundle,
  database: { host: string; port: number; database: string; transport: { kind: string } }, password: string, admin: Pool,
  check: (name: string, run: () => Promise<void>) => Promise<void>) {
  const cleanup: (() => void)[] = [];
  const reads = createRuntimePool({ ...database, user: 'steer_app', password });
  let runtime: Awaited<ReturnType<typeof createWorkerRecordedBriefRuntime>> | undefined;
  let dispatchRuntime: Awaited<ReturnType<typeof createIdentityRuntime>> | undefined;
  let dispatch: Awaited<ReturnType<typeof createManagedRecordedBriefScheduler>> | undefined;
  let worker: Worker | undefined, running: Promise<void> | undefined;
  const scope = { organizationId: ref.organizationId, repository: ref.repository, itemId: ref.path.slice(0, -'/BRIEF.md'.length) };
  const target = { scope, idempotencyKey: ref.idempotencyKey }, queue = 'steer-0166-created';
  const principal = { subject: 'synthetic-created-projector', organizationId: scope.organizationId, type: 'agent', hats: [],
    toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 600000).toISOString() };
  let projectorAllowed = true, statusCalls = 0;
  const count = async () => Number((await admin.query('SELECT count(*) AS count FROM steer.ingestion_events WHERE organization_id=$1 AND repository=$2',
    [scope.organizationId, scope.repository])).rows[0].count);
  try {
    const artifactProjection = createArtifactProjectionReader(reads, { organizationId: scope.organizationId, repository: scope.repository, paths: [ref.path] }, () => now);
    const f = await createBriefCreationScenario({ after: run => { cleanup.push(run); } }, 'One created Brief through durable projection', { artifactProjection });
    const catalogInput = { organizationId: scope.organizationId, repository: scope.repository };
    const catalog = async () => {
      const response = await f.call('intent.brief.catalog', catalogInput); assert.equal(response.status, 200);
      return briefCatalogOutputSchema.parse(await response.json());
    };
    const configure = async () => {
      runtime = await createWorkerRecordedBriefRuntime({ target, database, source: { branch: ref.branch, path: ref.path, subject: ref.subject } },
        { databasePassword: password }, { reader: f.reader, authenticate: async () => projectorAllowed ? principal : null,
          readReceipt: async () => { statusCalls++; return f.inspect(); } });
    };
    const start = async () => {
      worker = await createRecordedBriefWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: bundle }, runtime!.activities);
      running = worker.run();
    };
    const stop = async () => {
      try { if (worker) { worker.shutdown(); await running; } }
      finally { worker = undefined; running = undefined; await runtime?.shutdown(); }
    };
    let revision = '';
    await check('actual HTTP creation with lost acknowledgement and signed current dispatcher reaches exact receipt-backed PostgreSQL projection after reconstruction', async () => {
      assert.deepEqual((await catalog()).records, []); assert.equal(await count(), 0);
      assert.equal((await f.inspect()).result.outcome, 'not-found'); f.source.loseAck();
      const response = await f.call('intent.brief.save', f.input); assert.equal(response.status, 200);
      assert.equal(briefSaveOutputSchema.parse(await response.json()).result.outcome, 'unknown');
      assert.equal(f.source.mutations(), 1); revision = f.source.head();
      assert.deepEqual(f.source.git(['diff-tree', '--no-commit-id', '--name-only', '-r', revision]).split('\n'),
        [`.steer/authoring/operations/${ref.idempotencyKey}.json`, ref.path]);
      assert.deepEqual((await catalog()).records, []); // Creation alone is not projection.
      f.source.add([{ path: 'unrelated.md', content: 'Unrelated later commit\n' }]); assert.notEqual(f.source.head(), revision);
      const dispatcher = await recordedRuntimeFixture({ after: run => { cleanup.push(run); } },
        { source: f.source, selection: { itemId: scope.itemId, idempotencyKey: target.idempotencyKey } });
      const connection = await Connection.connect({ address: env.address });
      dispatch = await createManagedRecordedBriefScheduler(new Client({ connection, namespace: 'default' }),
        { namespace: 'default', taskQueue: queue, target }, () => connection.close());
      dispatchRuntime = await createIdentityRuntime(dispatcher.profile, dispatcher.secrets,
        { ...dispatcher.ports, createRecordedScheduler: async () => dispatch! });
      assert.equal((await (await dispatchRuntime.fetch(dispatcher.request('status'))).json()).outcome, 'not-found');
      dispatcher.publish({ ...dispatcher.grant, toolGrants: ['projection.ingest'] });
      assert.equal((await dispatchRuntime.fetch(dispatcher.request('start'))).status, 403);
      assert.equal(dispatch.status().attempted, false); assert.equal(statusCalls, 0); assert.equal(await count(), 0);
      dispatcher.publish();
      f.reconstruct(); await configure();
      const started = await dispatchRuntime.fetch(dispatcher.request('start')); assert.equal(started.status, 200);
      assert.equal((await started.json()).outcome, 'started');
      assert.equal((await (await dispatchRuntime.fetch(dispatcher.request('start'))).json()).outcome, 'already-attempted');
      const handle = env.client.workflow.getHandle(dispatcher.workflowId);
      await stop(); assert.equal(statusCalls, 0); await configure(); await start();
      assert.deepEqual(await handle.result(), { revision, status: 'observed', outcome: 'applied' });
      const observed = await dispatchRuntime.fetch(dispatcher.request('status')); assert.equal(observed.status, 200);
      assert.equal((await observed.json()).state, 'COMPLETED');
      dispatcher.publish({ ...dispatcher.grant, active: false });
      assert.equal((await dispatchRuntime.fetch(dispatcher.request('status'))).status, 401);
      assert.equal(statusCalls, 1); assert.equal(await count(), 1); assert.equal(f.source.mutations(), 1);
      const expected = { path: ref.path, revision, contentDigest: f.preview.contentDigest };
      assert.deepEqual((await catalog()).records, [expected]);
      f.reconstruct(); const exact = await f.call('intent.brief.read', { ...catalogInput, ...expected }); assert.equal(exact.status, 200);
      const brief = briefProjectionOutputSchema.parse(await exact.json());
      assert.equal(brief.content, f.preview.markdown); assert.equal(brief.revision, revision);
      assert.equal(brief.blobSha, (await f.reader.readArtifact(ref.path, revision)).blobSha);
      const history = await handle.fetchHistory();
      for (const privateValue of [ref.subject, dispatcher.grant.subject, f.preview.markdown, password, 'synthetic-app-jwt', 'requestDigest', 'gateSigned']) {
        assert.equal(historyText(history).includes(privateValue), false);
      }
      await Worker.runReplayHistory({ workflowBundle: bundle }, history, recordedBriefWorkflowId(target)); assert.equal(statusCalls, 1);
      await assert.rejects(startRecordedBriefProjection(env.client, queue, target));
      const duplicate = await f.call('intent.brief.save', f.input); assert.equal(duplicate.status, 200);
      const saved = briefSaveOutputSchema.parse(await duplicate.json()); assert.equal(saved.result.outcome, 'committed');
      if (saved.result.outcome !== 'committed') throw new Error('Expected original committed operation');
      assert.equal(saved.result.revision, revision); assert.equal(saved.gateSigned, false); assert.equal(f.source.mutations(), 1);
      await stop(); await configure(); // Fresh runtime re-reads status; it does not retain a previous receipt as authority.
      assert.equal((await runtime!.activities.projectRecordedBrief(target)).outcome, 'duplicate'); assert.equal(await count(), 1);
      await dispatchRuntime.shutdown(); assert.equal(dispatch.status().state, 'stopped');
      assert.equal((await dispatchRuntime.fetch(dispatcher.request('status'))).status, 503);
    });
    await check('current human status permission and separate projector permission independently deny the created-brief worker without new ingestion', async () => {
      const before = f.source.calls.length, statuses = statusCalls;
      f.identify({ ...f.human, toolGrants: f.human.toolGrants.filter(grant => grant !== 'intent.brief.save.status') });
      await assert.rejects(runtime!.activities.projectRecordedBrief(target), /^Error: Recorded Brief projection did not complete\.$/);
      assert.equal(statusCalls, statuses + 1); assert.equal(f.source.calls.length, before); assert.equal(await count(), 1);
      f.identify(f.human); projectorAllowed = false;
      await assert.rejects(runtime!.activities.projectRecordedBrief(target)); assert.equal(statusCalls, statuses + 1);
      assert.equal(f.source.calls.length, before); assert.equal(await count(), 1); projectorAllowed = true;
      assert.equal((await runtime!.activities.projectRecordedBrief(target)).outcome, 'duplicate');
      assert.equal(f.source.mutations(), 1); assert.equal(await count(), 1);
    });
    await check('created work remains exact and curated after API reconstruction, with foreign scope, stale tuple and revoked read denial', async () => {
      const exact = { ...catalogInput, path: ref.path, revision, contentDigest: f.preview.contentDigest };
      for (const patch of [{ revision: f.source.head() }, { contentDigest: '0'.repeat(64) }]) {
        const response = await f.call('intent.brief.read', { ...exact, ...patch }); assert.equal(response.status, 200); assert.equal(await response.json(), null);
      }
      for (const patch of [{ organizationId: 'foreign' }, { path: 'items/0002-unconfigured/BRIEF.md' }, { repository: 'github:999' }]) {
        assert.equal((await f.call('intent.brief.read', { ...exact, ...patch })).status, 403);
      }
      f.identify({ ...f.human, toolGrants: f.human.toolGrants.filter(grant => grant !== 'projection.artifact.read') });
      assert.equal((await f.call('intent.brief.read', exact)).status, 403);
      assert.equal((await f.call('intent.brief.catalog', catalogInput)).status, 403);
      f.identify(f.human); f.reconstruct(); assert.equal((await catalog()).records[0]!.revision, revision);
      assert.equal((await f.call('intent.brief.read', exact)).status, 200);
      const row = (await admin.query('SELECT source_revision FROM steer.projection_records WHERE organization_id=$1 AND record_key=$2',
        [scope.organizationId, projectionKey(scope.repository, ref.path)])).rows[0];
      assert.equal(row.source_revision, revision); assert.equal(f.source.mutations(), 1); assert.equal(await count(), 1);
      assert.equal(f.counts().created, f.counts().closed);
    });
    await stop();
  } finally {
    try { if (worker) { worker.shutdown(); await running; } }
    finally {
      try { await runtime?.shutdown(); }
      finally { try { await reads.shutdown(); assert.equal(reads.status().closed, true); }
        finally {
          try { try { await dispatchRuntime?.shutdown(); } finally { await dispatch?.shutdown(); } }
          finally {
            let failure: unknown;
            for (const close of cleanup.reverse()) { try { close(); } catch (error) { failure ??= error; } }
            if (failure) throw failure;
          }
        } }
    }
  }
}
