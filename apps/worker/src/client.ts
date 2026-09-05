import { type Client, WorkflowIdConflictPolicy, WorkflowIdReusePolicy, WorkflowExecutionAlreadyStartedError, WorkflowNotFoundError } from '@temporalio/client';
import { parsePlan, parseScope, workflowId } from './contracts.ts';

/** Trusted administrative start only; no public route or unverified tenant input. */
export function startReconciliation(client: Client, taskQueue: string, raw: unknown) {
  const plan = parsePlan(raw);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(taskQueue)) throw new Error('Invalid reconciliation task queue.');
  return client.workflow.start('reconcileItem', { workflowId: workflowId(plan.scope), taskQueue, args: [plan],
    workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL,
    workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE,
  });
}

/** Fixed trusted namespace/queue/scope. No credentials, routing choices or automatic retry from caller input. */
export function createReconciliationSchedulerClient(client: Client, configuration: {
  namespace: string; taskQueue: string; scope: { organizationId: string; repository: string; itemId: string }; maxRounds: number; minIntervalMs: number;
}) {
  const scope = Object.freeze(parseScope(configuration.scope)); const id = workflowId(scope);
  for (const value of [configuration.namespace, configuration.taskQueue]) if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new Error('Invalid scheduler binding.');
  if (client.options.namespace !== configuration.namespace || !Number.isSafeInteger(configuration.maxRounds) || configuration.maxRounds < 1 || configuration.maxRounds > 100 ||
    !Number.isSafeInteger(configuration.minIntervalMs) || configuration.minIntervalMs < 1000 || configuration.minIntervalMs > 86400000) throw new Error('Invalid scheduler binding.');
  const queue = configuration.taskQueue; const namespace = configuration.namespace;
  const limits = Object.freeze({ maxRounds: configuration.maxRounds, minIntervalMs: configuration.minIntervalMs });
  return Object.freeze({ scope, workflowId: id, limits,
    async start(raw: { organizationId: string; repository: string; itemId: string; rounds: number; intervalMs: number }) {
      const plan = parsePlan({ scope: { organizationId: raw.organizationId, repository: raw.repository, itemId: raw.itemId }, rounds: raw.rounds, intervalMs: raw.intervalMs });
      if (workflowId(plan.scope) !== id || plan.rounds > limits.maxRounds || plan.intervalMs < limits.minIntervalMs || client.options.namespace !== namespace) throw new Error('Scheduler scope denied.');
      try { const handle = await startReconciliation(client, queue, plan); return { workflowId: id, outcome: 'started' as const, runId: handle.firstExecutionRunId }; }
      catch (error) { return { workflowId: id, outcome: error instanceof WorkflowExecutionAlreadyStartedError ? 'duplicate' as const : 'unknown' as const }; }
    },
    async inspect() {
      if (client.options.namespace !== namespace) throw new Error('Scheduler scope denied.');
      try { const result = await client.workflow.getHandle(id).describe(); return { workflowId: id, outcome: 'found' as const, runId: result.runId, state: result.status.name }; }
      catch (error) { return { workflowId: id, outcome: error instanceof WorkflowNotFoundError ? 'not-found' as const : 'unknown' as const }; }
    },
  });
}

/** Transfers ownership of one already configured connection; construction and shutdown failures are sanitized. */
export async function createManagedReconciliationScheduler(client: Client,
  configuration: Parameters<typeof createReconciliationSchedulerClient>[1], closeConnection: () => Promise<void>) {
  let close: Promise<void> | undefined;
  const release = () => close ??= Promise.resolve().then(closeConnection);
  let adapter: ReturnType<typeof createReconciliationSchedulerClient>;
  try { adapter = createReconciliationSchedulerClient(client, configuration); }
  catch {
    try { await release(); } catch { throw new Error('Scheduler initialization cleanup could not be confirmed.'); }
    throw new Error('Scheduler could not be initialized.');
  }
  let state: 'running' | 'draining' | 'stopped' | 'failed' = 'running';
  let active = 0; let drained: (() => void) | undefined; let shutdown: Promise<void> | undefined;
  async function invoke<T>(operation: () => Promise<T>): Promise<T> {
    if (state !== 'running' || active >= 8) throw new Error('Scheduler is not accepting operations.');
    active++;
    try { return await operation(); }
    finally { active--; if (active === 0) drained?.(); }
  }
  const scheduler = Object.freeze({ scope: adapter.scope, workflowId: adapter.workflowId, limits: adapter.limits,
    start: (input: Parameters<typeof adapter.start>[0]) => invoke(() => adapter.start(input)),
    inspect: () => invoke(() => adapter.inspect()),
  });
  return Object.freeze({ scheduler, status: () => ({ state, active }),
    shutdown(): Promise<void> {
      if (shutdown) return shutdown;
      state = 'draining';
      const wait = active === 0 ? Promise.resolve() : new Promise<void>((resolve) => { drained = resolve; });
      shutdown = wait.then(release).then(() => { drained = undefined; state = 'stopped'; }, () => {
        drained = undefined; state = 'failed'; throw new Error('Scheduler shutdown could not be confirmed.');
      });
      return shutdown;
    },
  });
}
