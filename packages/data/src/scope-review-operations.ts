import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { newIntentStep, planIntentStepTransition, type IntentStepRecord } from '@steer/domain/intent-step';
import { intentScopeInputSchema } from '@steer/tool-registry/intent-revision-contracts';
import { prepareIntentScopeReview } from '@steer/tool-registry/intent-scope-review';
import { modelBudgetBindingSchema } from './model-budget.ts';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const integer = z.number().int().nonnegative().safe();
const revision = integer.min(1).max(1000);
const json = (v: unknown) => JSON.stringify(v);
const hash = (v: unknown) => createHash('sha256').update(json(v)).digest('hex');
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }

export const scopeReviewManifestSchema = z.strictObject({ kind: z.literal('steer-scope-review-manifest/v1'),
  organizationId: id, productId: id, repository: id, draftId: uuid, draftRevision: revision, sourceRevision: revision,
  scopeInputDigest: digest, sourceSnapshotDigest: digest, planDigest: digest, profileDigest: digest, preparationDigest: digest,
  batches: z.array(z.strictObject({ batchId: digest, inputDigest: digest })).min(1).max(8),
}).superRefine((m, ctx) => {
  if (m.sourceRevision > m.draftRevision || new Set(m.batches.map(b => b.batchId)).size !== m.batches.length)
    ctx.addIssue({ code: 'custom', message: 'Invalid scope manifest.' });
});
/** Derives metadata only from the exact source/profile preparation, never from model output.
 * Current source, owner, lifecycle and records authority are still mandatory at use. */
export async function prepareScopeReviewManifest(scope: unknown, evidence: unknown, profile: unknown, draftRevision: number) {
  const input = intentScopeInputSchema.parse(scope), prepared = await prepareIntentScopeReview(input, evidence, profile);
  return freeze(scopeReviewManifestSchema.parse({ kind: 'steer-scope-review-manifest/v1', organizationId: input.organizationId,
    productId: input.productId, repository: input.repository, draftId: input.draftId, sourceRevision: input.sourceRevision, draftRevision,
    scopeInputDigest: prepared.plan.scopeInputDigest, sourceSnapshotDigest: prepared.plan.sourceSnapshotDigest,
    planDigest: prepared.plan.planDigest, profileDigest: prepared.batches[0]?.packet.profileDigest,
    preparationDigest: prepared.preparationDigest, batches: prepared.batches.map(b => ({ batchId: b.metadata.batchId, inputDigest: b.inputDigest })) }));
}
export const scopeReviewConfigurationSchema = z.strictObject({ organizationId: id, subject: id, productId: id, repository: id, branch: id,
  configurationRevision: id, recordsPolicyDigest: digest, expiresAt: z.iso.datetime(), budget: modelBudgetBindingSchema,
  scopeTerms: z.strictObject({ approvalDigest: digest, profileDigest: digest, amountMicrousd: integer.min(1).max(1e12) }),
}).superRefine((c, ctx) => {
  const b = c.budget;
  if (b.organizationId !== c.organizationId || b.subject !== c.subject || b.configurationRevision !== c.configurationRevision
    || b.architectMicrousd > b.capMicrousd || b.testAgentMicrousd > b.capMicrousd || c.scopeTerms.amountMicrousd > b.capMicrousd)
    ctx.addIssue({ code: 'custom', message: 'Invalid scope budget binding.' });
});
const reference = z.strictObject({ reviewId: uuid, preparationDigest: digest });
const batchReference = reference.extend({ batchId: digest, inputDigest: digest });
const claimSchema = batchReference.extend({ owner: id, leaseMs: integer.min(1).max(300000) });
const transitionSchema = batchReference.extend({ event: z.strictObject({
  type: z.enum(['commit-dispatch', 'outcome-unknown', 'known-failure']), owner: id, fencingToken: integer.positive(),
}) });
const recordSchema = z.strictObject({ binding: z.strictObject({ organizationId: id, operationId: uuid, stepId: digest, subject: id,
  draftId: uuid, draftRevision: revision, inputDigest: digest, configurationRevision: id }),
  state: z.enum(['claimed', 'dispatch-committed', 'outcome-unknown', 'failed-known']), fencingToken: integer.positive(),
  owner: id, reservationId: uuid, leaseUntil: integer.nullable(), updatedAt: integer, resultDigest: z.null(),
}).superRefine((r, ctx) => {
  if ((r.state === 'claimed') !== (r.leaseUntil !== null) || (r.leaseUntil !== null && r.leaseUntil <= r.updatedAt))
    ctx.addIssue({ code: 'custom', message: 'Invalid scope batch state.' });
});
type Manifest = z.infer<typeof scopeReviewManifestSchema>;
type Configuration = z.infer<typeof scopeReviewConfigurationSchema>;
type Reference = z.infer<typeof reference>;
type Run = { reviewId: string; manifest: Manifest };
type Result<T> = { outcome: 'ok'; value: T; dispatchAllowed: boolean }
  | { outcome: 'conflict' | 'unavailable' | 'unknown'; dispatchAllowed: false };
