import { Worker, type NativeConnection, type WorkflowBundle } from '@temporalio/worker';
import { Context, CancelledFailure } from '@temporalio/activity';
import type { createCandidateSaveActivities } from './candidate-save-activity.ts';
import type { createDevelopmentActivities } from './development-activity.ts';
import type { createScopeActivities } from './scope-activity.ts';
import { createReconciliationActivities, createGateWatchActivities, type ReconciliationPort, type GateObservationPort } from './activities.ts';
import { type ReconciliationScope, type ReconciliationActivities, type GateTarget, type RecordedBriefActivities } from './contracts.ts';
import type { RecordedBriefRecoveryActivities } from './contracts.ts';

interface WorkerBinding { connection: NativeConnection; namespace: string; taskQueue: string; workflowBundle: WorkflowBundle }
function validateBinding(options: WorkerBinding) {
  for (const name of [options.namespace, options.taskQueue]) if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?![\s\S])/.test(name)) throw new Error('Invalid worker binding.');
}

/** Dedicated scope queue; heartbeats carry no payload, findings or authority. */
export function createScopeWorker(options: WorkerBinding, activities: ReturnType<typeof createScopeActivities>) {
  validateBinding(options);
  if ([activities?.readScopePlan, activities?.reviewScopeBatch, activities?.close].some(v => typeof v !== 'function')) throw new Error('Scope worker unavailable.');
  const invoke = async (method: 'readScopePlan' | 'reviewScopeBatch', raw: unknown) => {
    const context = Context.current(); context.heartbeat();
    const pulse = setInterval(() => { try { context.heartbeat(); } catch { activities.close(); } }, 1000);
    try { return await activities[method](raw, context.cancellationSignal); }
    catch { if (context.cancellationSignal.aborted) throw new CancelledFailure('Scope review cancelled.');
      throw new Error('Scope review requires attention.'); }
    finally { clearInterval(pulse); }
  };
  return Worker.create({ connection: options.connection, namespace: options.namespace, taskQueue: options.taskQueue,
    workflowBundle: options.workflowBundle, activities: {
      readScopePlan: (raw: unknown) => invoke('readScopePlan', raw), reviewScopeBatch: (raw: unknown) => invoke('reviewScopeBatch', raw),
    }, maxConcurrentActivityTaskExecutions: 1, maxConcurrentWorkflowTaskExecutions: 2,
    maxHeartbeatThrottleInterval: '1 second', shutdownGraceTime: '10 seconds', shutdownForceTime: '30 seconds' });
}

/** Explicit dedicated development queue only; never installed by default. */
export function createDevelopmentWorker(options: WorkerBinding, activities: ReturnType<typeof createDevelopmentActivities>) {
  validateBinding(options);
  return Worker.create({ connection: options.connection, namespace: options.namespace, taskQueue: options.taskQueue,
    workflowBundle: options.workflowBundle, activities: { developIntentStep: async (raw: unknown) => {
      const context = Context.current(); context.heartbeat();
      const pulse = setInterval(() => { try { context.heartbeat(); } catch { activities.close(); } }, 1000);
      try { return await activities.developIntentStep(raw, context.cancellationSignal); }
      catch { if (context.cancellationSignal.aborted) throw new CancelledFailure('Intent development cancelled.');
        throw new Error('Intent development requires attention.'); }
      finally { clearInterval(pulse); }
    } }, maxConcurrentActivityTaskExecutions: 1, maxConcurrentWorkflowTaskExecutions: 2,
    maxHeartbeatThrottleInterval: '1 second', shutdownGraceTime: '10 seconds', shutdownForceTime: '30 seconds' });
}

/** Dedicated fixed-operation worker. Heartbeats contain no payload or approval. */
export function createCandidateSaveWorker(options: WorkerBinding, activities: ReturnType<typeof createCandidateSaveActivities>) {
  validateBinding(options);
  return Worker.create({ connection: options.connection, namespace: options.namespace, taskQueue: options.taskQueue,
    workflowBundle: options.workflowBundle, activities: { saveCandidateBundle: async (raw: unknown) => {
      const context = Context.current(); context.heartbeat();
      const pulse = setInterval(() => { try { context.heartbeat(); } catch { activities.close(); } }, 1000);
      try { return await activities.saveCandidateBundle(raw, context.cancellationSignal); }
      catch (error) { if (context.cancellationSignal.aborted) throw new CancelledFailure('Candidate save cancelled.'); throw error; }
      finally { clearInterval(pulse); }
    } }, maxConcurrentActivityTaskExecutions: 1, maxConcurrentWorkflowTaskExecutions: 2,
    maxHeartbeatThrottleInterval: '1 second', shutdownGraceTime: '10 seconds', shutdownForceTime: '30 seconds' });
}
/** Recovery has its own explicit queue and fixed activities; no recursive dispatch. */
export function createRecordedBriefRecoveryWorker(options: WorkerBinding, activities: RecordedBriefRecoveryActivities) {
  validateBinding(options);
  return Worker.create({ connection: options.connection, namespace: options.namespace, taskQueue: options.taskQueue,
    workflowBundle: options.workflowBundle, activities: { recoverRecordedBrief: activities.recoverRecordedBrief.bind(activities) },
    maxConcurrentActivityTaskExecutions: 1, maxConcurrentWorkflowTaskExecutions: 2,
    shutdownGraceTime: '10 seconds', shutdownForceTime: '30 seconds' });
}

/** Explicit dedicated queue with fixed runtime activities; caller owns runtime and connection closure. */
export function createRecordedBriefWorker(options: WorkerBinding, activities: RecordedBriefActivities) {
  validateBinding(options);
  return Worker.create({ connection: options.connection, namespace: options.namespace, taskQueue: options.taskQueue,
    workflowBundle: options.workflowBundle, activities: { projectRecordedBrief: activities.projectRecordedBrief.bind(activities) },
    maxConcurrentActivityTaskExecutions: 1, maxConcurrentWorkflowTaskExecutions: 2,
    shutdownGraceTime: '10 seconds', shutdownForceTime: '30 seconds',
  });
}

/** Explicit worker construction. Connection, bundled code and port are owned by the caller. */
export function createReconciliationWorker(options: WorkerBinding, scope: ReconciliationScope, port: ReconciliationPort) {
  return createActivityWorker(options, createReconciliationActivities(scope, port));
}

/** Accepts already fixed/authorized runtime activities. Not a public registration endpoint. */
export function createActivityWorker(options: WorkerBinding, activities: ReconciliationActivities) {
  validateBinding(options);
  return Worker.create({ connection: options.connection, namespace: options.namespace, taskQueue: options.taskQueue,
    workflowBundle: options.workflowBundle, activities: { reconcile: activities.reconcile.bind(activities) },
    maxConcurrentActivityTaskExecutions: 1, maxConcurrentWorkflowTaskExecutions: 2,
    shutdownGraceTime: '10 seconds', shutdownForceTime: '30 seconds',
  });
}

/** Separate explicit queue binding; never register this reader on a queue polled by incompatible workers. */
export function createGateWatchWorker(options: WorkerBinding, target: GateTarget, port: GateObservationPort) {
  validateBinding(options); const activities = createGateWatchActivities(target, port);
  return Worker.create({ connection: options.connection, namespace: options.namespace, taskQueue: options.taskQueue,
    workflowBundle: options.workflowBundle, activities: { observeGate: activities.observeGate.bind(activities) },
    maxConcurrentActivityTaskExecutions: 1, maxConcurrentWorkflowTaskExecutions: 2,
    shutdownGraceTime: '10 seconds', shutdownForceTime: '30 seconds',
  });
}
