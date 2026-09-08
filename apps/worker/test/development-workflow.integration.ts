import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import { createDevelopmentActivities } from '../src/development-activity.ts';
import { createDevelopmentWorker } from '../src/worker.ts';
import { startIntentDevelopment, createDevelopmentSchedulerClient } from '../src/client.ts';
import type { createDevelopmentStartHarness } from '../../../apps/api/test/intent-development-start.integration.ts';
import type { Client } from '@temporalio/client';
import { developmentWorkflowId, type DevelopmentTarget } from '../src/development-workflow-contracts.ts';
import { createIsolatedTemporalHarness } from './isolated-temporal-harness.ts';

type DevelopmentRuntime = Parameters<typeof createDevelopmentActivities>[1];
export type DevelopmentWorkflowFixture = {
  startHarness(scheduler: Parameters<typeof createDevelopmentStartHarness>[1]): ReturnType<typeof createDevelopmentStartHarness>;
  target: DevelopmentTarget;
  output: { message: string; questions: string[]; brief: string; spec: string };
  make(transport: typeof fetch, authorize?: () => Promise<void>): DevelopmentRuntime;
  edit(): Promise<void>; hold(): Promise<void>; count(): Promise<number>;
};
const historyText = (v: unknown): string => v instanceof Uint8Array ? Buffer.from(v).toString('utf8')
  : v && typeof v === 'object' ? Object.values(v).map(historyText).join('\n') : typeof v === 'string' ? v : '';
const response = (output: unknown) => Response.json({ id: 'synthetic-completion', object: 'chat.completion', created: 1, model: 'synthetic-provider-model',
  choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(output) }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } });
const assertPrivateHistory = (history: unknown) => {
  const text = historyText(history);
  for (const marker of ['Private observed original', 'Exact answer', 'Candidate Brief', 'Candidate Spec', 'Recorded Exam',
    'Exact message', 'synthetic-gateway-key', 'modelRoute', 'ciphertext', 'private-error-marker', 'Please clarify']) assert.equal(text.includes(marker), false, marker);
};