class Unavailable extends Error {}
class Conflict extends Error {}
const clearScope = "SELECT set_config('steer.execution_organization','',false),set_config('steer.execution_subject','',false),set_config('steer.execution_product','',false),set_config('steer.usage_organization','',false),set_config('steer.usage_subject','',false),set_config('steer.usage_budget','',false)";

/** Uninstalled ownership/reservation adapter, not a runner or authorization service.
 * authorize must verify current owner/product/repository, exact source/preparation,
 * draft lifecycle, adopted records policy and approved role/budget terms. It runs
 * without a leased SQL connection before and after every transaction. Stored
 * metadata and configuration alone never establish any of those facts.
 * Success checkpoints await encrypted observation/result integration; there is
 * deliberately no reset, refund, automatic retry or succeeded-state API here. */
export function createScopeReviewOperationStore(pool: DatabasePool, rawConfiguration: unknown, dependencies: {
  authorize: (context: Readonly<{ configuration: Configuration; request: unknown }>) => Promise<void>;
}) {
  const config = freeze(scopeReviewConfigurationSchema.parse(rawConfiguration)), configurationDigest = hash(config);
  if (typeof dependencies.authorize !== 'function') throw new Error('Missing scope-review authority.');
  let closed = false, active = 0;
  async function transaction<T>(request: unknown, work: (client: PoolClient) => Promise<{ value: T; dispatchAllowed: boolean }>): Promise<Result<T>> {
    if (closed || active >= 8) return { outcome: 'unavailable', dispatchAllowed: false };
    active++;
    let pending = 0, finished = false, ended = false, client: PoolClient | undefined, committing = false, broken = false;
    const drain = () => { if (finished && !pending) { finished = false; active--; } };
    const bounded = async <V>(task: Promise<V>): Promise<V> => {
      pending++; void task.finally(() => { pending--; drain(); }).catch(() => {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Unavailable()), 3000); })]); }
      finally { if (timer) clearTimeout(timer); }
    };
    const authorize = async () => {
      try {
        if (closed || await bounded(dependencies.authorize(freeze({ configuration: config, request }))) !== undefined || closed) throw new Unavailable();
      } catch { throw new Unavailable(); }
    };
    try {
      await authorize();
      client = await bounded(pool.connect().then(c => { if (ended || closed) { c.release(true); throw new Unavailable(); } return c; }));
      if (!client) throw new Unavailable();
      await applyRuntimeQueryLimits(client); await client.query(clearScope); await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const runtime = (await client.query(`SELECT r.rolname,session_user AS login_role,r.rolsuper,r.rolbypassrls,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname IN ('steer_execution','steer_usage') AND c.relowner=r.oid) AS owns_objects
        FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
      if (!runtime || runtime.rolname !== 'steer_app' || runtime.login_role !== 'steer_app' || runtime.rolsuper || runtime.rolbypassrls || runtime.owns_objects) throw new Unavailable();
      await client.query("SELECT set_config('steer.execution_organization',$1,true),set_config('steer.execution_subject',$2,true),set_config('steer.execution_product',$3,true),set_config('steer.usage_organization',$1,true),set_config('steer.usage_subject',$2,true),set_config('steer.usage_budget',$4,true)",
        [config.organizationId, config.subject, config.productId, config.budget.budgetId]);
      const start = await now(client);
      if (Date.parse(config.expiresAt) <= start || Date.parse(config.expiresAt) > start + 86400000) throw new Unavailable();
      const result = await work(client), end = await now(client);
      if (closed || end < start || end >= Date.parse(config.expiresAt)) throw new Unavailable();
      const committedAt = performance.now();
      committing = true; await client.query('COMMIT'); await client.query(clearScope); client.release(); client = undefined;
      // Reauthorization may use the same max-one pool. Never hold a lease/lock over it.
      await authorize();
      const elapsed = performance.now() - committedAt;
      if (elapsed < 0 || elapsed >= 3000 || end + elapsed >= Date.parse(config.expiresAt)) throw new Unavailable();
      return freeze({ outcome: 'ok' as const, ...result });
    } catch (error) {
      broken = committing;
      if (client) try { await client.query('ROLLBACK'); await client.query(clearScope); } catch { broken = true; }
      return { outcome: committing ? 'unknown' : error instanceof Conflict ? 'conflict' : error instanceof Unavailable ? 'unavailable' : 'unknown', dispatchAllowed: false };
    } finally { ended = true; client?.release(broken); finished = true; drain(); }
  }
  async function now(client: PoolClient) {
    return integer.parse(Number((await client.query('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now')).rows[0]?.now));
  }
  function checkManifest(m: Manifest) {
    if (m.organizationId !== config.organizationId || m.productId !== config.productId || m.repository !== config.repository
      || m.profileDigest !== config.scopeTerms.profileDigest) throw new Conflict();
  }
  async function run(client: PoolClient, ref: Reference): Promise<Run> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,3))', [json([config.organizationId, ref.reviewId])]);
    const row = (await client.query(`SELECT * FROM steer_execution.scope_review_runs WHERE organization_id=$1 AND review_id=$2
      AND subject=$3 AND product_id=$4 AND clock_timestamp() < expires_at`, [config.organizationId, ref.reviewId, config.subject, config.productId])).rows[0];
    if (!row) throw new Unavailable();
    const manifest = scopeReviewManifestSchema.parse(row.manifest); checkManifest(manifest);
    if (row.configuration_digest !== configurationDigest || row.preparation_digest !== ref.preparationDigest
      || manifest.preparationDigest !== row.preparation_digest || manifest.draftId !== row.draft_id || manifest.draftRevision !== Number(row.draft_revision)
      || row.expires_at.getTime() !== Date.parse(config.expiresAt)) throw new Conflict();
    return { reviewId: ref.reviewId, manifest };
  }
  function binding(op: Run, batch: { batchId: string; inputDigest: string }) {
    const expected = op.manifest.batches.find(b => b.batchId === batch.batchId);
    if (!expected || expected.inputDigest !== batch.inputDigest) throw new Conflict();
    return { organizationId: config.organizationId, operationId: op.reviewId, stepId: batch.batchId, subject: config.subject,
      draftId: op.manifest.draftId, draftRevision: op.manifest.draftRevision, inputDigest: batch.inputDigest, configurationRevision: config.configurationRevision };
  }
  async function readBatch(client: PoolClient, op: Run, batch: { batchId: string; inputDigest: string }) {
    const expected = binding(op, batch), row = (await client.query(`SELECT * FROM steer_execution.scope_review_batches
      WHERE organization_id=$1 AND review_id=$2 AND batch_id=$3 FOR UPDATE`, [config.organizationId, op.reviewId, batch.batchId])).rows[0];
    if (!row) return null;
    const record = recordSchema.parse(row.record);
    if (json(record.binding) !== json(expected) || row.budget_id !== config.budget.budgetId || record.reservationId !== row.reservation_id) throw new Conflict();
    return record;
  }
  async function reserve(client: PoolClient, op: Run, batchId: string, reservationId: string, existing: boolean) {
    const b = config.budget, t = config.scopeTerms;
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [json([b.organizationId, b.budgetId])]);
    const budget = (await client.query(`SELECT * FROM steer_usage.model_budgets WHERE organization_id=$1 AND budget_id=$2 AND subject=$3
      AND active AND clock_timestamp() >= valid_after AND clock_timestamp() < expires_at`, [b.organizationId,b.budgetId,b.subject])).rows[0];
    const terms = (await client.query(`SELECT * FROM steer_usage.scope_review_terms WHERE organization_id=$1 AND budget_id=$2 AND subject=$3 AND active`, [b.organizationId,b.budgetId,b.subject])).rows[0];
    if (!budget || !terms || budget.configuration_revision !== b.configurationRevision || budget.approval_digest !== b.approvalDigest
      || BigInt(budget.cap_microusd) !== BigInt(b.capMicrousd) || BigInt(budget.architect_microusd) !== BigInt(b.architectMicrousd)
      || BigInt(budget.test_agent_microusd) !== BigInt(b.testAgentMicrousd) || terms.configuration_revision !== config.configurationRevision
      || terms.approval_digest !== t.approvalDigest || terms.profile_digest !== t.profileDigest || BigInt(terms.amount_microusd) !== BigInt(t.amountMicrousd)) throw new Unavailable();
    if (existing) {
      const row = (await client.query(`SELECT * FROM steer_usage.model_reservations WHERE organization_id=$1 AND budget_id=$2 AND reservation_id=$3`, [b.organizationId,b.budgetId,reservationId])).rows[0];
      if (!row || row.operation_id !== op.reviewId || row.step_id !== batchId || row.role !== 'scope-reviewer' || row.subject !== b.subject
        || BigInt(row.amount_microusd) !== BigInt(t.amountMicrousd)) throw new Conflict();
    } else {
      const used = (await client.query('SELECT count(*) AS count,COALESCE(sum(amount_microusd),0) AS used FROM steer_usage.model_reservations WHERE organization_id=$1 AND budget_id=$2', [b.organizationId,b.budgetId])).rows[0];
      if (BigInt(used.count) >= 10000n || BigInt(used.used) + BigInt(t.amountMicrousd) > BigInt(b.capMicrousd)) throw new Unavailable();
      await client.query(`INSERT INTO steer_usage.model_reservations (organization_id,budget_id,reservation_id,subject,role,amount_microusd,operation_id,step_id)
        VALUES ($1,$2,$3,$4,'scope-reviewer',$5,$6,$7)`, [b.organizationId,b.budgetId,reservationId,b.subject,t.amountMicrousd,op.reviewId,batchId]);
    }
  }
  return {
    admit(raw: unknown) {
      const manifest = freeze(scopeReviewManifestSchema.parse(raw));
      return transaction(manifest, async client => {
        checkManifest(manifest);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,4))', [json([config.organizationId,config.subject])]);
        const prior = (await client.query(`SELECT review_id FROM steer_execution.scope_review_runs WHERE organization_id=$1 AND subject=$2
          AND draft_id=$3 AND draft_revision=$4 AND preparation_digest=$5`, [config.organizationId,config.subject,manifest.draftId,manifest.draftRevision,manifest.preparationDigest])).rows[0];
        const reviewId = prior?.review_id ?? randomUUID();
        if (!prior) {
          const count = (await client.query('SELECT count(*) AS count FROM steer_execution.scope_review_runs WHERE organization_id=$1 AND subject=$2', [config.organizationId,config.subject])).rows[0];
          if (BigInt(count.count) >= 10000n) throw new Unavailable();
          await client.query(`INSERT INTO steer_execution.scope_review_runs (organization_id,review_id,subject,product_id,draft_id,draft_revision,preparation_digest,configuration_digest,manifest,expires_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`, [config.organizationId,reviewId,config.subject,config.productId,manifest.draftId,manifest.draftRevision,manifest.preparationDigest,configurationDigest,json(manifest),config.expiresAt]);
        }
        const value = await run(client, { reviewId, preparationDigest: manifest.preparationDigest });
        if (json(value.manifest) !== json(manifest)) throw new Conflict();
        return { value: { ...value, created: !prior }, dispatchAllowed: false };
      });
    },
    inspect(raw: unknown) {
      const ref = freeze(reference.parse(raw));
      return transaction(ref, async client => {
        const op = await run(client, ref), batches: IntentStepRecord[] = [];
        for (const batch of op.manifest.batches) { const record = await readBatch(client, op, batch); if (record) batches.push(record); }
        return { value: { ...op, batches }, dispatchAllowed: false };
      });
    },
    claim(raw: unknown) {
      const request = freeze(claimSchema.parse(raw));
      return transaction(request, async client => {
        const op = await run(client, request), prior = await readBatch(client, op, request);
        if (prior && (prior.state !== 'claimed' || await now(client) < prior.leaseUntil!)) return { value: prior, dispatchAllowed: false };
        const reservationId = prior?.reservationId ?? randomUUID();
        await reserve(client, op, request.batchId, reservationId, Boolean(prior));
        const time = await now(client), initial = prior ?? newIntentStep(binding(op, request), time);
        const record = planIntentStepTransition(initial, initial.binding, { type: 'claim', owner: request.owner, reservationId, leaseMs: request.leaseMs }, time);
        if (prior) await replace(client, op.reviewId, request.batchId, prior, record);
        else await client.query(`INSERT INTO steer_execution.scope_review_batches (organization_id,review_id,subject,product_id,batch_id,record,budget_id,reservation_id)
          VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`, [config.organizationId,op.reviewId,config.subject,config.productId,request.batchId,json(record),config.budget.budgetId,reservationId]);
        return { value: record, dispatchAllowed: false };
      });
    },
    transition(raw: unknown) {
      const request = freeze(transitionSchema.parse(raw));
      return transaction(request, async client => {
        const op = await run(client, request), prior = await readBatch(client, op, request), event = request.event;
        if (!prior || prior.owner !== event.owner || prior.fencingToken !== event.fencingToken) throw new Conflict();
        if (event.type === 'commit-dispatch') {
          if (prior.state !== 'claimed') return { value: prior, dispatchAllowed: false };
          await reserve(client, op, request.batchId, prior.reservationId, true);
        }
        let record: IntentStepRecord;
        try { record = planIntentStepTransition(prior, prior.binding, event, await now(client)); } catch { throw new Conflict(); }
        await replace(client, op.reviewId, request.batchId, prior, record);
        return { value: record, dispatchAllowed: event.type === 'commit-dispatch' };
      });
    },
    close() { closed = true; },
  };
  async function replace(client: PoolClient, reviewId: string, batchId: string, prior: IntentStepRecord, record: IntentStepRecord) {
    const result = await client.query('UPDATE steer_execution.scope_review_batches SET record=$1::jsonb WHERE organization_id=$2 AND review_id=$3 AND batch_id=$4 AND record=$5::jsonb', [json(record),config.organizationId,reviewId,batchId,json(prior)]);
    if (result.rowCount !== 1) throw new Conflict();
  }
}
