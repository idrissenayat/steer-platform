import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import type { CandidateBundleSaveRequest } from '@steer/adapters/github-candidate-bundle-store';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import type { createDurableCandidateBundleStore } from '../src/candidate-bundle-runtime.ts';
import { createCandidateSaveActivities } from '../src/candidate-save-activity.ts';
import { parseCandidateSaveTarget, candidateSaveWorkflowId } from '../src/candidate-save-contracts.ts';
import { createCandidateSaveWorker } from '../src/worker.ts';
import { startCandidateBundleSave, createCandidateSaveSchedulerClient } from '../src/client.ts';
import { createApi } from '../../api/src/app.ts';
import type { createRecordedCandidateSaveStarter } from '../../api/src/runtime.ts';
import { verifyCandidateSaveStart, type CandidateSaveScheduler } from '@steer/tool-registry/candidate-save-start-contracts';
import type { Client } from '@temporalio/client';
import { createIsolatedTemporalHarness } from './isolated-temporal-harness.ts';

type Fixture = { prepare(): Promise<CandidateBundleSaveRequest>; make(): ReturnType<typeof createDurableCandidateBundleStore>;
  loadOriginal(target: unknown): Promise<unknown>;
  holdDraft(): Promise<void>;
  advanceDraft(): Promise<void>;
  starter(scheduler: CandidateSaveScheduler, authorizeStart: Parameters<typeof createRecordedCandidateSaveStarter>[4]['authorizeStart']): ReturnType<typeof createRecordedCandidateSaveStarter>;
  git: { mutations(): number; head(): string; loseAck(): void }; state(operationId: string): Promise<unknown> };
const historyText = (v: unknown): string => v instanceof Uint8Array ? Buffer.from(v).toString('utf8')
  : v && typeof v === 'object' ? Object.values(v).map(historyText).join('\n') : typeof v === 'string' ? v : '';

