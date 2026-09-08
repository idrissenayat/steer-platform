import { type Client, WorkflowIdConflictPolicy, WorkflowIdReusePolicy, WorkflowExecutionAlreadyStartedError, WorkflowNotFoundError } from '@temporalio/client';
import { parsePlan, parseScope, workflowId, parseGateWatchPlan, gateWatchId, parseRecordedBriefTarget, recordedBriefWorkflowId } from './contracts.ts';
import { parseRecordedBriefRecoveryPlan, recordedBriefRecoveryWorkflowId } from './contracts.ts';
import { parseCandidateSaveTarget, candidateSaveWorkflowId } from './candidate-save-contracts.ts';
import { parseDevelopmentTarget, developmentWorkflowId } from './development-workflow-contracts.ts';
import { parseScopeTarget, scopeWorkflowId } from './scope-workflow-contracts.ts';

/** Trusted reference-only start. Manifest batching is resolved inside the activity. */
export function startIntentScopeReview(client: Client, taskQueue: string, raw: unknown) {
  const target = parseScopeTarget(raw);
  if (typeof taskQueue !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?![\s\S])/.test(taskQueue)) throw new Error('Invalid scope task queue.');
  return client.workflow.start('reviewIntentScope', { workflowId: scopeWorkflowId(target), taskQueue, args: [target],
    workflowExecutionTimeout: '30 minutes', workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL,
    workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE });
}

/** Trusted fixed-operation start; no role selection, payload or automatic retry. */
export function startIntentDevelopment(client: Client, taskQueue: string, raw: unknown) {
  const target = parseDevelopmentTarget(raw);
  if (typeof taskQueue !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?![\s\S])/.test(taskQueue)) throw new Error('Invalid development task queue.');
  return client.workflow.start('developIntent', { workflowId: developmentWorkflowId(target), taskQueue, args: [target],
    workflowExecutionTimeout: '8 minutes', workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL,
    workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE });
}

/** Uninstalled fixed-namespace scheduler. The caller owns the client/connection.
 * Fresh authority surrounds every wait; retries recover the same retained start,
 * not a workflow result or permission to retry an uncertain model dispatch. */
