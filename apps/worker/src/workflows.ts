import { ApplicationFailure, defineQuery, isCancellation, proxyActivities, setHandler, sleep, workflowInfo } from '@temporalio/workflow';
import { parsePlan, parseReceipt, workflowId, type ReconciliationActivities, type ReconciliationReceipt } from './contracts.ts';

const activities = proxyActivities<ReconciliationActivities>({
  startToCloseTimeout: '2 minutes', scheduleToCloseTimeout: '3 minutes', retry: { maximumAttempts: 1 },
});
export const progress = defineQuery<{ completed: number; phase: 'reconciling' | 'waiting' | 'complete' }>('reconciliationProgress');

/** Bounded durable polling, not business truth, a gate decision or an unbounded daemon. */
export async function reconcileItem(raw: unknown) {
  let plan;
  try { plan = parsePlan(raw); if (workflowInfo().workflowId !== workflowId(plan.scope)) throw new Error(); }
  catch { throw ApplicationFailure.nonRetryable('Invalid reconciliation workflow binding.', 'INVALID_BINDING'); }
  let completed = 0; let phase: 'reconciling' | 'waiting' | 'complete' = 'reconciling';
  let last: ReconciliationReceipt | undefined;
  setHandler(progress, () => ({ completed, phase }));
  for (let round = 0; round < plan.rounds; round++) {
    phase = 'reconciling';
    try { last = parseReceipt(await activities.reconcile(plan.scope)); }
    catch (error) { if (isCancellation(error)) throw error; throw ApplicationFailure.nonRetryable('Reconciliation requires attention.', 'RECONCILIATION_FAILED'); }
    completed++;
    if (round + 1 < plan.rounds) { phase = 'waiting'; await sleep(plan.intervalMs); }
  }
  phase = 'complete'; return { completed, last: last! };
}
