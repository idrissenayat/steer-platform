import { Worker, type NativeConnection, type WorkflowBundle } from '@temporalio/worker';
import { createReconciliationActivities, type ReconciliationPort } from './activities.ts';
import { type ReconciliationScope, type ReconciliationActivities } from './contracts.ts';

interface WorkerBinding { connection: NativeConnection; namespace: string; taskQueue: string; workflowBundle: WorkflowBundle }

/** Explicit worker construction. Connection, bundled code and port are owned by the caller. */
export function createReconciliationWorker(options: WorkerBinding, scope: ReconciliationScope, port: ReconciliationPort) {
  return createActivityWorker(options, createReconciliationActivities(scope, port));
}

/** Accepts already fixed/authorized runtime activities. Not a public registration endpoint. */
export function createActivityWorker(options: WorkerBinding, activities: ReconciliationActivities) {
  for (const name of [options.namespace, options.taskQueue]) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name)) throw new Error('Invalid worker binding.');
  }
  return Worker.create({ connection: options.connection, namespace: options.namespace, taskQueue: options.taskQueue,
    workflowBundle: options.workflowBundle, activities: { reconcile: activities.reconcile.bind(activities) },
    maxConcurrentActivityTaskExecutions: 1, maxConcurrentWorkflowTaskExecutions: 2,
    shutdownGraceTime: '10 seconds', shutdownForceTime: '30 seconds',
  });
}
