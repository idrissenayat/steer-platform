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
import { startCandidateBundleSave } from '../src/client.ts';
import { createIsolatedTemporalHarness } from './isolated-temporal-harness.ts';

type Fixture = { prepare(): Promise<CandidateBundleSaveRequest>; make(): ReturnType<typeof createDurableCandidateBundleStore>;
  loadOriginal(target: unknown): Promise<unknown>;
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
  try {
    await check('actual Temporal reloads encrypted SQL originals, commits once and replays after worker recreation without another Git send', async () => {
      const t = await fresh();
      const handle = await startCandidateBundleSave(env.client, t.queue, t.target);
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
      await stop();
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
