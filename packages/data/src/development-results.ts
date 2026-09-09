import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { intentRoleResultSchema } from '@steer/tool-registry/intent-role-result';
import { createIntentOperationStore, createExpiredDevelopmentStepReader, createHistoricalDevelopmentStepReader, intentOperationConfigurationSchema, type IntentCheckpointReference } from './intent-operations.ts';
import { createDraftRevisionStore } from './draft-revisions.ts';
import { draftEnvelopeSchema, DraftStorageError, openDraft, sealDraft } from './draft-envelope.ts';
import { applyRuntimeQueryLimits, DatabaseCommitOutcomeUnknownError, type DatabasePool } from './runtime-pool.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase()), digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const role = z.enum(['architect', 'test-agent']), integer = z.number().int().positive().safe();
const targetSchema = z.strictObject({ operationId: uuid, stepId: role, inputDigest: digest });
const putSchema = targetSchema.extend({ owner: id, fencingToken: integer, result: intentRoleResultSchema });
const metadataSchema = z.strictObject({ organizationId: id, subject: id, productId: id, operationId: uuid, stepId: role,
  inputDigest: digest, stepInputDigest: digest, draftId: uuid, draftRevision: integer.max(1000), draftRevisionDigest: digest,
  scopeInputDigest: digest, configurationDigest: digest, draftConfigurationDigest: digest, owner: id, fencingToken: integer,
  reservationId: uuid, predecessorResultDigest: digest.nullable(), outputDigest: digest, resultRef: uuid });
const bindingSchema = z.strictObject({ organizationId: id, operationId: uuid, stepId: role, subject: id, draftId: uuid,
  draftRevision: integer, inputDigest: digest, configurationRevision: id });
const checkpointSchema = z.strictObject({ binding: bindingSchema, resultRef: uuid, resultDigest: digest, recordsPolicyDigest: digest });
type Metadata = z.infer<typeof metadataSchema>;
type Target = z.infer<typeof targetSchema>;
type Stored = { metadata: Metadata; resultDigest: string; envelope: z.infer<typeof draftEnvelopeSchema> };
type DraftDependencies = Parameters<typeof createDraftRevisionStore>[2];
type ResultAuthorityContext = Readonly<{ configuration: z.infer<typeof intentOperationConfigurationSchema>;
  target: { operationId: string; stepId: 'architect' | 'test-agent' }; action: 'put' | 'read' }>;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const resultHash = (v: Metadata) => hash(['steer-development-result/v1', v]);
const aad = (v: Metadata) => JSON.stringify(['steer-development-result-content/v1', v]);
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
class Conflict extends Error {}
const clearScope = "SELECT set_config('steer.draft_organization','',false),set_config('steer.draft_subject','',false),set_config('steer.draft_product','',false)";

/** Disabled trusted-worker result capture. It proves immutable bytes are bound to
 * an actual dispatch-committed SQL step, NOT that a model authored them, the
 * provider received a call, or a gate passed. Only a trusted worker may call put.
 * No claim, dispatch, model call, editor mutation, bootstrap or deletion API.
 */