export function createDevelopmentSchedulerClient(client: Client, configuration: { namespace: string; taskQueue: string }) {
  if (!configuration || Object.keys(configuration).length !== 2 || !['namespace', 'taskQueue'].every(k => Object.hasOwn(configuration, k)))
    throw new Error('Invalid development scheduler binding.');
  const { namespace, taskQueue } = configuration;
  for (const v of [namespace, taskQueue]) if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?![\s\S])/.test(v)) throw new Error('Invalid development scheduler binding.');
  if (client.options.namespace !== namespace) throw new Error('Invalid development scheduler binding.');
  let closed = false, active = 0;
  return {
    async start(raw: Readonly<{ organizationId: string; operationId: string; inputDigest: string; expiresAt: string }>, revalidate: () => Promise<void>) {
      if (!raw || Object.keys(raw).length !== 4 || !['organizationId', 'operationId', 'inputDigest', 'expiresAt'].every(k => Object.hasOwn(raw, k))) throw new Error('Invalid development start.');
      const target = Object.freeze(parseDevelopmentTarget({ organizationId: raw.organizationId, operationId: raw.operationId, inputDigest: raw.inputDigest }));
      const expires = Date.parse(raw.expiresAt), workflowId = developmentWorkflowId(target);
      if (!Number.isFinite(expires) || typeof revalidate !== 'function' || closed || active >= 4) return { outcome: 'unavailable' as const };
      active++;
      let done = false, settled = false, pending = 0, released = false, timer: ReturnType<typeof setTimeout> | undefined;
      const release = () => { if (settled && !pending && !released) { released = true; active--; } };
      const guard = () => { const now = Date.now(); if (closed || done || client.options.namespace !== namespace || expires <= now || expires > now + 86400000) throw new Error(); };
      const track = async <T>(work: Promise<T>) => { pending++; try { return await work; } finally { pending--; release(); } };
      const current = async () => { guard(); if (await track(Promise.resolve().then(revalidate)) !== undefined) throw new Error(); guard(); };
      const rpc = async <T>(work: () => Promise<T>) => {
        await current(); const value = await track(client.withDeadline(Date.now() + 5000, () => { guard(); return work(); })); await current(); return value;
      };
      const inspect = async () => {
        const description = await rpc(() => client.workflow.getHandle(workflowId).describe());
        if (description.workflowId !== workflowId || !runId(description.runId) || description.type !== 'developIntent'
          || description.taskQueue !== taskQueue || !states.has(description.status.name) || description.status.name === 'CONTINUED_AS_NEW') throw new Error();
        // Fetch only the initial event. Never expose or decode role results/history.
        const first = await rpc(() => client.workflowService.getWorkflowExecutionHistory({ namespace,
          execution: { workflowId, runId: description.runId }, maximumPageSize: 1, waitNewEvent: false })).catch(() => { throw new Error('Initial development event unavailable.'); });
        const event = first.history?.events?.[0], started = event?.workflowExecutionStartedEventAttributes;
        const payload = started?.input?.payloads?.[0], decoder = new TextDecoder('utf-8', { fatal: true });
        if (Number(event?.eventId) !== 1 || !started || started.workflowType?.name !== 'developIntent' || started.taskQueue?.name !== taskQueue
          || started.input?.payloads?.length !== 1 || !payload?.data || payload.data.byteLength > 4096
          || !payload.metadata?.encoding || decoder.decode(payload.metadata.encoding) !== 'json/plain'
          || Number(started.workflowExecutionTimeout?.seconds) !== 480 || Number(started.workflowExecutionTimeout?.nanos ?? 0) !== 0) throw new Error();
        const actual = parseDevelopmentTarget(JSON.parse(decoder.decode(payload.data)));
        if (Object.keys(target).some(k => actual[k as keyof typeof actual] !== target[k as keyof typeof target])) throw new Error();
        return { outcome: 'acknowledged' as const, workflowId, runId: description.runId,
          state: description.status.name as 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TERMINATED' | 'TIMED_OUT' };
      };
      const work = Promise.resolve().then(async () => {
        // REJECT_DUPLICATE applies only while closed executions are retained.
        // SQL execution authority lasts at most 24h; verify at least that retention.
        const observed = await rpc(() => client.workflowService.describeNamespace({ namespace }));
        const retention = Number(observed.config?.workflowExecutionRetentionTtl?.seconds);
        if (observed.namespaceInfo?.name !== namespace || observed.namespaceInfo.state !== 1 || !Number.isSafeInteger(retention) || retention < 86400) throw new Error();
        try { return await inspect(); } catch (error) { if (!(error instanceof WorkflowNotFoundError)) throw error; }
        await current();
        try { await rpc(() => startIntentDevelopment(client, taskQueue, target)); }
        catch (error) { if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error; }
        return await inspect();
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error()), 30000); })]); }
      catch { return { outcome: 'unknown' as const }; }
      finally { done = true; if (timer) clearTimeout(timer); }
    },
    close() { closed = true; },
  };
}

/** Trusted internal caller binds the queue; only the reference enters history. */
export function startCandidateBundleSave(client: Client, taskQueue: string, raw: unknown) {
  const target = parseCandidateSaveTarget(raw);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?![\s\S])/.test(taskQueue)) throw new Error('Invalid candidate save task queue.');
  return client.workflow.start('saveCandidateBundle', { workflowId: candidateSaveWorkflowId(target), taskQueue, args: [target],
    workflowExecutionTimeout: '5 minutes', workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL,
    workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE });
}

