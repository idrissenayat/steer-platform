/** Serializable references only. Never send tokens, artifact bytes or approvals to Temporal. */
export interface ReconciliationScope { organizationId: string; repository: string; itemId: string }
export interface ReconciliationPlan { scope: ReconciliationScope; rounds: number; intervalMs: number }
export interface ReconciliationReceipt { revision: string; status: 'reconciled' | 'superseded'; acknowledged: number }
export interface ReconciliationActivities { reconcile(scope: ReconciliationScope): Promise<ReconciliationReceipt> }
export interface GateTarget { scope: ReconciliationScope; gate: 1 | 2 | 3; artifactRevision: string }
export interface GateWatchPlan { target: GateTarget; rounds: number; intervalMs: number }
/** A source checkpoint, not an approval, signer record or globally ordered event offset. */
export interface GateObservation { sourceRevision: string; artifactRevision: string; decisionDigest: string | null }
export interface GateWatchActivities { observeGate(target: GateTarget): Promise<GateObservation> }
/** Save operation reference only; branch, receipt subject and source stay in trusted runtime configuration. */
export interface RecordedBriefTarget { scope: ReconciliationScope; idempotencyKey: string }
export type RecordedBriefCheckpoint = { revision: string } & (
  { status: 'observed'; outcome: 'applied' | 'duplicate' | 'repaired' | 'superseded' } |
  { status: 'different-revision'; outcome: null });
export interface RecordedBriefActivities { projectRecordedBrief(target: RecordedBriefTarget): Promise<RecordedBriefCheckpoint> }
/** One recovery workflow per exact failed original run; never a new save operation. */
export interface RecordedBriefRecoveryPlan { target: RecordedBriefTarget; failedRunId: string }
export interface RecordedBriefRecoveryActivities { recoverRecordedBrief(plan: RecordedBriefRecoveryPlan): Promise<RecordedBriefCheckpoint> }

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
export function parseScope(value: unknown): ReconciliationScope {
  if (!object(value) || !exact(value, ['organizationId', 'repository', 'itemId'])) throw new Error('Invalid reconciliation scope.');
  for (const [key, max] of [['organizationId', 64], ['repository', 96], ['itemId', 96]] as const) {
    if (typeof value[key] !== 'string' || value[key].length > max || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value[key])) throw new Error('Invalid reconciliation scope.');
  }
  return { organizationId: value.organizationId as string, repository: value.repository as string, itemId: value.itemId as string };
}
export function workflowId(raw: unknown): string {
  const scope = parseScope(raw);
  return `steer-reconcile/v1/${[scope.organizationId, scope.repository, scope.itemId].map(encodeURIComponent).join('/')}`;
}
export function parsePlan(value: unknown): ReconciliationPlan {
  if (!object(value) || !exact(value, ['scope', 'rounds', 'intervalMs']) || !Number.isSafeInteger(value.rounds) ||
    (value.rounds as number) < 1 || (value.rounds as number) > 100 || !Number.isSafeInteger(value.intervalMs) ||
    (value.intervalMs as number) < 1000 || (value.intervalMs as number) > 86400000) throw new Error('Invalid reconciliation plan.');
  return { scope: parseScope(value.scope), rounds: value.rounds as number, intervalMs: value.intervalMs as number };
}
export function parseReceipt(value: unknown): ReconciliationReceipt {
  if (!object(value) || !exact(value, ['revision', 'status', 'acknowledged']) || typeof value.revision !== 'string' || !/^[a-f0-9]{40}$/.test(value.revision) ||
    !['reconciled', 'superseded'].includes(value.status as string) || !Number.isSafeInteger(value.acknowledged) ||
    (value.acknowledged as number) < 0 || (value.acknowledged as number) > 100) throw new Error('Invalid reconciliation receipt.');
  return { revision: value.revision, status: value.status as ReconciliationReceipt['status'], acknowledged: value.acknowledged as number };
}

