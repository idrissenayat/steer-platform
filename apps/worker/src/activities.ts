import { parseScope, workflowId, parseReceipt, parseGateTarget, gateWatchId, parseGateObservation,
  type ReconciliationScope, type ReconciliationActivities, type GateTarget, type GateObservation, type GateWatchActivities } from './contracts.ts';
import { parseRecordedBriefTarget, recordedBriefWorkflowId, parseRecordedBriefCheckpoint,
  type RecordedBriefTarget, type RecordedBriefActivities } from './contracts.ts';

/** Port must bind current authenticated readback to the exact configured save operation. */
export interface RecordedBriefPort { runOnce(): Promise<unknown> }
export function createRecordedBriefActivities(rawTarget: RecordedBriefTarget, port: RecordedBriefPort): RecordedBriefActivities {
  const target = parseRecordedBriefTarget(rawTarget), expected = recordedBriefWorkflowId(target); let active = false;
  return { async projectRecordedBrief(raw) {
    // Parse failures also stay generic: caller-controlled fields are never echoed.
    if (recordedBriefWorkflowId(raw) !== expected) throw new Error('Recorded Brief scope denied.');
    if (active) throw new Error('Recorded Brief projection is already active.');
    active = true;
    try { return parseRecordedBriefCheckpoint(await port.runOnce()); }
    catch { throw new Error('Recorded Brief projection did not complete.'); }
    finally { active = false; }
  } };
}

/** Trusted port must reauthorize current agent grants on every run and use idempotent CAS ingestion. */
export interface ReconciliationPort {
  runOnce(): Promise<{ revision: string; status: 'reconciled' | 'superseded'; outcomes: readonly unknown[] }>;
}

/** Trusted source reader must freshly authorize and bind any digest to this exact gate/revision.
 * It must reread current source each call, not accept a previous workflow checkpoint as authority. */
export interface GateObservationPort { observe(): Promise<GateObservation> }
export function createGateWatchActivities(rawTarget: GateTarget, port: GateObservationPort): GateWatchActivities {
  const target = parseGateTarget(rawTarget); const expected = gateWatchId(target); let active = false;
  return { async observeGate(raw) {
    if (gateWatchId(raw) !== expected) throw new Error('Gate observation scope denied.');
    if (active) throw new Error('Gate observation is already active.');
    active = true;
    try { return parseGateObservation(await port.observe()); }
    catch { throw new Error('Gate observation did not complete.'); }
    finally { active = false; }
  } };
}

/** Fixed binding, not caller-selected repository/runtime. The caller owns port shutdown. */
export function createReconciliationActivities(rawScope: ReconciliationScope, port: ReconciliationPort): ReconciliationActivities {
  const scope = parseScope(rawScope); const expected = workflowId(scope); let active = false;
  return { async reconcile(raw) {
    if (workflowId(raw) !== expected) throw new Error('Reconciliation scope denied.');
    if (active) throw new Error('Reconciliation is already active.');
    active = true;
    try {
      const result = await port.runOnce();
      if (!Array.isArray(result.outcomes)) throw new Error();
      return parseReceipt({ revision: result.revision, status: result.status, acknowledged: result.outcomes.length });
    } catch { throw new Error('Reconciliation did not complete.'); }
    finally { active = false; }
  } };
}
