/** Serializable references only. Never send tokens, artifact bytes or approvals to Temporal. */
export interface ReconciliationScope { organizationId: string; repository: string; itemId: string }
export interface ReconciliationPlan { scope: ReconciliationScope; rounds: number; intervalMs: number }
export interface ReconciliationReceipt { revision: string; status: 'reconciled' | 'superseded'; acknowledged: number }
export interface ReconciliationActivities { reconcile(scope: ReconciliationScope): Promise<ReconciliationReceipt> }

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