/** Read-only fixed parent guard. Caller owns the configured connection and current identity. */
export function createRecordedBriefFailedParentGuard(client: Client, configuration: { namespace: string; taskQueue: string; plan: unknown }) {
  if (!configuration || Object.keys(configuration).length !== 3 || !['namespace', 'taskQueue', 'plan'].every(key => Object.hasOwn(configuration, key))) throw new Error('Invalid recovery parent binding.');
  const plan = parseRecordedBriefRecoveryPlan(configuration.plan), { namespace, taskQueue } = configuration;
  for (const value of [namespace, taskQueue]) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new Error('Invalid recovery parent binding.');
  }
  const id = recordedBriefWorkflowId(plan.target);
  if (client.options.namespace !== namespace) throw new Error('Invalid recovery parent binding.');
  Object.freeze(plan.target.scope); Object.freeze(plan.target); Object.freeze(plan);
  return Object.freeze({ plan, async verify() {
    try {
      if (client.options.namespace !== namespace) throw new Error();
      // Inspect the current execution, not a historical run selected by the request.
      const result = await client.workflow.getHandle(id).describe();
      if (client.options.namespace !== namespace || result.workflowId !== id || result.runId !== plan.failedRunId ||
        result.type !== 'projectRecordedBrief' || result.taskQueue !== taskQueue || result.status.name !== 'FAILED') throw new Error();
    } catch { throw new Error('Recorded Brief failed parent could not be verified.'); }
  } });
}

/** Trusted internal start only. Public recovery grants/managed runtime remain separate work. */
export async function startRecordedBriefRecovery(client: Client,
  configuration: { namespace: string; sourceTaskQueue: string; taskQueue: string; plan: unknown }) {
  if (!configuration || Object.keys(configuration).length !== 4 || !['namespace', 'sourceTaskQueue', 'taskQueue', 'plan'].every(key => Object.hasOwn(configuration, key))) throw new Error('Invalid recovery binding.');
  const { namespace, sourceTaskQueue, taskQueue } = configuration;
  const plan = parseRecordedBriefRecoveryPlan(configuration.plan);
  if (typeof taskQueue !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(taskQueue) ||
    taskQueue === sourceTaskQueue) throw new Error('Invalid recovery task queue.');
  const guard = createRecordedBriefFailedParentGuard(client, { namespace, taskQueue: sourceTaskQueue, plan });
  await guard.verify();
  return client.workflow.start('recoverRecordedBrief', { workflowId: recordedBriefRecoveryWorkflowId(plan), taskQueue, args: [plan],
    workflowExecutionTimeout: '5 minutes', workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL,
    workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE });
}

/** Trusted internal dispatch only. No public route, scheduler registration or authority derivation. */
export function startRecordedBriefProjection(client: Client, taskQueue: string, raw: unknown) {
  const target = parseRecordedBriefTarget(raw);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(taskQueue)) throw new Error('Invalid recorded Brief task queue.');
  return client.workflow.start('projectRecordedBrief', { workflowId: recordedBriefWorkflowId(target), taskQueue, args: [target],
    workflowExecutionTimeout: '5 minutes', workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL,
    workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE });
}

/** Trusted administrative start only; no public route or unverified tenant input. */
export function startReconciliation(client: Client, taskQueue: string, raw: unknown) {
  const plan = parsePlan(raw);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(taskQueue)) throw new Error('Invalid reconciliation task queue.');
  return client.workflow.start('reconcileItem', { workflowId: workflowId(plan.scope), taskQueue, args: [plan],
    workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL,
    workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE,
  });
}

/** Trusted internal start only. Public tool authorization and production source verification are separate. */
export function startGateWatch(client: Client, taskQueue: string, raw: unknown) {
  const plan = parseGateWatchPlan(raw);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(taskQueue)) throw new Error('Invalid gate watch task queue.');
  return client.workflow.start('watchGateDecision', { workflowId: gateWatchId(plan.target), taskQueue, args: [plan],
    workflowIdConflictPolicy: WorkflowIdConflictPolicy.FAIL, workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE });
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

