import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, type WorkflowBundle } from '@temporalio/worker';
import { createGateWatchWorker } from '../src/worker.ts';
import { startGateWatch } from '../src/client.ts';
import { gateWatchId, type GateTarget, type GateObservation } from '../src/contracts.ts';

export async function testGateWatch(env: TestWorkflowEnvironment, bundle: WorkflowBundle, check: (name: string, run: () => Promise<void>) => Promise<void>) {
  const target: GateTarget = { scope: { organizationId: 'synthetic-org', repository: 'github:1', itemId: 'intent/0041' }, gate: 2, artifactRevision: 'a'.repeat(40) };
  const queue = 'steer-0041-gate-watch'; let calls = 0;
  let observation: GateObservation = { sourceRevision: 'b'.repeat(40), artifactRevision: target.artifactRevision, decisionDigest: null };
  let fail = false; let worker: Worker | undefined, running: Promise<void> | undefined;
  const start = async (binding: GateTarget) => {
    worker = await createGateWatchWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: bundle }, binding,
      { observe: async () => { calls++; if (fail) throw new Error('private source failure'); return { ...observation }; } });
    running = worker.run();
  };
  const stop = async () => { if (worker) { worker.shutdown(); await running; worker = undefined; running = undefined; } };
  try {
    await start(target);
    await check('gate watch preserves a checkpoint across worker recreation and rereads source before recording an exact-revision decision reference', async () => {
      const plan = { target, rounds: 2, intervalMs: 3000 }; const handle = await startGateWatch(env.client, queue, plan);
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const progress = await handle.query('gateWatchProgress') as { phase: string; checkpoint: GateObservation };
        if (progress.phase === 'waiting') { assert.deepEqual(progress.checkpoint, observation); waiting = true; break; }
        await delay(50);
      }
      assert.ok(waiting); assert.equal(calls, 1); const runId = (await handle.describe()).runId;
      await stop(); observation = { ...observation, sourceRevision: 'c'.repeat(40), decisionDigest: 'd'.repeat(64) }; await start(target);
      assert.deepEqual(await handle.result(), { outcome: 'decision-recorded', completed: 2, checkpoint: observation });
      assert.equal(calls, 2); assert.equal((await handle.describe()).runId, runId);
      await Worker.runReplayHistory({ workflowBundle: bundle }, await handle.fetchHistory(), gateWatchId(target)); assert.equal(calls, 2);
      await assert.rejects(startGateWatch(env.client, queue, plan));
    });
    await stop();
    const changed = { ...target, artifactRevision: 'e'.repeat(40) }; await start(changed);
    await check('changed artifact supersedes a gate watch even when an old decision digest exists', async () => {
      const handle = await startGateWatch(env.client, queue, { target: changed, rounds: 2, intervalMs: 1000 });
      assert.deepEqual(await handle.result(), { outcome: 'superseded', completed: 1, checkpoint: observation });
      assert.equal(calls, 3);
    });
    await stop();
    const exhausted = { ...target, artifactRevision: 'f'.repeat(40) }; observation = { ...observation, artifactRevision: exhausted.artifactRevision, decisionDigest: null }; await start(exhausted);
    await check('missing decision exhausts the bounded watch without fabricating approval', async () => {
      const handle = await startGateWatch(env.client, queue, { target: exhausted, rounds: 1, intervalMs: 1000 });
      assert.deepEqual(await handle.result(), { outcome: 'exhausted', completed: 1, checkpoint: observation }); assert.equal(calls, 4);
    });
    await stop();
    const failed = { ...target, gate: 3 as const }; await start(failed); fail = true;
    await check('wrong gate workflow identity denies before source access and failed source observation is not retried', async () => {
      const wrong = await env.client.workflow.start('watchGateDecision', { workflowId: 'synthetic-wrong-gate-id', taskQueue: queue,
        args: [{ target: failed, rounds: 1, intervalMs: 1000 }] });
      await assert.rejects(wrong.result()); assert.equal(calls, 4);
      const handle = await startGateWatch(env.client, queue, { target: failed, rounds: 2, intervalMs: 1000 });
      await assert.rejects(handle.result()); assert.equal(calls, 5);
    });
  } finally { await stop(); }
}
