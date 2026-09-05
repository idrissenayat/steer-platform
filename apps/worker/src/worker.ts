import { Worker, type NativeConnection, type WorkflowBundle } from '@temporalio/worker';
import { createReconciliationActivities, type ReconciliationPort } from './activities.ts';
import { type ReconciliationScope } from './contracts.ts';

/** Explicit worker construction. Connection, bundled code and port are owned by the caller. */
export function createReconciliationWorker(options: { connection: NativeConnection; namespace: string; taskQueue: string;
  workflowBundle: WorkflowBundle }, scope: ReconciliationScope, port: ReconciliationPort) {
  for (const name of [options.namespace, options.taskQueue]) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name)) throw new Error('Invalid worker binding.');
  }
  return Worker.create({ connection: options.connection, namespace: options.namespace, taskQueue: options.taskQueue,
    workflowBundle: options.workflowBundle, activities: createReconciliationActivities(scope, port),
    maxConcurrentActivityTaskExecutions: 1, maxConcurrentWorkflowTaskExecutions: 2,
    shutdownGraceTime: '10 seconds', shutdownForceTime: '30 seconds',
  });
}
