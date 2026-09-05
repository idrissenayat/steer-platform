import { Worker, type NativeConnection, type WorkflowBundle } from '@temporalio/worker';
import { createReconciliationActivities, createGateWatchActivities, type ReconciliationPort, type GateObservationPort } from './activities.ts';
import { type ReconciliationScope, type ReconciliationActivities, type GateTarget } from './contracts.ts';

interface WorkerBinding { connection: NativeConnection; namespace: string; taskQueue: string; workflowBundle: WorkflowBundle }
function validateBinding(options: WorkerBinding) {
  for (const name of [options.namespace, options.taskQueue]) if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name)) throw new Error('Invalid worker binding.');
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