const runId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const states = new Set(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TERMINATED', 'CONTINUED_AS_NEW', 'TIMED_OUT']);

/** Owns a separate dispatch connection, not the worker's failed-parent connection.
 * Current caller authorization belongs to the shared registry, never this adapter. */
export async function createManagedRecordedBriefRecoveryScheduler(client: Client, rawConfiguration: unknown, closeConnection: () => Promise<void>) {
  let closing: Promise<void> | undefined;
  const release = () => closing ??= Promise.resolve().then(closeConnection);
  let configuration: { namespace: string; sourceTaskQueue: string; taskQueue: string; plan: ReturnType<typeof parseRecordedBriefRecoveryPlan> };
  try {
    if (!rawConfiguration || typeof rawConfiguration !== 'object' || Array.isArray(rawConfiguration) ||
      Object.keys(rawConfiguration).length !== 4 ||
      !['namespace', 'sourceTaskQueue', 'taskQueue', 'plan'].every(key => Object.hasOwn(rawConfiguration, key))) throw new Error();
    const supplied = rawConfiguration as Record<string, unknown>;
    const { namespace, sourceTaskQueue, taskQueue } = supplied;
    for (const value of [namespace, sourceTaskQueue, taskQueue]) {
      if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new Error();
    }
    if (sourceTaskQueue === taskQueue) throw new Error();
    const guard = createRecordedBriefFailedParentGuard(client, {
      namespace: namespace as string, taskQueue: sourceTaskQueue as string, plan: supplied.plan,
    });
    configuration = Object.freeze({ namespace: namespace as string, sourceTaskQueue: sourceTaskQueue as string,
      taskQueue: taskQueue as string, plan: guard.plan });
  } catch {
    try { await release(); } catch { throw new Error('Recorded Brief recovery scheduler initialization cleanup could not be confirmed.'); }
    throw new Error('Recorded Brief recovery scheduler could not be initialized.');
  }
  const { namespace, taskQueue, plan } = configuration, workflowId = recordedBriefRecoveryWorkflowId(plan);
  let state: 'running' | 'draining' | 'stopped' | 'failed' = 'running';
  let active = false, attempted = false, drained: (() => void) | undefined, shutdown: Promise<void> | undefined;
  const checkBinding = () => { if (client.options.namespace !== namespace) throw new Error('Recorded Brief recovery scheduler binding changed.'); };
  const invoke = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (state !== 'running' || active) throw new Error('Recorded Brief recovery scheduler is not accepting operations.');
    checkBinding(); active = true;
    try { return await operation(); } finally { active = false; drained?.(); }
  };
  const scheduler = Object.freeze({ plan, workflowId,
    start: () => invoke(async () => {
      if (attempted) return { workflowId, outcome: 'already-attempted' as const };
      // Consume before parent inspection as well as start: uncertainty never unlocks retry.
      attempted = true;
      try {
        const handle = await startRecordedBriefRecovery(client, configuration); checkBinding();
        if (!runId(handle.firstExecutionRunId)) throw new Error();
        return { workflowId, outcome: 'started' as const, runId: handle.firstExecutionRunId };
      } catch (error) {
        return { workflowId, outcome: client.options.namespace === namespace && error instanceof WorkflowExecutionAlreadyStartedError ? 'duplicate' as const : 'unknown' as const };
      }
    }),
    // Status observes the recovery, even if its original parent is no longer eligible.
    inspect: () => invoke(async () => {
      try {
        const result = await client.workflow.getHandle(workflowId).describe(); checkBinding();
        if (result.workflowId !== workflowId || result.type !== 'recoverRecordedBrief' || result.taskQueue !== taskQueue ||
          !runId(result.runId) || !states.has(result.status.name)) throw new Error();
        return { workflowId, outcome: 'found' as const, runId: result.runId, state: result.status.name };
      } catch (error) {
        return { workflowId, outcome: client.options.namespace === namespace && error instanceof WorkflowNotFoundError ? 'not-found' as const : 'unknown' as const };
      }
    }),
  });
  return Object.freeze({ scheduler, status: () => ({ state, active, attempted }),
    shutdown(): Promise<void> {
      if (shutdown) return shutdown;
      state = 'draining';
      const wait = active ? new Promise<void>(resolve => { drained = resolve; }) : Promise.resolve();
      shutdown = wait.then(release).then(() => { drained = undefined; state = 'stopped'; }, () => {
        drained = undefined; state = 'failed'; throw new Error('Recorded Brief recovery scheduler shutdown could not be confirmed.');
      });
      return shutdown;
    },
  });
}

