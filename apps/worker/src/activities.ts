import { parseScope, workflowId, parseReceipt, type ReconciliationScope, type ReconciliationActivities } from './contracts.ts';

/** Trusted port must reauthorize current agent grants on every run and use idempotent CAS ingestion. */
export interface ReconciliationPort {
  runOnce(): Promise<{ revision: string; status: 'reconciled' | 'superseded'; outcomes: readonly unknown[] }>;
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
