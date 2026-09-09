import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from '@temporalio/client';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import type { IntentJourneyFactoryDependencies } from '../../api/src/runtime.ts';
import { intentScopeStartOutputSchema, type IntentScopeStartInput, type ScopeScheduler } from '@steer/tool-registry/intent-scope-start-contracts';
import { intentDevelopmentStartOutputSchema, type IntentDevelopmentStartInput, type DevelopmentScheduler } from '@steer/tool-registry/intent-development-start-contracts';
import type { createScopeStepRuntime } from '../src/scope-step-runtime.ts';
import type { createDevelopmentStepRuntime } from '../src/development-step-runtime.ts';
import { createScopeActivities } from '../src/scope-activity.ts';
import { createDevelopmentActivities } from '../src/development-activity.ts';
import { createScopeWorker, createDevelopmentWorker } from '../src/worker.ts';
import { createScopeSchedulerClient, createDevelopmentSchedulerClient } from '../src/client.ts';
import { scopeWorkflowId } from '../src/scope-workflow-contracts.ts';
import { developmentWorkflowId } from '../src/development-workflow-contracts.ts';
import { createWorkerService } from '../src/service.ts';
import { createIsolatedTemporalHarness } from './isolated-temporal-harness.ts';

const historyText = (value: unknown): string => value instanceof Uint8Array ? Buffer.from(value).toString('utf8')
  : value && typeof value === 'object' ? Object.values(value).map(historyText).join('\n') : typeof value === 'string' ? value : '';
type Http = { post(name: string, input: unknown): Promise<Response>; read(name: string, input: unknown): Promise<unknown>;
  effects(): Promise<unknown>; modelCalls(): number };
type Run = Http & ({ kind: 'scope'; input: IntentScopeStartInput; runtime: ReturnType<typeof createScopeStepRuntime>; batchIds: string[] }
  | { kind: 'development'; input: IntentDevelopmentStartInput; runtime: ReturnType<typeof createDevelopmentStepRuntime>; closeModel(): void });

/** Actual factory HTTP starts and owned fixed workers. Provider/authority ports
 * alone are synthetic; no principal, service result or workflow output is injected.
 * This verifies composition, not production startup/profile adoption or UI QA. */