/** Actual owned Temporal server + caller's actual disposable SQL/native Git. */
export async function testCandidateSaveWorkflow(setup: () => Promise<Fixture>, check: (name: string, run: () => Promise<void>) => Promise<void>) {
  Runtime.install({ logger: new DefaultLogger('ERROR') });
  const harness = await createIsolatedTemporalHarness(), env = harness.environment;
  let worker: Worker | undefined, running: Promise<void> | undefined, activities: ReturnType<typeof createCandidateSaveActivities> | undefined;
  const stop = async () => { if (worker) { worker.shutdown(); await running; worker = undefined; running = undefined; } activities?.close(); activities = undefined; };
  const fresh = async () => {
    const f = await setup(), request = await f.prepare(), plan = await planCandidateBundle(request.bundle, request.confirmation);
    const target = parseCandidateSaveTarget({ organizationId: request.bundle.organizationId, operationId: request.bundle.operationId, inputDigest: plan.inputDigest });
    return { f, request, target, queue: `steer-candidate-${randomUUID()}` };
  };
  const runWorker = async (t: Awaited<ReturnType<typeof fresh>>, loadOriginal: () => Promise<unknown> = () => t.f.loadOriginal(t.target),
    store: Parameters<typeof createCandidateSaveActivities>[1]['store'] = t.f.make()) => {
    activities = createCandidateSaveActivities(t.target, { store, authorize: async () => {}, loadOriginal });
    worker = await createCandidateSaveWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: t.queue, workflowBundle: harness.bundle }, activities);
    running = worker.run();
  };
  const http = async (t: Awaited<ReturnType<typeof fresh>>, scheduler: CandidateSaveScheduler,
    authorizeStart: Parameters<typeof createRecordedCandidateSaveStarter>[4]['authorizeStart'] = async () => {},
    permissions = { allowed: true }) => {
    const service = t.f.starter(scheduler, authorizeStart), input = { ...t.target, productId: t.request.bundle.productId,
      repository: t.request.bundle.repository, branch: t.request.bundle.branch, draftId: t.request.confirmation.draftId,
      draftRevision: t.request.confirmation.draftRevision, save: true };
    const app = createApi({ authenticate: async () => ({ organizationId: t.target.organizationId,
      subject: t.request.bundle.originatorSubject, type: 'human', hats: [], toolGrants: permissions.allowed ? ['intent.candidate.save.start'] : [],
      expiresAt: new Date(Date.now() + 600000).toISOString() }), services: { candidateSaveStarter: service } });
    try {
      const response = await app.request('/v1/tools/intent.candidate.save.start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const body = await response.json();
      return { status: response.status, body, output: response.status === 200 ? verifyCandidateSaveStart(input, body) : null };
    } finally { service.close(); }
  };
  try {
    await check('actual candidate HTTP recovers lost SQL-to-Temporal start acknowledgement, then encrypted originals commit once and replay without another Git send', async () => {
      const t = await fresh();
      let starts = 0;
      const lostClient = new Proxy(env.client, { get(object, key) {
        if (key === 'workflow') return new Proxy(object.workflow, { get(workflow, method) {
          if (method === 'start') return async (...args: Parameters<typeof workflow.start>) => {
            starts++; await workflow.start(...args); throw new Error('PRIVATE lost schedule acknowledgement');
          };
          const value = Reflect.get(workflow, method); return typeof value === 'function' ? value.bind(workflow) : value;
        } });
        const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;
      } }) as Client;
      const scheduler = createCandidateSaveSchedulerClient(lostClient, { namespace: 'default', taskQueue: t.queue });
      try {
        const first = await http(t, scheduler); assert.equal(first.status, 200); assert.equal(first.output!.receipt.outcome, 'unknown');
        const recovered = await http(t, scheduler); assert.equal(recovered.status, 200); assert.equal(recovered.output!.receipt.outcome, 'acknowledged');
        assert.equal(recovered.output!.savedToGit, false); assert.equal(starts, 1);
      } finally { scheduler.close(); }
      const handle = env.client.workflow.getHandle(candidateSaveWorkflowId(t.target));
      await assert.rejects(startCandidateBundleSave(env.client, t.queue, t.target));
      await runWorker(t);
      assert.deepEqual(await handle.result(), { operationId: t.target.operationId, inputDigest: t.target.inputDigest, outcome: 'committed', revision: t.f.git.head() });
      assert.equal(t.f.git.mutations(), 1); assert.equal(await t.f.state(t.target.operationId), 'dispatch-committed');
      const history = await handle.fetchHistory(), text = historyText(history);
      for (const forbidden of ['Synthetic Brief', 'Candidate Exam', 'NOT RUN', 'bundleManifestDigest', 'gate2DecisionDigest', 'synthetic-app-jwt', 'documents', 'ciphertext', 'steer-draft-envelope'])
        assert.equal(text.includes(forbidden), false);
      const scheduled = history.events?.filter(e => e.activityTaskScheduledEventAttributes) ?? [];
      assert.equal(scheduled.length, 1); assert.equal(scheduled[0]!.activityTaskScheduledEventAttributes?.retryPolicy?.maximumAttempts, 1);
      assert.equal(String(scheduled[0]!.activityTaskScheduledEventAttributes?.heartbeatTimeout?.seconds), '10');
      await stop(); await runWorker(t);
      await Worker.runReplayHistory({ workflowBundle: harness.bundle }, history, candidateSaveWorkflowId(t.target));
      await handle.result(); assert.equal(t.f.git.mutations(), 1);
      await assert.rejects(startCandidateBundleSave(env.client, t.queue, { ...t.target, inputDigest: 'f'.repeat(64) }));
      assert.deepEqual(await t.f.loadOriginal(t.target), t.request, 'The committed original must remain independently readable');
      const probe = await http(t, { start: async () => ({ outcome: 'unknown' }) });
      assert.equal(probe.status, 200, 'Current original/draft authority must remain valid after commit');
      const again = createCandidateSaveSchedulerClient(env.client, { namespace: 'default', taskQueue: t.queue });
      try {
        assert.equal((await again.start({ ...t.target, expiresAt: new Date(Date.now() + 60000).toISOString() }, async () => {})).outcome, 'acknowledged', 'Completed scheduler reference is independently valid');
        const observed = await http(t, again); assert.equal(observed.status, 200);
        assert.equal(observed.output!.receipt.outcome, 'acknowledged'); assert.equal(observed.output!.savedToGit, false);
      } finally { again.close(); }
      await stop();
    });
    await check('candidate HTTP rejects changed drafts, preexisting holds and holds during start authority before scheduling or Git dispatch', async () => {
      for (const mode of ['changed', 'held', 'late-held', 'denied']) {
        const t = await fresh(); let starts = 0;
        if (mode === 'changed') await t.f.advanceDraft(); if (mode === 'held') await t.f.holdDraft();
        const response = await http(t, { start: async () => { starts++; throw new Error('Must not schedule'); } }, async () => {
          if (mode === 'late-held') await t.f.holdDraft(); if (mode === 'denied') throw new Error('PRIVATE missing publication authority');
        });
        assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(response.body), /PRIVATE|Synthetic Brief|workflowId/);
        assert.equal(starts, 0); assert.equal(t.f.git.mutations(), 0); assert.equal(await t.f.state(t.target.operationId), undefined);
      }
    });
    await check('candidate HTTP conceals a scheduled workflow after grant loss without undoing it or starting a replacement', async () => {
      const t = await fresh(), permissions = { allowed: true };
      const scheduler = createCandidateSaveSchedulerClient(env.client, { namespace: 'default', taskQueue: t.queue });
      try {
        const response = await http(t, { start: async (input, current) => {
          const receipt = await scheduler.start(input, current); assert.equal(receipt.outcome, 'acknowledged'); permissions.allowed = false; return receipt;
        } }, async () => {}, permissions);
        assert.equal(response.status, 403); assert.equal((await env.client.workflow.getHandle(candidateSaveWorkflowId(t.target)).describe()).status.name, 'RUNNING');
        assert.equal(t.f.git.mutations(), 0); permissions.allowed = true;
        assert.equal((await http(t, scheduler, async () => {}, permissions)).output!.receipt.outcome, 'acknowledged');
        assert.equal(t.f.git.mutations(), 0);
      } finally { scheduler.close(); }
    });
    await check('Temporal retains an unknown Git outcome without retrying or equating workflow completion with a saved bundle', async () => {
      const t = await fresh(); t.f.git.loseAck(); await runWorker(t);
      const handle = await startCandidateBundleSave(env.client, t.queue, t.target);
      assert.deepEqual(await handle.result(), { operationId: t.target.operationId, inputDigest: t.target.inputDigest, outcome: 'unknown', revision: null });
      assert.equal((await handle.describe()).status.name, 'COMPLETED'); assert.equal(t.f.git.mutations(), 1);
      assert.equal((await handle.fetchHistory()).events?.filter(e => e.activityTaskScheduledEventAttributes).length, 1);
      assert.equal((await t.f.make().inspect(t.request)).outcome, 'committed'); assert.equal(t.f.git.mutations(), 1);
      await stop();
    });
    await check('a durable SQL draft hold recorded after queueing prevents Temporal from restoring originals or sending Git work', async () => {
      const t = await fresh(), handle = await startCandidateBundleSave(env.client, t.queue, t.target);
      await t.f.holdDraft(); await runWorker(t); await assert.rejects(handle.result());
      assert.equal(t.f.git.mutations(), 0); assert.equal(await t.f.state(t.target.operationId), undefined);
      const text = historyText(await handle.fetchHistory());
      for (const forbidden of ['Synthetic Brief', 'Candidate Exam', 'holdReference', 'ciphertext']) assert.equal(text.includes(forbidden), false);
      await stop();
    });
    await check('missing or substituted original payload fails one Temporal attempt with no source bytes in history and no Git request', async () => {
      for (const substitute of [false, true]) {
        const t = await fresh(); let reads = 0;
        await runWorker(t, async () => { reads++; if (!substitute) throw new Error('private-original-payload-marker');
          return { ...t.request, confirmation: { ...t.request.confirmation, draftRevision: 99 } }; });
        const handle = await startCandidateBundleSave(env.client, t.queue, t.target); await assert.rejects(handle.result());
        assert.equal(reads, 1); assert.equal(t.f.git.mutations(), 0); assert.equal(await t.f.state(t.target.operationId), undefined);
        assert.equal(historyText(await handle.fetchHistory()).includes('private-original-payload-marker'), false); await stop();
      }
    });
    await check('wrong Temporal workflow identity or a foreign fixed reference denies before original payload retrieval', async () => {
      const t = await fresh(); let reads = 0; await runWorker(t, async () => { reads++; return t.request; });
      const wrong = await env.client.workflow.start('saveCandidateBundle', { workflowId: `wrong-${randomUUID()}`, taskQueue: t.queue, args: [t.target] });
      await assert.rejects(wrong.result()); assert.equal(reads, 0);
      const foreign = await startCandidateBundleSave(env.client, t.queue, { ...t.target, organizationId: 'foreign' });
      await assert.rejects(foreign.result()); assert.equal(reads, 0); assert.equal(t.f.git.mutations(), 0); await stop();
    });
    await check('actual Temporal cancellation reaches the activity heartbeat and prevents a late original-payload read from saving', async () => {
      const t = await fresh(); let entered!: () => void, release!: () => void;
      const started = new Promise<void>(resolve => { entered = resolve; });
      await runWorker(t, async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); return t.request; });
      const handle = await startCandidateBundleSave(env.client, t.queue, t.target);
      await started; await handle.cancel(); await assert.rejects(handle.result());
      for (let i = 0; i < 60 && !activities!.status().closed; i++) await delay(50);
      assert.equal(activities!.status().closed, true); assert.equal(activities!.status().active, true);
      release();
      for (let i = 0; i < 40 && activities!.status().active; i++) await delay(25);
      assert.equal(activities!.status().active, false); assert.equal(t.f.git.mutations(), 0);
      assert.equal((await handle.describe()).status.name, 'CANCELLED'); await stop();
    });
    await check('cancellation after a committed Git effect never undoes it or permits another send when the late response drains', async () => {
      const t = await fresh(), store = t.f.make(); let entered!: () => void, release!: () => void;
      const committed = new Promise<void>(resolve => { entered = resolve; });
      await runWorker(t, async () => t.request, { close: store.close, compareAndWrite: async raw => {
        const result = await store.compareAndWrite(raw); assert.equal(result.outcome, 'committed'); entered();
        await new Promise<void>(resolve => { release = resolve; }); return result;
      } });
      const handle = await startCandidateBundleSave(env.client, t.queue, t.target);
      await committed; await handle.cancel(); await assert.rejects(handle.result());
      for (let i = 0; i < 60 && !activities!.status().closed; i++) await delay(50);
      assert.equal(activities!.status().closed, true); assert.equal(t.f.git.mutations(), 1);
      release();
      for (let i = 0; i < 40 && activities!.status().active; i++) await delay(25);
      assert.equal(activities!.status().active, false);
      assert.equal((await t.f.make().inspect(t.request)).outcome, 'committed');
      assert.equal((await t.f.make().compareAndWrite(t.request)).outcome, 'committed'); assert.equal(t.f.git.mutations(), 1);
      await stop();
    });
  } finally { try { await stop(); } finally { await harness.close(); } }
}