/** Owns one explicitly supplied connection and one fixed operation. This internal
 * client neither authenticates callers nor admits receipts/paths. No public route,
 * polling, automatic retry, worker registration or live runtime binding is added. */
export async function createManagedRecordedBriefScheduler(client: Client, rawConfiguration: unknown, closeConnection: () => Promise<void>) {
  let closing: Promise<void> | undefined;
  const release = () => closing ??= Promise.resolve().then(closeConnection);
  let configuration: { namespace: string; taskQueue: string };
  let target: ReturnType<typeof parseRecordedBriefTarget>;
  try {
    if (!rawConfiguration || typeof rawConfiguration !== 'object' || Array.isArray(rawConfiguration) ||
      Object.keys(rawConfiguration).length !== 3 ||
      !['namespace', 'taskQueue', 'target'].every(key => Object.hasOwn(rawConfiguration, key))) throw new Error();
    const supplied = rawConfiguration as Record<string, unknown>;
    for (const value of [supplied.namespace, supplied.taskQueue]) {
      if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new Error();
    }
    configuration = { namespace: supplied.namespace as string, taskQueue: supplied.taskQueue as string };
    target = parseRecordedBriefTarget(supplied.target);
    Object.freeze(target.scope); Object.freeze(target);
    if (client.options.namespace !== configuration.namespace) throw new Error();
  } catch {
    try { await release(); } catch { throw new Error('Recorded Brief scheduler initialization cleanup could not be confirmed.'); }
    throw new Error('Recorded Brief scheduler could not be initialized.');
  }
  const { namespace, taskQueue } = configuration, workflowId = recordedBriefWorkflowId(target);
  let state: 'running' | 'draining' | 'stopped' | 'failed' = 'running';
  let active = false, attempted = false, drained: (() => void) | undefined, shutdown: Promise<void> | undefined;
  const checkBinding = () => { if (client.options.namespace !== namespace) throw new Error('Recorded Brief scheduler binding changed.'); };
  const invoke = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (state !== 'running' || active) throw new Error('Recorded Brief scheduler is not accepting operations.');
    checkBinding(); active = true;
    try { return await operation(); }
    finally { active = false; drained?.(); }
  };
  const scheduler = Object.freeze({ target, workflowId,
    start: () => invoke(async () => {
      if (attempted) return { workflowId, outcome: 'already-attempted' as const };
      // Set before dispatch: a missing acknowledgment cannot unlock another start.
      attempted = true;
      try {
        const handle = await startRecordedBriefProjection(client, taskQueue, target);
        checkBinding();
        if (!runId(handle.firstExecutionRunId)) throw new Error();
        return { workflowId, outcome: 'started' as const, runId: handle.firstExecutionRunId };
      } catch (error) {
        return { workflowId, outcome: client.options.namespace === namespace && error instanceof WorkflowExecutionAlreadyStartedError ? 'duplicate' as const : 'unknown' as const };
      }
    }),
    inspect: () => invoke(async () => {
      try {
        const result = await client.workflow.getHandle(workflowId).describe();
        checkBinding();
        if (result.workflowId !== workflowId || result.type !== 'projectRecordedBrief' || result.taskQueue !== taskQueue ||
          !runId(result.runId) || !states.has(result.status.name)) throw new Error();
        return { workflowId, outcome: 'found' as const, runId: result.runId, state: result.status.name };
      } catch (error) {
        return { workflowId, outcome: client.options.namespace === namespace && error instanceof WorkflowNotFoundError ? 'not-found' as const : 'unknown' as const };
      }
    }),
  });
  return Object.freeze({ scheduler, status: () => ({ state, active, attempted }),
    shutdown(): Promise<void> {
      if (shutdown) return shutdown;
      state = 'draining';
      const wait = active ? new Promise<void>(resolve => { drained = resolve; }) : Promise.resolve();
      shutdown = wait.then(release).then(() => { drained = undefined; state = 'stopped'; }, () => {
        drained = undefined; state = 'failed'; throw new Error('Recorded Brief scheduler shutdown could not be confirmed.');
      });
      return shutdown;
    },
  });
}