/** Actual Temporal + actual SQL/encryption/SDK, with synthetic model and grants. */
export async function testDevelopmentWorkflow(setup: () => Promise<DevelopmentWorkflowFixture>, check: (name: string, run: () => Promise<void>) => Promise<void>) {
  Runtime.install({ logger: new DefaultLogger('ERROR') });
  const harness = await createIsolatedTemporalHarness(), env = harness.environment;
  let worker: Worker | undefined, running: Promise<void> | undefined, activity: ReturnType<typeof createDevelopmentActivities> | undefined;
  const stop = async () => {
    if (worker) { worker.shutdown(); await running; worker = undefined; running = undefined; }
    activity?.close(); activity = undefined;
  };
  const fresh = async () => ({ f: await setup(), queue: `steer-development-${randomUUID()}` });
  const runWorker = async (t: Awaited<ReturnType<typeof fresh>>, transport: typeof fetch, authorize?: () => Promise<void>) => {
    activity = createDevelopmentActivities(t.f.target, t.f.make(transport, authorize));
    worker = await createDevelopmentWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: t.queue, workflowBundle: harness.bundle }, activity);
    running = worker.run();
  };
  try {
    await check('actual HTTP-to-SQL-to-Temporal start and lost-response recovery use one workflow and two recorded model steps', async () => {
      const t = await fresh(); let starts = 0, calls = 0;
      const uncertain = { options: env.client.options, workflowService: env.client.workflowService, withDeadline: env.client.withDeadline.bind(env.client),
        workflow: { getHandle: env.client.workflow.getHandle.bind(env.client.workflow), start: async (...args: Parameters<typeof env.client.workflow.start>) => {
          starts++; await env.client.workflow.start(...args); throw new Error('private-start-response-lost');
        } } } as unknown as Client;
      const scheduler = createDevelopmentSchedulerClient(uncertain, { namespace: 'default', taskQueue: t.queue });
      const api = t.f.startHarness(scheduler);
      try {
        const first = await api.post(); assert.equal(first.status, 200); assert.equal((await first.json()).receipt.outcome, 'unknown');
        const receiptResponse = await api.post(); assert.equal(receiptResponse.status, 200); const receipt = (await receiptResponse.json()).receipt;
        assert.equal(receipt.outcome, 'acknowledged'); assert.equal(starts, 1);
        await runWorker(t, async (_url, init) => { calls++; const body = JSON.parse(String(init?.body));
          return response(body.response_format.json_schema.schema.properties.exam ? { exam: '# Recorded Exam\nNOT RUN' } : t.f.output); });
        const handle = env.client.workflow.getHandle(developmentWorkflowId(t.f.target));
        assert.equal((await handle.result()).outcome, 'succeeded'); assert.equal(calls, 2); assert.equal(await t.f.count(), 4);
        assertPrivateHistory(await handle.fetchHistory()); await stop();
        const reconstructed = createDevelopmentSchedulerClient(env.client, { namespace: 'default', taskQueue: t.queue });
        const reopened = t.f.startHarness(reconstructed);
        try { const after = await reopened.post(); assert.equal(after.status, 200); const body = await after.json();
          assert.equal(body.receipt.runId, receipt.runId); assert.equal(body.receipt.state, 'COMPLETED'); assert.equal(body.documentsReady, false); assert.equal(calls, 2);
        } finally { reopened.service.close(); reconstructed.close(); }
      } finally { api.service.close(); scheduler.close(); await stop(); }
    });
    await check('actual Temporal same-ID foreign input is not acknowledged by development HTTP and cannot start replacement work', async () => {
      const t = await fresh(), foreign = { ...t.f.target, inputDigest: 'f'.repeat(64) };
      const handle = await startIntentDevelopment(env.client, t.queue, foreign);
      const scheduler = createDevelopmentSchedulerClient(env.client, { namespace: 'default', taskQueue: t.queue }), api = t.f.startHarness(scheduler);
      try { const result = await api.post(); assert.equal(result.status, 200); assert.equal((await result.json()).receipt.outcome, 'unknown');
        assert.equal(await t.f.count(), 0); assertPrivateHistory(await handle.fetchHistory());
      } finally { api.service.close(); scheduler.close(); await handle.terminate(); }
    });
    await check('Temporal develops both SQL-backed roles once, replays reference-only history and rejects duplicate starts after worker recreation', async () => {
      const t = await fresh(); let calls = 0;
      const transport: typeof fetch = async (_url, init) => {
        calls++; const body = JSON.parse(String(init?.body));
        return response(body.response_format.json_schema.schema.properties.exam ? { exam: '# Recorded Exam\nNOT RUN' } : t.f.output);
      };
      const handle = await startIntentDevelopment(env.client, t.queue, t.f.target);
      await assert.rejects(startIntentDevelopment(env.client, t.queue, t.f.target)); await runWorker(t, transport);
      const result = await handle.result(); assert.equal(result.outcome, 'succeeded'); assert.equal(result.role, 'test-agent');
      assert.equal(result.gateSigned, false); assert.equal(calls, 2); assert.equal(await t.f.count(), 4);
      assert.deepEqual(await handle.query('developmentProgress'), { phase: 'complete', checkpoint: result });
      const history = await handle.fetchHistory(); assertPrivateHistory(history);
      const scheduled = history.events!.filter(e => e.activityTaskScheduledEventAttributes);
      assert.equal(scheduled.length, 2);
      for (const event of scheduled) {
        assert.equal(event.activityTaskScheduledEventAttributes!.retryPolicy?.maximumAttempts, 1);
        assert.equal(String(event.activityTaskScheduledEventAttributes!.heartbeatTimeout?.seconds), '10');
      }
      await stop(); await runWorker(t, transport);
      await Worker.runReplayHistory({ workflowBundle: harness.bundle }, history, developmentWorkflowId(t.f.target));
      assert.deepEqual(await handle.result(), result); assert.equal(calls, 2);
      await assert.rejects(startIntentDevelopment(env.client, t.queue, { ...t.f.target, inputDigest: 'f'.repeat(64) })); await stop();
    });
    await check('Temporal resumes an actual encrypted Architect checkpoint and sends only the remaining Test Agent request', async () => {
      const t = await fresh(); let architectCalls = 0, testCalls = 0;
      const transport: typeof fetch = async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.response_format.json_schema.schema.properties.exam) { testCalls++; return response({ exam: '# Recorded Exam\nNOT RUN' }); }
        architectCalls++; return response(t.f.output);
      };
      const earlier = t.f.make(transport);
      try { assert.equal((await earlier.run('architect', new AbortController().signal)).outcome, 'succeeded'); } finally { earlier.close(); }
      assert.equal(architectCalls, 1); assert.equal(testCalls, 0);
      await runWorker(t, transport); const handle = await startIntentDevelopment(env.client, t.queue, t.f.target);
      assert.equal((await handle.result()).outcome, 'succeeded'); assert.equal(architectCalls, 1); assert.equal(testCalls, 1);
      assert.equal(await t.f.count(), 4); assertPrivateHistory(await handle.fetchHistory()); await stop();
    });
    await check('Temporal clarification stops before Test Agent and stores question bytes only in encrypted role records', async () => {
      const t = await fresh(); let calls = 0;
      await runWorker(t, async () => { calls++; return response({ ...t.f.output, questions: ['Please clarify the intended users.'], brief: null, spec: null }); });
      const handle = await startIntentDevelopment(env.client, t.queue, t.f.target), result = await handle.result();
      assert.equal(result.outcome, 'needs-clarification'); assert.equal(result.role, 'architect'); assert.ok(result.resultRef);
      assert.equal(calls, 1); assert.equal(await t.f.count(), 2); assertPrivateHistory(await handle.fetchHistory()); await stop();
    });
    await check('Temporal preserves a newer human edit and stops a superseded Architect result before Test Agent dispatch', async () => {
      const t = await fresh(); let calls = 0;
      await runWorker(t, async () => { calls++; await t.f.edit(); return response(t.f.output); });
      const handle = await startIntentDevelopment(env.client, t.queue, t.f.target), result = await handle.result();
      assert.equal(result.outcome, 'superseded'); assert.equal(result.role, 'architect'); assert.equal(calls, 1);
      assert.equal(await t.f.count(), 2); assertPrivateHistory(await handle.fetchHistory()); await stop();
    });
    await check('Temporal completes uncertain development as attention-required without another provider call or implicit retry', async () => {
      const t = await fresh(); let calls = 0;
      const transport: typeof fetch = async () => { calls++; throw new Error('private-error-marker'); };
      await runWorker(t, transport); const handle = await startIntentDevelopment(env.client, t.queue, t.f.target);
      const result = await handle.result(); assert.equal(result.outcome, 'attention-required'); assert.equal(result.resultRef, null);
      assert.equal((await handle.describe()).status.name, 'COMPLETED'); assert.equal(calls, 1); assert.equal(await t.f.count(), 1);
      const history = await handle.fetchHistory(); assertPrivateHistory(history);
      assert.equal(history.events!.filter(e => e.activityTaskScheduledEventAttributes).length, 1); await stop();
      const recovered = t.f.make(transport); try { assert.equal((await recovered.run('architect', new AbortController().signal)).outcome, 'attention-required'); }
      finally { recovered.close(); } assert.equal(calls, 1);
    });
    await check('a draft hold after Temporal queueing blocks source restoration and both model roles', async () => {
      const t = await fresh(); let calls = 0; const handle = await startIntentDevelopment(env.client, t.queue, t.f.target);
      await t.f.hold(); await runWorker(t, async () => { calls++; return response(t.f.output); });
      assert.equal((await handle.result()).outcome, 'attention-required'); assert.equal(calls, 0); assert.equal(await t.f.count(), 0);
      assertPrivateHistory(await handle.fetchHistory()); await stop();
    });
    await check('wrong development workflow identity and foreign fixed references fail before runtime authorization', async () => {
      const t = await fresh(); let authorizations = 0;
      await runWorker(t, async () => { throw new Error('must not send'); }, async () => { authorizations++; });
      const wrong = await env.client.workflow.start('developIntent', { workflowId: `wrong-${randomUUID()}`, taskQueue: t.queue, args: [t.f.target] });
      await assert.rejects(wrong.result());
      const foreign = await startIntentDevelopment(env.client, t.queue, { ...t.f.target, organizationId: 'foreign' }); await assert.rejects(foreign.result());
      assert.equal(authorizations, 0); assert.equal(await t.f.count(), 0); assertPrivateHistory(await foreign.fetchHistory()); await stop();
    });
    await check('Temporal heartbeat cancellation before dispatch prevents late authorization from starting a model call', async () => {
      const t = await fresh(); let calls = 0, entered!: () => void, release!: () => void;
      const enteredAuthority = new Promise<void>(resolve => { entered = resolve; });
      await runWorker(t, async () => { calls++; return response(t.f.output); }, async () => {
        entered(); await new Promise<void>(resolve => { release = resolve; });
      });
      const handle = await startIntentDevelopment(env.client, t.queue, t.f.target); await enteredAuthority;
      await handle.cancel(); await assert.rejects(handle.result()); assert.equal(activity!.status().closed, true);
      release(); await delay(50); assert.equal(calls, 0); assert.equal(await t.f.count(), 0);
      assert.equal((await handle.describe()).status.name, 'CANCELLED'); assertPrivateHistory(await handle.fetchHistory()); await stop();
    });
    await check('Temporal cancellation after request dispatch preserves uncertainty and blocks late response capture or resend', async () => {
      const t = await fresh(); let calls = 0, entered!: () => void, release!: () => void;
      const sent = new Promise<void>(resolve => { entered = resolve; });
      const transport: typeof fetch = async () => { calls++; entered(); await new Promise<void>(resolve => { release = resolve; }); return response(t.f.output); };
      await runWorker(t, transport); const handle = await startIntentDevelopment(env.client, t.queue, t.f.target); await sent;
      await handle.cancel(); await assert.rejects(handle.result()); assert.equal(activity!.status().closed, true);
      release(); await delay(50); assert.equal(calls, 1); assert.equal(await t.f.count(), 1); assertPrivateHistory(await handle.fetchHistory()); await stop();
      const recovered = t.f.make(transport); try { assert.equal((await recovered.run('architect', new AbortController().signal)).outcome, 'attention-required'); }
      finally { recovered.close(); } assert.equal(calls, 1);
    });
  } finally { try { await stop(); } finally { await harness.close(); } }
}