const revision = (value: unknown): value is string => typeof value === 'string' && value.length === 40 && /^[a-f0-9]{40}$/.test(value);
export function parseRecordedBriefTarget(value: unknown): RecordedBriefTarget {
  if (!object(value) || !exact(value, ['scope', 'idempotencyKey']) || typeof value.idempotencyKey !== 'string' ||
    value.idempotencyKey.length !== 36 || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.idempotencyKey)) throw new Error('Invalid recorded Brief target.');
  return { scope: parseScope(value.scope), idempotencyKey: value.idempotencyKey };
}
export function recordedBriefWorkflowId(value: unknown): string {
  const target = parseRecordedBriefTarget(value);
  return `${workflowId(target.scope).replace('steer-reconcile/v1/', 'steer-recorded-brief/v1/')}/${target.idempotencyKey}`;
}
export function parseRecordedBriefRecoveryPlan(value: unknown): RecordedBriefRecoveryPlan {
  if (!object(value) || !exact(value, ['target', 'failedRunId']) || typeof value.failedRunId !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.failedRunId)) throw new Error('Invalid recorded Brief recovery plan.');
  return { target: parseRecordedBriefTarget(value.target), failedRunId: value.failedRunId };
}
export function recordedBriefRecoveryWorkflowId(value: unknown): string {
  const plan = parseRecordedBriefRecoveryPlan(value);
  return `${recordedBriefWorkflowId(plan.target).replace('steer-recorded-brief/v1/', 'steer-recorded-brief-recovery/v1/')}/${plan.failedRunId}`;
}
export function parseRecordedBriefCheckpoint(value: unknown): RecordedBriefCheckpoint {
  if (!object(value) || !exact(value, ['revision', 'status', 'outcome']) || !revision(value.revision)) throw new Error('Invalid recorded Brief checkpoint.');
  if (value.status === 'different-revision' && value.outcome === null) return { revision: value.revision, status: value.status, outcome: null };
  if (value.status === 'observed' && ['applied', 'duplicate', 'repaired', 'superseded'].includes(value.outcome as string)) {
    return { revision: value.revision, status: value.status, outcome: value.outcome as 'applied' | 'duplicate' | 'repaired' | 'superseded' };
  }
  throw new Error('Invalid recorded Brief checkpoint.');
}
export function parseGateTarget(value: unknown): GateTarget {
  if (!object(value) || !exact(value, ['scope', 'gate', 'artifactRevision']) || ![1, 2, 3].includes(value.gate as number) || !revision(value.artifactRevision)) throw new Error('Invalid gate target.');
  return { scope: parseScope(value.scope), gate: value.gate as GateTarget['gate'], artifactRevision: value.artifactRevision };
}
export function gateWatchId(value: unknown): string {
  const target = parseGateTarget(value);
  return `${workflowId(target.scope).replace('steer-reconcile/v1/', 'steer-gate-watch/v1/')}/${target.gate}/${target.artifactRevision}`;
}
export function parseGateWatchPlan(value: unknown): GateWatchPlan {
  if (!object(value) || !exact(value, ['target', 'rounds', 'intervalMs'])) throw new Error('Invalid gate watch plan.');
  const target = parseGateTarget(value.target);
  const plan = parsePlan({ scope: target.scope, rounds: value.rounds, intervalMs: value.intervalMs });
  return { target, rounds: plan.rounds, intervalMs: plan.intervalMs };
}
export function parseGateObservation(value: unknown): GateObservation {
  if (!object(value) || !exact(value, ['sourceRevision', 'artifactRevision', 'decisionDigest']) || !revision(value.sourceRevision) || !revision(value.artifactRevision) ||
    (value.decisionDigest !== null && (typeof value.decisionDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.decisionDigest)))) throw new Error('Invalid gate observation.');
  return { sourceRevision: value.sourceRevision, artifactRevision: value.artifactRevision, decisionDigest: value.decisionDigest };
}