export function authenticatedModelWorkflows(authority: () => Promise<void>) {
  let allowed: Run['kind'] | undefined, scope: ScopeScheduler | undefined, development: DevelopmentScheduler | undefined;
  const completed = { scope: 0, development: 0 };
  const current = async (kind: Run['kind']) => { await authority(); if (allowed !== kind) throw new Error('PRIVATE model workflow start denied'); };
  return {
    configure(deps: IntentJourneyFactoryDependencies) {
      deps.scope.authorizeStart = () => current('scope');
      deps.scope.scheduler = { start: async (...args) => { await current('scope'); if (!scope) throw new Error('PRIVATE scheduler unavailable'); return scope.start(...args); } };
      deps.development.authorizeStart = () => current('development');
      deps.development.scheduler = { start: async (...args) => { await current('development'); if (!development) throw new Error('PRIVATE scheduler unavailable'); return development.start(...args); } };
    },
    completed,
    async run(request: Run) {
      const { kind, input } = request, tool = kind === 'scope' ? 'intent.scope.start' : 'intent.development.start';
      const target = kind === 'scope' ? { organizationId: input.organizationId, reviewId: request.input.reviewId, preparationDigest: request.input.preparationDigest }
        : { organizationId: input.organizationId, operationId: request.input.operationId, inputDigest: request.input.inputDigest };
      const workflowId = kind === 'scope' ? scopeWorkflowId(target) : developmentWorkflowId(target);
      const activities = request.kind === 'scope' ? createScopeActivities(target, request.runtime) : createDevelopmentActivities(target, request.runtime);
      let harness: Awaited<ReturnType<typeof createIsolatedTemporalHarness>> | undefined, client: { close(): void } | undefined;
      let service: ReturnType<typeof createWorkerService> | undefined, closed = false;
      const closeRuntime = async () => { if (closed) return; closed = true; activities.close(); if (request.kind === 'development') request.closeModel(); };
      try {
        const before = await request.effects(), calls = request.modelCalls();
        const denied = await request.post(tool, input); assert.equal(denied.status, 503);
        assert.doesNotMatch(await denied.text(), /PRIVATE|Synthetic generated|Human correction|Booking فارسی|ciphertext/);
        assert.deepEqual(await request.effects(), before); assert.equal(request.modelCalls(), calls);
        Runtime.install({ logger: new DefaultLogger('ERROR') }); harness = await createIsolatedTemporalHarness();
        const env = harness.environment, queue = `steer-authenticated-${kind}-${randomUUID()}`; let starts = 0;
        const lostClient = new Proxy(env.client, { get(object, key) {
          if (key === 'workflow') return new Proxy(object.workflow, { get(workflow, method) {
            if (method === 'start') return async (...args: Parameters<typeof workflow.start>) => {
              starts++; await workflow.start(...args); throw new Error('PRIVATE lost model scheduler acknowledgement');
            };
            const value = Reflect.get(workflow, method); return typeof value === 'function' ? value.bind(workflow) : value;
          } });
          const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;
        } }) as Client;
        if (kind === 'scope') { const owned = createScopeSchedulerClient(lostClient, { namespace: 'default', taskQueue: queue }); scope = owned; client = owned; }
        else { const owned = createDevelopmentSchedulerClient(lostClient, { namespace: 'default', taskQueue: queue }); development = owned; client = owned; }
        allowed = kind;
        const start = async () => {
          const value = await request.read(tool, input);
          const result = kind === 'scope' ? intentScopeStartOutputSchema.parse(value) : intentDevelopmentStartOutputSchema.parse(value);
          for (const [key, expected] of Object.entries(input)) assert.equal((result as any)[key], expected);
          assert.equal(result.savedToGit, false); assert.equal(result.retryAuthorized, false); return result;
        };
        assert.equal((await start()).receipt.outcome, 'unknown');
        const receipt = (await start()).receipt; assert.equal(receipt.outcome, 'acknowledged');
        if (receipt.outcome !== 'acknowledged') throw new Error('Expected retained scheduler receipt');
        assert.equal(receipt.workflowId, workflowId); assert.equal(starts, 1);
        assert.deepEqual(await request.effects(), before); assert.equal(request.modelCalls(), calls);
        const binding = { connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: harness.bundle };
        service = createWorkerService({
          createWorker: () => request.kind === 'scope'
            ? createScopeWorker(binding, activities as ReturnType<typeof createScopeActivities>)
            : createDevelopmentWorker(binding, activities as ReturnType<typeof createDevelopmentActivities>),
          runtime: { shutdown: closeRuntime }, closeConnection: () => harness!.close(),
        });
        const execution = service.start(), handle = env.client.workflow.getHandle(workflowId);
        void execution.catch(() => {});
        const result = await Promise.race([handle.result(), execution.then(() => { throw new Error('Worker ended before workflow result'); })]);
        if (request.kind === 'scope') {
          assert.equal(result.outcome, 'attempt-complete'); assert.equal(result.completed, request.batchIds.length);
          assert.equal(result.planned, request.batchIds.length); assert.equal(request.modelCalls(), calls + request.batchIds.length);
        } else { assert.equal(result.outcome, 'succeeded'); assert.equal(result.role, 'test-agent'); assert.equal(request.modelCalls(), calls + 2); }
        const history = await handle.fetchHistory(), text = historyText(history);
        for (const forbidden of ['originalText', 'Synthetic generated', 'Human correction', 'Booking فارسی', 'synthetic-unused',
          'gatewayKey', 'scopeEvidence', 'requestBody', 'responseBody', 'ciphertext', 'instructions']) assert.equal(text.includes(forbidden), false);
        const scheduled = history.events?.filter(event => event.activityTaskScheduledEventAttributes).map(event => event.activityTaskScheduledEventAttributes!) ?? [];
        assert.equal(scheduled.length, request.kind === 'scope' ? request.batchIds.length + 1 : 2);
        assert.ok(scheduled.every(event => event.retryPolicy!.maximumAttempts === 1));
        const args = scheduled.map(event => JSON.parse(Buffer.from(event.input!.payloads![0]!.data!).toString('utf8')));
        if (request.kind === 'scope') assert.deepEqual(args.slice(1).map(value => value.batchId), request.batchIds);
        else assert.deepEqual(args.map(value => value.role), ['architect', 'test-agent']);
        const after = await request.effects(), sent = request.modelCalls();
        assert.equal((await start()).receipt.outcome, 'acknowledged'); assert.equal(starts, 1);
        await Worker.runReplayHistory({ workflowBundle: harness.bundle }, history, workflowId);
        assert.deepEqual(await request.effects(), after); assert.equal(request.modelCalls(), sent);
        await service.shutdown(); assert.equal(service.status().state, 'stopped'); assert.equal(closed, true);
        completed[kind]++;
        console.log(`PASS authenticated ${kind} workflow: denied start, one fixed lost-acknowledgement start, ordered single-attempt activities, reference-only history, replay/repeated start without model or reservation duplication, owned worker shutdown`);
      } finally {
        try { if (service) await service.shutdown(); else { await closeRuntime(); await harness?.close(); } }
        finally { client?.close(); allowed = undefined; scope = undefined; development = undefined; }
      }
    },
  };
}
