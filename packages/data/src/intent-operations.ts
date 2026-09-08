import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { newIntentStep, planIntentStepTransition, type IntentStepRecord, type IntentStepEvent } from '@steer/domain/intent-step';
import { modelBudgetBindingSchema } from './model-budget.ts';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const integer = z.number().int().nonnegative().safe();
const role = z.enum(['architect', 'test-agent', 'candidate-save']);
const configuration = z.strictObject({ organizationId: id, subject: id, productId: id, repository: id, branch: id,
  action: z.enum(['develop', 'candidate-save']), configurationRevision: id, recordsPolicyDigest: digest,
  expiresAt: z.iso.datetime(), budget: modelBudgetBindingSchema.nullable() }).superRefine((c, ctx) => {
  if ((c.action === 'develop') !== Boolean(c.budget) || (c.budget && (c.budget.organizationId !== c.organizationId
    || c.budget.subject !== c.subject || c.budget.configurationRevision !== c.configurationRevision
    || c.budget.architectMicrousd > c.budget.capMicrousd || c.budget.testAgentMicrousd > c.budget.capMicrousd)))
    ctx.addIssue({ code: 'custom', message: 'Invalid execution budget binding.' });
});
const submission = z.strictObject({ draftId: uuid, draftRevision: integer.positive(), inputDigest: digest });
const reference = z.strictObject({ operationId: uuid, inputDigest: digest });
const stepReference = reference.extend({ stepId: role, stepInputDigest: digest, predecessorResultDigest: digest.nullable() });
const claimSchema = stepReference.extend({ owner: id, leaseMs: integer.min(1).max(300000) });
const mutationSchema = stepReference.extend({ event: z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('commit-dispatch'), owner: id, fencingToken: integer.positive() }),
  z.strictObject({ type: z.literal('checkpoint'), owner: id, fencingToken: integer.positive(), resultDigest: digest, resultRef: uuid }),
  z.strictObject({ type: z.literal('known-failure'), owner: id, fencingToken: integer.positive() }),
  z.strictObject({ type: z.literal('outcome-unknown'), fencingToken: integer.positive() }),
]) });
const operationBinding = submission.extend({ configurationDigest: digest });
const stepBinding = z.strictObject({ organizationId: id, operationId: uuid, stepId: role, subject: id,
  draftId: uuid, draftRevision: integer.positive(), inputDigest: digest, configurationRevision: id });
const recordSchema = z.strictObject({ binding: stepBinding, state: z.enum(['claimed', 'dispatch-committed', 'outcome-unknown', 'succeeded', 'failed-known']),
  fencingToken: integer.positive(), owner: id, reservationId: uuid, leaseUntil: integer.nullable(), updatedAt: integer, resultDigest: digest.nullable(),
}).superRefine((r, ctx) => {
  if ((r.state === 'claimed') !== (r.leaseUntil !== null) || (r.leaseUntil !== null && r.leaseUntil <= r.updatedAt)
    || (r.state === 'succeeded') !== (r.resultDigest !== null)) ctx.addIssue({ code: 'custom', message: 'Invalid durable step state.' });
});
type Configuration = z.infer<typeof configuration>;
export const intentOperationConfigurationSchema = configuration;
export type IntentOperationReference = z.infer<typeof reference>;
type Operation = z.infer<typeof operationBinding> & { operationId: string };
type Step = { record: IntentStepRecord; predecessorResultDigest: string | null; resultRef: string | null; budgetId: string | null };
type Result<T> = { outcome: 'ok'; value: T; dispatchAllowed: boolean }
  | { outcome: 'conflict' | 'unknown' | 'unavailable'; dispatchAllowed: false };
export type IntentCheckpointReference = { binding: IntentStepRecord['binding']; resultRef: string; resultDigest: string; recordsPolicyDigest: string };
class Conflict extends Error {}
class Unavailable extends Error {}
const clearScope = "SELECT set_config('steer.execution_organization','',false), set_config('steer.execution_subject','',false), set_config('steer.usage_organization','',false), set_config('steer.usage_budget','',false), set_config('steer.usage_subject','',false)";
const json = (v: unknown) => JSON.stringify(v);
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v;
}

