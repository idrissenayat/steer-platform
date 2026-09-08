import { ActivityCancellationType, ApplicationFailure, defineQuery, isCancellation, proxyActivities, setHandler, sleep, workflowInfo } from '@temporalio/workflow';
import { parseDevelopmentTarget, parseDevelopmentStepResult, developmentWorkflowId,
  type DevelopmentStepResult, type DevelopmentWorkflowActivities } from './development-workflow-contracts.ts';
import { candidateSaveWorkflowId, parseCandidateSaveTarget, parseCandidateSaveResult, type CandidateSaveWorkflowActivities } from './candidate-save-contracts.ts';
import { parsePlan, parseReceipt, workflowId, parseGateWatchPlan, parseGateObservation, gateWatchId,
  parseRecordedBriefTarget, recordedBriefWorkflowId, parseRecordedBriefCheckpoint, type RecordedBriefActivities,
  parseRecordedBriefRecoveryPlan, recordedBriefRecoveryWorkflowId, type RecordedBriefRecoveryActivities,
  type ReconciliationActivities, type ReconciliationReceipt, type GateWatchActivities, type GateObservation } from './contracts.ts';

const developmentActivities = proxyActivities<DevelopmentWorkflowActivities>({
  startToCloseTimeout: '2 minutes', scheduleToCloseTimeout: '3 minutes', heartbeatTimeout: '10 seconds',
  retry: { maximumAttempts: 1 }, cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
});
export const developmentProgress = defineQuery<{ phase: 'architect' | 'test-agent' | 'complete'; checkpoint: DevelopmentStepResult | null }>('developmentProgress');
/** One fixed operation, at most two role activities. Clarification/supersession/
 * uncertainty stop this attempt. A completed workflow is not a gate or saved item.
 */
export async function developIntent(raw: unknown) {
  let target;
  try { target = parseDevelopmentTarget(raw); if (workflowInfo().workflowId !== developmentWorkflowId(target)) throw new Error(); }
  catch { throw ApplicationFailure.nonRetryable('Invalid development workflow binding.', 'INVALID_BINDING'); }
  let phase: 'architect' | 'test-agent' | 'complete' = 'architect', checkpoint: DevelopmentStepResult | null = null;
  setHandler(developmentProgress, () => ({ phase, checkpoint }));
  try {
    for (const role of ['architect', 'test-agent'] as const) {
      phase = role;
      const step = { ...target, role };
      checkpoint = parseDevelopmentStepResult(await developmentActivities.developIntentStep(step), step);
      if (checkpoint.outcome !== 'succeeded') break;
    }
    phase = 'complete'; return checkpoint!;
  } catch (error) {
    if (isCancellation(error)) throw error;
    throw ApplicationFailure.nonRetryable('Intent development requires attention.', 'INTENT_DEVELOPMENT_FAILED');
  }
}

const candidateSaveActivities = proxyActivities<CandidateSaveWorkflowActivities>({
  startToCloseTimeout: '2 minutes', scheduleToCloseTimeout: '3 minutes', heartbeatTimeout: '10 seconds', retry: { maximumAttempts: 1 },
});
/** One reference-only attempt. Workflow completion is not necessarily a committed save. */
export async function saveCandidateBundle(raw: unknown) {
  let target;
  try { target = parseCandidateSaveTarget(raw); if (workflowInfo().workflowId !== candidateSaveWorkflowId(target)) throw new Error(); }
  catch { throw ApplicationFailure.nonRetryable('Invalid candidate save reference.', 'INVALID_BINDING'); }
  try { return parseCandidateSaveResult(await candidateSaveActivities.saveCandidateBundle(target), target); }
  catch (error) { if (isCancellation(error)) throw error; throw ApplicationFailure.nonRetryable('Candidate save requires attention.', 'CANDIDATE_SAVE_FAILED'); }
}

const recordedRecoveryActivities = proxyActivities<RecordedBriefRecoveryActivities>({
  startToCloseTimeout: '2 minutes', scheduleToCloseTimeout: '3 minutes', retry: { maximumAttempts: 1 },
});
/** Separate deterministic recovery, not reset/reuse of the failed original or recursive recovery. */
export async function recoverRecordedBrief(raw: unknown) {
  let plan;
  try { plan = parseRecordedBriefRecoveryPlan(raw); if (workflowInfo().workflowId !== recordedBriefRecoveryWorkflowId(plan)) throw new Error(); }
  catch { throw ApplicationFailure.nonRetryable('Invalid recorded Brief recovery binding.', 'INVALID_BINDING'); }
  try { return parseRecordedBriefCheckpoint(await recordedRecoveryActivities.recoverRecordedBrief(plan)); }
  catch (error) { if (isCancellation(error)) throw error; throw ApplicationFailure.nonRetryable('Recorded Brief recovery requires attention.', 'RECORDED_RECOVERY_FAILED'); }
}

const recordedBriefActivities = proxyActivities<RecordedBriefActivities>({
  startToCloseTimeout: '2 minutes', scheduleToCloseTimeout: '3 minutes', retry: { maximumAttempts: 1 },
});
/** A single bounded projection attempt. No receipt payload, authority signal or automatic recovery write. */
export async function projectRecordedBrief(raw: unknown) {
  let target;
  try { target = parseRecordedBriefTarget(raw); if (workflowInfo().workflowId !== recordedBriefWorkflowId(target)) throw new Error(); }
  catch { throw ApplicationFailure.nonRetryable('Invalid recorded Brief workflow binding.', 'INVALID_BINDING'); }
  try { return parseRecordedBriefCheckpoint(await recordedBriefActivities.projectRecordedBrief(target)); }
  catch (error) { if (isCancellation(error)) throw error; throw ApplicationFailure.nonRetryable('Recorded Brief projection requires attention.', 'RECORDED_BRIEF_FAILED'); }
}

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
