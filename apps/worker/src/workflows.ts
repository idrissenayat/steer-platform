import { ApplicationFailure, defineQuery, isCancellation, proxyActivities, setHandler, sleep, workflowInfo } from '@temporalio/workflow';
import { parsePlan, parseReceipt, workflowId, parseGateWatchPlan, parseGateObservation, gateWatchId,
  type ReconciliationActivities, type ReconciliationReceipt, type GateWatchActivities, type GateObservation } from './contracts.ts';

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

const gateActivities = proxyActivities<GateWatchActivities>({
  startToCloseTimeout: '2 minutes', scheduleToCloseTimeout: '3 minutes', retry: { maximumAttempts: 1 },
});
export const gateProgress = defineQuery<{ completed: number; phase: 'observing' | 'waiting' | 'complete'; checkpoint: GateObservation | null }>('gateWatchProgress');

/** Observe only. No signing, gate pass, build dispatch, release or approval-bearing signal handler. */
export async function watchGateDecision(raw: unknown) {
  let plan;
  try { plan = parseGateWatchPlan(raw); if (workflowInfo().workflowId !== gateWatchId(plan.target)) throw new Error(); }
  catch { throw ApplicationFailure.nonRetryable('Invalid gate watch binding.', 'INVALID_BINDING'); }
  let completed = 0; let phase: 'observing' | 'waiting' | 'complete' = 'observing';
  let checkpoint: GateObservation | null = null;
  setHandler(gateProgress, () => ({ completed, phase, checkpoint }));
  for (let round = 0; round < plan.rounds; round++) {
    phase = 'observing';
    try { checkpoint = parseGateObservation(await gateActivities.observeGate(plan.target)); }
    catch (error) { if (isCancellation(error)) throw error; throw ApplicationFailure.nonRetryable('Gate observation requires attention.', 'GATE_OBSERVATION_FAILED'); }
    completed++;
    if (checkpoint.artifactRevision !== plan.target.artifactRevision) {
      phase = 'complete'; return { outcome: 'superseded' as const, completed, checkpoint };
    }
    if (checkpoint.decisionDigest !== null) {
      phase = 'complete'; return { outcome: 'decision-recorded' as const, completed, checkpoint };
    }
    if (round + 1 < plan.rounds) { phase = 'waiting'; await sleep(plan.intervalMs); }
  }
  phase = 'complete'; return { outcome: 'exhausted' as const, completed, checkpoint: checkpoint! };
}