/** Uninstalled metadata adapter. Configuration is not policy/spending authority.
 * Trusted authorize verifies current identity, scope, source and records authority.
 * verifyCheckpoint must read back already-durable, authorized result bytes against
 * their exact input/configuration binding; this adapter stores no result content.
 * No retry, expired-ID recreation, refund, provider call or SQL across model work.
 */
export function createIntentOperationStore(pool: DatabasePool, rawConfiguration: unknown, dependencies: {
  authorize: (context: Readonly<{ configuration: Configuration; request: unknown }>) => Promise<void>;
  verifyCheckpoint: (reference: Readonly<IntentCheckpointReference>) => Promise<void>;
}) {
  const config = freeze(configuration.parse(rawConfiguration));
  if (typeof dependencies.authorize !== 'function' || typeof dependencies.verifyCheckpoint !== 'function') throw new Error('Missing execution authority services.');
  const configurationDigest = createHash('sha256').update(json(config)).digest('hex');
  let closed = false, active = 0;
  async function transaction<T>(request: unknown, work: (client: PoolClient, verify: (step: Step) => Promise<void>) => Promise<{ value: T; dispatchAllowed: boolean }>): Promise<Result<T>> {
    if (closed || active >= 8) return { outcome: 'unavailable', dispatchAllowed: false };
    active++;
    let client: PoolClient | undefined, committing = false, broken = false;
    let pending = 0, finished = false;
    const releaseAdmission = () => { if (finished && pending === 0) { finished = false; active--; } };
    const bounded = async <T>(task: Promise<T>): Promise<T> => {
      pending++; void task.finally(() => { pending--; releaseAdmission(); }).catch(() => {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Unavailable()), 3000); })]); }
      finally { if (timer) clearTimeout(timer); }
    };
    const authorize = async () => {
      if (await bounded(dependencies.authorize(freeze({ configuration: config, request }))) !== undefined) throw new Unavailable();
    };
    try {
      await authorize();
      if (closed) throw new Unavailable();
      client = await bounded(pool.connect().then(value => { if (finished || closed) { value.release(true); throw new Unavailable(); } return value; }));
      if (!client) throw new Unavailable();
      await applyRuntimeQueryLimits(client); await client.query(clearScope); await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const runtime = (await client.query(`SELECT r.rolname, session_user AS login_role, r.rolsuper, r.rolbypassrls,
        EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname IN ('steer_execution','steer_usage') AND c.relowner=r.oid) AS owns_objects
        FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
      if (!runtime || runtime.rolname !== 'steer_app' || runtime.login_role !== 'steer_app' || runtime.rolsuper || runtime.rolbypassrls || runtime.owns_objects) throw new Unavailable();
      await client.query("SELECT set_config('steer.execution_organization',$1,true), set_config('steer.execution_subject',$2,true), set_config('steer.usage_organization',$1,true), set_config('steer.usage_subject',$2,true), set_config('steer.usage_budget',$3,true)",
        [config.organizationId, config.subject, config.budget?.budgetId ?? '']);
      const time = await now(client);
      if (Date.parse(config.expiresAt) <= time || Date.parse(config.expiresAt) > time + 86400000) throw new Unavailable();
      const verify = async (step: Step) => {
        if (!step.resultRef || !step.record.resultDigest) throw new Unavailable();
        if (await bounded(dependencies.verifyCheckpoint(freeze({ binding: step.record.binding, resultRef: step.resultRef,
          resultDigest: step.record.resultDigest, recordsPolicyDigest: config.recordsPolicyDigest }))) !== undefined) throw new Unavailable();
      };
      const result = await work(client, verify);
      const beforeCommit = await now(client);
      if (closed || beforeCommit < time || beforeCommit >= Date.parse(config.expiresAt)) throw new Unavailable();
      committing = true; await client.query('COMMIT');
      await client.query(clearScope);
      await authorize();
      const afterCommit = await now(client);
      if (closed || afterCommit < beforeCommit || afterCommit >= Date.parse(config.expiresAt)) throw new Unavailable();
      return freeze({ outcome: 'ok', ...result });
    } catch (error) {
      broken = committing;
      if (client) try { await client.query('ROLLBACK'); await client.query(clearScope); } catch { broken = true; }
      return { outcome: committing ? 'unknown' : error instanceof Conflict ? 'conflict' : error instanceof Unavailable ? 'unavailable' : 'unknown', dispatchAllowed: false };
    } finally { client?.release(broken); finished = true; releaseAdmission(); }
  }
  async function now(client: PoolClient) {
    return integer.parse(Number((await client.query("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now")).rows[0]?.now));
  }
  async function operation(client: PoolClient, ref: IntentOperationReference): Promise<Operation> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,2))', [json([config.organizationId, ref.operationId])]);
    const row = (await client.query(`SELECT * FROM steer_execution.intent_operations WHERE organization_id=$1 AND operation_id=$2 AND subject=$3
      AND clock_timestamp() < expires_at`, [config.organizationId, ref.operationId, config.subject])).rows[0];
    if (!row) throw new Unavailable();
    const value = operationBinding.parse(row.binding);
    if (value.configurationDigest !== configurationDigest || value.inputDigest !== ref.inputDigest || value.draftId !== row.draft_id
      || value.draftRevision !== Number(row.draft_revision) || row.action !== config.action || row.configuration_revision !== config.configurationRevision) throw new Conflict();
    return { ...value, operationId: ref.operationId };
  }
  async function readStep(client: PoolClient, op: Operation, stepId: string): Promise<Step | null> {
    const row = (await client.query('SELECT * FROM steer_execution.intent_steps WHERE organization_id=$1 AND operation_id=$2 AND step_id=$3 AND subject=$4 FOR UPDATE',
      [config.organizationId, op.operationId, stepId, config.subject])).rows[0];
    if (!row) return null;
    const record = recordSchema.parse(row.record);
    if (record.binding.organizationId !== config.organizationId || record.binding.subject !== config.subject || record.binding.operationId !== op.operationId
      || record.binding.stepId !== stepId || record.binding.draftId !== op.draftId || record.binding.draftRevision !== op.draftRevision
      || record.binding.configurationRevision !== config.configurationRevision || record.reservationId !== row.reservation_id
      || row.budget_id !== (config.budget?.budgetId ?? null) || ((record.state === 'succeeded') !== (row.result_ref !== null))) throw new Conflict();
    return { record, predecessorResultDigest: digest.nullable().parse(row.predecessor_result_digest),
      resultRef: uuid.nullable().parse(row.result_ref), budgetId: row.budget_id };
  }
  async function predecessor(client: PoolClient, op: Operation, request: z.infer<typeof stepReference>, verify: (step: Step) => Promise<void>) {
    const roles = config.action === 'develop' ? ['architect', 'test-agent'] : ['candidate-save'];
    if (!roles.includes(request.stepId)) throw new Conflict();
    if (request.stepId !== 'test-agent') { if (request.predecessorResultDigest !== null) throw new Conflict(); return; }
    const previous = await readStep(client, op, 'architect');
    if (!previous || previous.record.state !== 'succeeded' || previous.record.resultDigest !== request.predecessorResultDigest) throw new Unavailable();
    await verify(previous);
  }
  async function reserve(client: PoolClient, op: Operation, stepId: string, reservationId: string, existing: boolean) {
    const b = config.budget;
    if (!b) return;
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [json([b.organizationId, b.budgetId])]);
    const budget = (await client.query(`SELECT * FROM steer_usage.model_budgets WHERE organization_id=$1 AND budget_id=$2 AND subject=$3
      AND active AND clock_timestamp() >= valid_after AND clock_timestamp() < expires_at`, [b.organizationId, b.budgetId, b.subject])).rows[0];
    if (!budget || budget.configuration_revision !== b.configurationRevision || budget.approval_digest !== b.approvalDigest
      || BigInt(budget.cap_microusd) !== BigInt(b.capMicrousd) || BigInt(budget.architect_microusd) !== BigInt(b.architectMicrousd)
      || BigInt(budget.test_agent_microusd) !== BigInt(b.testAgentMicrousd)) throw new Unavailable();
    const amount = stepId === 'architect' ? b.architectMicrousd : b.testAgentMicrousd;
    if (existing) {
      const row = (await client.query(`SELECT * FROM steer_usage.model_reservations WHERE organization_id=$1 AND budget_id=$2
        AND reservation_id=$3 AND operation_id=$4 AND step_id=$5 AND subject=$6`, [b.organizationId, b.budgetId, reservationId, op.operationId, stepId, b.subject])).rows[0];
      if (!row || row.role !== stepId || BigInt(row.amount_microusd) !== BigInt(amount)) throw new Conflict();
    } else {
      const usage = (await client.query('SELECT count(*) AS count, COALESCE(sum(amount_microusd),0) AS used FROM steer_usage.model_reservations WHERE organization_id=$1 AND budget_id=$2', [b.organizationId, b.budgetId])).rows[0];
      if (BigInt(usage.count) >= 10000n || BigInt(usage.used) + BigInt(amount) > BigInt(b.capMicrousd)) throw new Unavailable();
      await client.query(`INSERT INTO steer_usage.model_reservations (organization_id,budget_id,reservation_id,subject,role,amount_microusd,operation_id,step_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$5)`, [b.organizationId, b.budgetId, reservationId, b.subject, stepId, amount, op.operationId]);
    }
  }
  return {
    create(raw: unknown) {
      const input = freeze(submission.parse(raw)), binding = { ...input, configurationDigest };
      return transaction(input, async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1))', [config.organizationId]);
        const count = (await client.query('SELECT count(*) AS count FROM steer_execution.intent_operations WHERE organization_id=$1 AND subject=$2', [config.organizationId, config.subject])).rows[0];
        const prior = (await client.query(`SELECT operation_id,binding FROM steer_execution.intent_operations WHERE organization_id=$1 AND draft_id=$2 AND draft_revision=$3 AND action=$4 AND configuration_revision=$5`,
          [config.organizationId, input.draftId, input.draftRevision, config.action, config.configurationRevision])).rows[0];
        let operationId = prior?.operation_id as string | undefined;
        if (!prior) {
          if (BigInt(count.count) >= 10000n) throw new Unavailable();
          operationId = randomUUID();
          const inserted = await client.query(`INSERT INTO steer_execution.intent_operations (organization_id,operation_id,subject,draft_id,draft_revision,action,configuration_revision,binding,expires_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) ON CONFLICT DO NOTHING RETURNING operation_id`,
            [config.organizationId, operationId, config.subject, input.draftId, input.draftRevision, config.action, config.configurationRevision, json(binding), config.expiresAt]);
          if (inserted.rowCount !== 1) throw new Conflict();
        }
        const op = await operation(client, { operationId: uuid.parse(operationId), inputDigest: input.inputDigest });
        return { value: { ...op, created: !prior }, dispatchAllowed: false };
      });
    },
    inspect(raw: unknown) {
      const ref = freeze(reference.parse(raw));
      return transaction(ref, async client => {
        const op = await operation(client, ref), steps: Step[] = [];
        for (const name of config.action === 'develop' ? ['architect', 'test-agent'] : ['candidate-save']) {
          const step = await readStep(client, op, name); if (step) steps.push(step);
        }
        return { value: { operation: op, steps }, dispatchAllowed: false };
      });
    },
    claim(raw: unknown) {
      const request = freeze(claimSchema.parse(raw));
      return transaction(request, async (client, verify) => {
        const op = await operation(client, request); await predecessor(client, op, request, verify);
        const prior = await readStep(client, op, request.stepId);
        const binding = { organizationId: config.organizationId, operationId: op.operationId, stepId: request.stepId, subject: config.subject,
          draftId: op.draftId, draftRevision: op.draftRevision, inputDigest: request.stepInputDigest, configurationRevision: config.configurationRevision };
        if (prior && (prior.record.binding.inputDigest !== binding.inputDigest || prior.predecessorResultDigest !== request.predecessorResultDigest)) throw new Conflict();
        if (prior && (prior.record.state !== 'claimed' || await now(client) < prior.record.leaseUntil!)) return { value: prior, dispatchAllowed: false };
        const reservationId = prior?.record.reservationId ?? randomUUID();
        await reserve(client, op, request.stepId, reservationId, Boolean(prior));
        const time = await now(client), initial = prior?.record ?? newIntentStep(binding, time);
        const record = planIntentStepTransition(initial, binding, { type: 'claim', owner: request.owner, reservationId, leaseMs: request.leaseMs }, time);
        if (prior) {
          const changed = await client.query('UPDATE steer_execution.intent_steps SET record=$1::jsonb WHERE organization_id=$2 AND operation_id=$3 AND step_id=$4 AND record=$5::jsonb',
            [json(record), config.organizationId, op.operationId, request.stepId, json(prior.record)]);
          if (changed.rowCount !== 1) throw new Conflict();
        } else await client.query(`INSERT INTO steer_execution.intent_steps (organization_id,operation_id,subject,step_id,record,predecessor_result_digest,budget_id,reservation_id)
          VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`, [config.organizationId, op.operationId, config.subject, request.stepId, json(record), request.predecessorResultDigest, config.budget?.budgetId ?? null, reservationId]);
        return { value: { record, predecessorResultDigest: request.predecessorResultDigest, resultRef: null, budgetId: config.budget?.budgetId ?? null }, dispatchAllowed: false };
      });
    },
    transition(raw: unknown) {
      const request = freeze(mutationSchema.parse(raw));
      return transaction(request, async (client, verify) => {
        const op = await operation(client, request), prior = await readStep(client, op, request.stepId);
        if (!prior || prior.record.binding.inputDigest !== request.stepInputDigest || prior.predecessorResultDigest !== request.predecessorResultDigest) throw new Conflict();
        const event = request.event;
        if (event.fencingToken !== prior.record.fencingToken || ('owner' in event && event.owner !== prior.record.owner)) throw new Conflict();
        if (event.type === 'commit-dispatch') {
          if (prior.record.state !== 'claimed') return { value: prior, dispatchAllowed: false };
          await predecessor(client, op, request, verify); await reserve(client, op, request.stepId, prior.record.reservationId!, true);
        } else if (event.type === 'checkpoint') {
          if (prior.record.state === 'succeeded') {
            if (prior.record.resultDigest !== event.resultDigest || prior.resultRef !== event.resultRef) throw new Conflict();
            await verify(prior); return { value: prior, dispatchAllowed: false };
          }
          if (prior.record.state !== 'dispatch-committed') throw new Conflict();
          await verify({ ...prior, resultRef: event.resultRef, record: { ...prior.record, resultDigest: event.resultDigest } });
        }
        let record: IntentStepRecord;
        try { record = planIntentStepTransition(prior.record, prior.record.binding, event as IntentStepEvent, await now(client)); } catch { throw new Conflict(); }
        const resultRef = event.type === 'checkpoint' ? event.resultRef : null;
        const changed = await client.query('UPDATE steer_execution.intent_steps SET record=$1::jsonb,result_ref=$2 WHERE organization_id=$3 AND operation_id=$4 AND step_id=$5 AND record=$6::jsonb',
          [json(record), resultRef, config.organizationId, op.operationId, request.stepId, json(prior.record)]);
        if (changed.rowCount !== 1) throw new Conflict();
        return { value: { ...prior, record, resultRef }, dispatchAllowed: event.type === 'commit-dispatch' };
      });
    },
    close: () => { closed = true; },
  };
}
