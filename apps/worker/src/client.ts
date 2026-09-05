import { type Client, WorkflowIdConflictPolicy, WorkflowIdReusePolicy } from '@temporalio/client';
import { parsePlan, workflowId } from './contracts.ts';

/** Trusted administrative start only; no public route or unverified tenant input. */
export function startReconciliation(client: Client, taskQueue: string, raw: unknown) {
  const plan = parsePlan(raw);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(taskQueue)) throw new Error('Invalid reconciliation task queue.');
  return client.workflow.start('reconcileItem', { workflowId: workflowId(plan.scope), taskQueue, args: [plan],
    workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL,
    workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE,
  });
}