export function createDevelopmentResultStore(pools: { execution: DatabasePool; drafts: DatabasePool }, rawConfiguration: unknown, dependencies: {
  authorizeOperation: Parameters<typeof createIntentOperationStore>[2]['authorize'];
  authorizeDraft: DraftDependencies['authorize']; keyForDraft: DraftDependencies['keyForDraft'];
  authorizeResult: (context: ResultAuthorityContext) => Promise<void>;
  /** Current historical-read/policy authority, never the old execution grant.
   * Optional and disabled by default. Only explicit historical reads use it. */
  authorizeHistoricalResult?: (context: ResultAuthorityContext) => Promise<void>;
}) {
  const config = freeze(intentOperationConfigurationSchema.parse(rawConfiguration)), configurationDigest = hash(config);
  if (config.action !== 'develop') throw new DraftStorageError();
  for (const name of ['authorizeOperation','authorizeDraft','authorizeResult','keyForDraft'] as const)
    if (typeof dependencies[name] !== 'function') throw new DraftStorageError();
  if (dependencies.authorizeHistoricalResult !== undefined && typeof dependencies.authorizeHistoricalResult !== 'function') throw new DraftStorageError();
  const draftConfig = freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId,
    repository: config.repository, branch: config.branch, configurationRevision: config.configurationRevision, recordsPolicyDigest: config.recordsPolicyDigest });
  const draftConfigurationDigest = hash(draftConfig);
  const operations = createIntentOperationStore(pools.execution, config, { authorize: dependencies.authorizeOperation,
    verifyCheckpoint: async () => { throw new DraftStorageError(); } }); // This instance only inspects.
  const drafts = createDraftRevisionStore(pools.drafts, draftConfig, { authorize: dependencies.authorizeDraft, keyForDraft: dependencies.keyForDraft });
  let closed = false, active = false, pending = 0;
  const bounded = async <T>(work: Promise<T>) => {
    pending++; void work.finally(() => { pending--; }).catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DraftStorageError()), 5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  const authorize = async (target: Pick<Target, 'operationId' | 'stepId'>, action: 'put' | 'read', historical = false) => {
    const check = historical ? dependencies.authorizeHistoricalResult : dependencies.authorizeResult;
    if (closed || !check || (historical && action !== 'read') || await bounded(check(freeze({ configuration: config,
      target: { operationId: target.operationId, stepId: target.stepId }, action }))) !== undefined || closed) throw new DraftStorageError();
  };
  const history = dependencies.authorizeHistoricalResult ? createExpiredDevelopmentStepReader(pools.execution, config, {
    authorize: async context => authorize(context.request, 'read', true),
  }) : null;
  const retainedHistory = dependencies.authorizeHistoricalResult ? createHistoricalDevelopmentStepReader(pools.execution, config, {
    authorize: async context => authorize(context.request, 'read', true),
  }) : null;
  const key = (draftId: string, keyId: string | null) => bounded(dependencies.keyForDraft(freeze({ ...draftConfig, draftId }), keyId));
  async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    let client: PoolClient | undefined, finished = false, committing = false, broken = false;
    try {
      if (closed) throw new DraftStorageError();
      client = await bounded(pools.drafts.connect().then(c => { if (finished || closed) { c.release(true); throw new DraftStorageError(); } return c; }));
      if (!client) throw new DraftStorageError();
      await applyRuntimeQueryLimits(client); await client.query(clearScope); await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const r = (await client.query(`SELECT r.rolname, session_user AS login_role, r.rolsuper, r.rolbypassrls,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer_drafts' AND c.relowner=r.oid) AS owns_objects
        FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
      if (!r || r.rolname !== 'steer_draft_runtime' || r.login_role !== 'steer_draft_runtime' || r.rolsuper || r.rolbypassrls || r.owns_objects) throw new DraftStorageError();
      await client.query("SELECT set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)",
        [config.organizationId, config.subject, config.productId]);
      const value = await work(client); if (closed) throw new DraftStorageError();
      committing = true; await client.query('COMMIT'); await client.query(clearScope);
      if (closed) throw new DraftStorageError(); return value;
    } catch (error) {
      broken = committing; if (client) try { await client.query('ROLLBACK'); await client.query(clearScope); } catch { broken = true; }
      if (committing) throw new DatabaseCommitOutcomeUnknownError(); throw error;
    } finally { finished = true; client?.release(broken); }
  }
  async function currentSource(client: PoolClient, m: Metadata) {
    const start = performance.now();
    const h = (await client.query(`SELECT *, floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms
      FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND draft_id=$2 FOR UPDATE`, [config.organizationId, m.draftId])).rows[0];
    if (!h || h.held || h.subject !== config.subject || h.product_id !== config.productId || h.configuration_digest !== draftConfigurationDigest
      || h.created_at.getTime() > Number(h.clock_ms) || h.use_until.getTime() <= Number(h.clock_ms)) throw new DraftStorageError();
    const source = (await client.query('SELECT revision_digest FROM steer_drafts.draft_revisions WHERE organization_id=$1 AND draft_id=$2 AND revision=$3',
      [config.organizationId, m.draftId, m.draftRevision])).rows[0];
    if (!source || source.revision_digest !== m.draftRevisionDigest) throw new Conflict();
    return start + h.use_until.getTime() - Number(h.clock_ms);
  }
  async function select(client: PoolClient, t: Pick<Target, 'operationId' | 'stepId'>): Promise<Stored | null> {
    const row = (await client.query('SELECT * FROM steer_drafts.development_results WHERE organization_id=$1 AND operation_id=$2 AND step_id=$3',
      [config.organizationId, t.operationId, t.stepId])).rows[0];
    if (!row) return null;
    const m = metadataSchema.parse(row.record), resultDigest = digest.parse(row.result_digest);
    if (m.organizationId !== config.organizationId || m.subject !== config.subject || m.productId !== config.productId
      || m.operationId !== row.operation_id || m.stepId !== row.step_id || m.resultRef !== row.result_ref
      || m.draftId !== row.draft_id || m.draftRevision !== Number(row.draft_revision)
      || m.configurationDigest !== configurationDigest || m.draftConfigurationDigest !== draftConfigurationDigest
      || resultHash(m) !== resultDigest) throw new Conflict();
    return { metadata: m, resultDigest, envelope: draftEnvelopeSchema.parse(row.encrypted_value) };
  }
  async function execution(t: Target, historical: boolean | 'retained' = false) {
    if (historical) {
      if (!history) throw new DraftStorageError();
      const ref = { operationId:t.operationId,inputDigest:t.inputDigest,stepId:t.stepId };
      const observed = historical === 'retained' ? await retainedHistory!.inspectHistorical(ref) : await history.inspectExpired(ref);
      if (closed || !['dispatch-committed','succeeded'].includes(observed.step.record.state)) throw new DraftStorageError();
      return { op: observed.operation, step: observed.step };
    }
    const observed = await operations.inspect({ operationId: t.operationId, inputDigest: t.inputDigest });
    if (closed || observed.outcome !== 'ok') throw new DraftStorageError();
    const step = observed.value.steps.find(s => s.record.binding.stepId === t.stepId);
    if (!step || !['dispatch-committed','succeeded'].includes(step.record.state)) throw new DraftStorageError();
    return { op: observed.value.operation, step };
  }
  function checkpoint(row: Stored): IntentCheckpointReference {
    const m = row.metadata;
    return freeze({ binding: { organizationId: m.organizationId, operationId: m.operationId, stepId: m.stepId, subject: m.subject,
      draftId: m.draftId, draftRevision: m.draftRevision, inputDigest: m.stepInputDigest, configurationRevision: config.configurationRevision },
      resultRef: m.resultRef, resultDigest: row.resultDigest, recordsPolicyDigest: config.recordsPolicyDigest });
  }
  async function verifyExecution(row: Stored, historical: boolean | 'retained' = false) {
    const m = row.metadata, { op, step } = await execution(m, historical), r = step.record;
    if (op.draftId !== m.draftId || op.draftRevision !== m.draftRevision || r.binding.inputDigest !== m.stepInputDigest
      || r.owner !== m.owner || r.fencingToken !== m.fencingToken || r.reservationId !== m.reservationId
      || step.predecessorResultDigest !== m.predecessorResultDigest
      || (r.state === 'succeeded' && (r.resultDigest !== row.resultDigest || step.resultRef !== m.resultRef))) throw new Conflict();
  }
  async function restore(row: Stored, action: 'put' | 'read', historical: boolean | 'retained' = false) {
    const m = row.metadata; await authorize(m, action, Boolean(historical)); await verifyExecution(row, historical);
    await transaction(c => currentSource(c, m));
    const source = await drafts.read({ draftId: m.draftId, revision: m.draftRevision });
    if (source.reference.revisionDigest !== m.draftRevisionDigest || source.reference.scopeInputDigest !== m.scopeInputDigest) throw new Conflict();
    const original = await key(m.draftId, row.envelope.keyId);
    if (!(original.bytes instanceof Uint8Array) || original.bytes.byteLength !== 32) throw new DraftStorageError();
    const lease = { keyId: original.keyId, bytes: Buffer.from(original.bytes) };
    try {
      const result = intentRoleResultSchema.parse(openDraft(row.envelope, aad(m), lease));
      if (result.role !== m.stepId || hash(result) !== m.outputDigest) throw new Conflict();
      const currentKey = await key(m.draftId, row.envelope.keyId);
      if (!(currentKey.bytes instanceof Uint8Array) || currentKey.bytes.byteLength !== 32) throw new DraftStorageError();
      const current = Buffer.from(currentKey.bytes);
      try { if (currentKey.keyId !== lease.keyId || !current.equals(lease.bytes)) throw new DraftStorageError(); } finally { current.fill(0); }
      if (await bounded(dependencies.authorizeDraft(freeze({ configuration:draftConfig,draftId:m.draftId,action:'read' }))) !== undefined || closed)
        throw new DraftStorageError();
      await authorize(m, action, Boolean(historical)); await verifyExecution(row, historical);
      const final = await transaction(async c => ({ expiry: await currentSource(c, m), row: await select(c, m),
        latestRevision: Number((await c.query('SELECT max(revision) AS revision FROM steer_drafts.draft_revisions WHERE organization_id=$1 AND draft_id=$2',
          [config.organizationId, m.draftId])).rows[0]?.revision) }));
      if (closed || performance.now() >= final.expiry || JSON.stringify(row) !== JSON.stringify(final.row)) throw new DraftStorageError();
      return freeze({ result, checkpoint: checkpoint(row), sourceDraftRevision: m.draftRevision, sourceRevisionDigest: m.draftRevisionDigest,
        latestDraftRevision: final.latestRevision, gateSigned: false as const, executionAuthorized: false as const, retryAuthorized: false as const });
    } finally { lease.bytes.fill(0); }
  }
  return {
    async put(raw: unknown) {
      if (closed || active || pending) return { outcome: 'unavailable' as const }; active = true; let persisted = false;
      try {
        const input = freeze(putSchema.parse(raw)); if (input.stepId !== input.result.role) throw new Conflict();
        await authorize(input, 'put'); const { op, step } = await execution(input), r = step.record;
        if (r.owner !== input.owner || r.fencingToken !== input.fencingToken) throw new Conflict();
        const source = await drafts.read({ draftId: op.draftId, revision: op.draftRevision });
        const m = metadataSchema.parse({ organizationId: config.organizationId, subject: config.subject, productId: config.productId,
          operationId: input.operationId, stepId: input.stepId, inputDigest: input.inputDigest, stepInputDigest: r.binding.inputDigest,
          draftId: op.draftId, draftRevision: op.draftRevision, draftRevisionDigest: source.reference.revisionDigest,
          scopeInputDigest: source.reference.scopeInputDigest, configurationDigest, draftConfigurationDigest,
          owner: r.owner, fencingToken: r.fencingToken, reservationId: r.reservationId, predecessorResultDigest: step.predecessorResultDigest,
          outputDigest: hash(input.result), resultRef: randomUUID() });
        const prior = await transaction(async c => { await currentSource(c, m); return select(c, input); });
        const matches = (row: Stored) => { if (hash({ ...row.metadata, resultRef: m.resultRef }) !== hash(m)) throw new Conflict(); };
        let row = prior;
        if (row) matches(row);
        else {
          if (r.state !== 'dispatch-committed') throw new Conflict();
          const candidate = { metadata: m, resultDigest: resultHash(m), envelope: sealDraft(input.result, aad(m), await key(m.draftId, null)) };
          await authorize(input, 'put'); await verifyExecution(candidate);
          row = await transaction(async c => {
            const expiry = await currentSource(c, m), duplicate = await select(c, input);
            if (duplicate) { matches(duplicate); return duplicate; }
            await c.query(`INSERT INTO steer_drafts.development_results
              (organization_id,subject,product_id,operation_id,step_id,result_ref,draft_id,draft_revision,result_digest,record,encrypted_value)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`, [m.organizationId,m.subject,m.productId,m.operationId,m.stepId,m.resultRef,
              m.draftId,m.draftRevision,candidate.resultDigest,JSON.stringify(m),JSON.stringify(candidate.envelope)]);
            if (closed || performance.now() >= expiry) throw new DraftStorageError(); return candidate;
          });
        }
        persisted = true; const restored = await restore(row, 'put');
        return freeze({ outcome: 'stored' as const, checkpoint: restored.checkpoint });
      } catch (e) { return { outcome: persisted || e instanceof DatabaseCommitOutcomeUnknownError ? 'unknown' as const : e instanceof Conflict ? 'conflict' as const : 'unavailable' as const }; }
      finally { active = false; }
    },
    async read(raw: unknown) {
      if (closed || active || pending) throw new DraftStorageError(); active = true;
      try { const t = targetSchema.parse(raw); await authorize(t, 'read');
        const row = await transaction(c => select(c, t)); if (!row || row.metadata.inputDigest !== t.inputDigest) throw new Conflict();
        return await restore(row, 'read');
      } catch { throw new DraftStorageError(); } finally { active = false; }
    },
    async readHistorical(raw: unknown) {
      if (closed || active || pending || !history) throw new DraftStorageError(); active = true;
      try {
        const t = targetSchema.parse(raw); await authorize(t, 'read', true);
        const row = await transaction(c => select(c, t)); if (!row || row.metadata.inputDigest !== t.inputDigest) throw new Conflict();
        const { checkpoint: _notAContinuationReference, ...original } = await restore(row, 'read', true);
        return freeze({ ...original, historical: true as const });
      } catch { throw new DraftStorageError(); } finally { active = false; }
    },
    /** Distinct retained-result port, also usable before execution expiry. The
     * result reference is inert provenance, not a continuation checkpoint. */
    async readRetainedHistorical(raw: unknown) {
      if (closed || active || pending || !retainedHistory) throw new DraftStorageError(); active = true;
      try {
        const t = targetSchema.parse(raw); await authorize(t, 'read', true);
        const row = await transaction(c => select(c, t)); if (!row || row.metadata.inputDigest !== t.inputDigest) throw new Conflict();
        const { checkpoint: _notAContinuationReference, ...original } = await restore(row, 'read', 'retained');
        return freeze({ ...original, historical: true as const, reference: { resultRef: row.metadata.resultRef, resultDigest: row.resultDigest,
          stepInputDigest: row.metadata.stepInputDigest, predecessorResultDigest: row.metadata.predecessorResultDigest } });
      } catch { throw new DraftStorageError(); } finally { active = false; }
    },
    async verifyCheckpoint(raw: IntentCheckpointReference): Promise<void> {
      if (closed || active || pending) throw new DraftStorageError(); active = true;
      try {
        const ref = checkpointSchema.parse(raw);
        if (ref.binding.organizationId !== config.organizationId || ref.binding.subject !== config.subject
          || ref.binding.configurationRevision !== config.configurationRevision || ref.recordsPolicyDigest !== config.recordsPolicyDigest) throw new Conflict();
        await authorize(ref.binding, 'read'); const row = await transaction(c => select(c, ref.binding));
        if (!row || hash(checkpointSchema.parse(checkpoint(row))) !== hash(ref)) throw new Conflict();
        await restore(row, 'read');
      } catch { throw new DraftStorageError(); } finally { active = false; }
    },
    close() { closed = true; operations.close(); drafts.close(); history?.close(); retainedHistory?.close(); },
  };
}
