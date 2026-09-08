import type { PoolClient } from 'pg';
import { z } from 'zod';
import { intentScopeAssessmentSchema,validateIntentScopeAssessment } from '@steer/tool-registry/intent-evidence-contracts';
import { prepareIntentScopeReview } from '@steer/tool-registry/intent-scope-review';
import { createScopeReviewOriginalStore, scopeRecordsConfigurationSchema } from './scope-review-originals.ts';
import { createScopeReviewOperationStore, describeScopeReviewCheckpoint } from './scope-review-operations.ts';
import { scopeOriginalHash as hash, freezeScopeOriginal as freeze, type ScopeOriginal } from './scope-original-contracts.ts';
import { draftEnvelopeSchema, sealDraft, openDraft, DraftStorageError } from './draft-envelope.ts';
import { applyRuntimeQueryLimits, DatabaseCommitOutcomeUnknownError } from './runtime-pool.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const body = z.string().min(1).max(350000).refine(v => !/[\uD800-\uDFFF]/u.test(v));
const count = z.number().int().nonnegative().safe().nullable();
const targetSchema = z.strictObject({ reviewId: uuid, preparationDigest: digest, batchId: digest });
const stageSchema = z.enum(['request', 'response']);
const scopeResultSchema = z.strictObject({role:z.literal('scope-reviewer'),planDigest:digest,batchId:digest,output:intentScopeAssessmentSchema});
export const scopeReviewObservationSchema = z.discriminatedUnion('stage', [
  z.strictObject({ stage: z.literal('request'), adapterRevision: z.literal('steer-mastra-observed/v1'), protocol: z.literal('openai-compatible-chat/nonstream/v1'), rendered: z.unknown(), requestBody: body }),
  z.strictObject({ stage: z.literal('response'), requestDigest: digest, providerRequestId: id.nullable(), responseBody: body,
    usage: z.strictObject({ inputTokens: count, outputTokens: count, totalTokens: count }), result: scopeResultSchema }),
]);
const metadataSchema = z.strictObject({ organizationId: id, subject: id, productId: id, reviewId: uuid, preparationDigest: digest,
  batchId: targetSchema.shape.batchId, stage: stageSchema, draftId: uuid, draftRevision: z.number().int().min(1).max(1000),
  configurationDigest: digest, owner: id, fencingToken: z.number().int().positive().safe(), reservationId: uuid,
  stepInputDigest: digest, payloadDigest: digest, requestDigest: digest.nullable(), outputDigest: digest.nullable() });
type Target = z.infer<typeof targetSchema>;
type Metadata = z.infer<typeof metadataSchema>;
type Stored = { metadata: Metadata; envelope: z.infer<typeof draftEnvelopeSchema> };
type Payload = z.infer<typeof scopeReviewObservationSchema>;
const aad = (m: Metadata) => JSON.stringify(['steer-scope-observation/v1', m]);
const clearScope = "SELECT set_config('steer.draft_organization','',false),set_config('steer.draft_subject','',false),set_config('steer.draft_product','',false)";
class Conflict extends Error {}

/** Disabled trusted-adapter journal. Request and response are separately immutable,
 * encrypted and bound to the actual sent step. Recorded bytes are not provider
 * authorship. Mandatory verifier callbacks must use the pinned recorded SDK codec
 * to validate the exact wire request before ACK and request/response/usage on read.
 * Quarantined/failed batches can be read without granting reconciliation or retry;
 * new observations require a dispatch-committed batch. Succeeded response reads
 * must match the checkpoint's exact payload digest; expired access stays closed.
 * No headers, credentials, URLs, model dispatch, budget mutation or deletion API.
 */
export function createScopeReviewObservationStore(pools: Parameters<typeof createScopeReviewOriginalStore>[0], rawConfiguration: unknown, dependencies: {
  originals: Parameters<typeof createScopeReviewOriginalStore>[2];
  verifyObservation: (context: Readonly<{original:ScopeOriginal;batchId:string;
    request:Extract<Payload,{stage:'request'}>;response:Extract<Payload,{stage:'response'}>|null}>) => Promise<void>;
  authorize: (context: Readonly<{ configuration: z.infer<typeof scopeRecordsConfigurationSchema>; target: Target; action: 'put' | 'read' }>) => Promise<void>;
}) {
  const config = freeze(scopeRecordsConfigurationSchema.parse(rawConfiguration)), configurationDigest = hash(config);
  if (typeof dependencies.authorize !== 'function' || typeof dependencies.verifyObservation !== 'function') throw new DraftStorageError();
  const originals = createScopeReviewOriginalStore(pools, config, dependencies.originals);
  const children = new Set<{ close(): void }>();
  let closed = false, active = false, pending = 0;
  const guard = () => { if (closed) throw new DraftStorageError(); };
  const bounded = async <T>(work: Promise<T>): Promise<T> => {
    pending++; void work.finally(() => { pending--; }).catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DraftStorageError()), 5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  const authorize = async (target: Target, action: 'put' | 'read') => {
    guard(); if (await bounded(dependencies.authorize(freeze({ configuration: config, target, action }))) !== undefined) throw new DraftStorageError(); guard();
  };
  async function transaction<T>(work: (c: PoolClient) => Promise<T>): Promise<T> {
    let c: PoolClient | undefined, finished = false, committing = false, broken = false;
    try {
      guard(); c = await bounded(pools.drafts.connect().then(c => { if (closed || finished) { c.release(true); throw new DraftStorageError(); } return c; }));
      if (!c) throw new DraftStorageError();
      await applyRuntimeQueryLimits(c); await c.query(clearScope); await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const r = (await c.query(`SELECT r.rolname,session_user AS login_role,r.rolsuper,r.rolbypassrls,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer_drafts' AND c.relowner=r.oid) AS owns_objects
        FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
      if (!r || r.rolname !== 'steer_draft_runtime' || r.login_role !== 'steer_draft_runtime' || r.rolsuper || r.rolbypassrls || r.owns_objects) throw new DraftStorageError();
      await c.query("SELECT set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)", [config.organizationId, config.subject, config.productId]);
      const value = await work(c); guard(); committing = true; await c.query('COMMIT'); await c.query(clearScope); guard(); return value;
    } catch (error) {
      broken = committing; if (c) try { await c.query('ROLLBACK'); await c.query(clearScope); } catch { broken = true; }
      if (committing) throw new DatabaseCommitOutcomeUnknownError(); throw error;
    } finally { finished = true; c?.release(broken); }
  }
  async function lifecycle(c: PoolClient, m: Metadata) {
    const start = performance.now(), row = (await c.query(`SELECT *,floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms
      FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND draft_id=$2 FOR UPDATE`, [config.organizationId, m.draftId])).rows[0];
    if (!row || row.subject !== config.subject || row.product_id !== config.productId || row.configuration_digest !== configurationDigest || row.held
      || row.created_at.getTime() > Number(row.clock_ms) || row.use_until.getTime() <= Number(row.clock_ms)) throw new DraftStorageError();
    return start + row.use_until.getTime() - Number(row.clock_ms);
  }
  async function select(c: PoolClient, t: Target, stage: Payload['stage']): Promise<Stored | null> {
    const row = (await c.query('SELECT * FROM steer_drafts.scope_review_observations WHERE organization_id=$1 AND review_id=$2 AND batch_id=$3 AND stage=$4',
      [config.organizationId, t.reviewId, t.batchId, stage])).rows[0];
    if (!row) return null;
    const m = metadataSchema.parse(row.record);
    if (m.organizationId !== config.organizationId || m.subject !== config.subject || m.productId !== config.productId || m.configurationDigest !== configurationDigest
      || m.reviewId !== t.reviewId || m.preparationDigest !== t.preparationDigest || m.batchId !== t.batchId || m.stage !== stage
      || m.reviewId !== row.review_id || m.batchId !== row.batch_id || m.stage !== row.stage || m.draftId !== row.draft_id
      || m.draftRevision !== Number(row.draft_revision) || m.payloadDigest !== row.payload_digest) throw new Conflict();
    return { metadata: m, envelope: draftEnvelopeSchema.parse(row.encrypted_value) };
  }
  async function context(t: Target, action:'put'|'read'='read') {
    guard(); const restored = await bounded(originals.read({ reviewId: t.reviewId, preparationDigest: t.preparationDigest })); guard();
    if (restored.reviewExpired) throw new DraftStorageError();
    const original = restored.original;
    const operations = createScopeReviewOperationStore(pools.execution, original.configuration, { authorize: dependencies.originals.authorizeReview });
    children.add(operations);
    try {
      const observed = await bounded(operations.inspect({ reviewId: t.reviewId, preparationDigest: t.preparationDigest })); guard();
      if (observed.outcome !== 'ok') throw new DraftStorageError();
      const own = observed.value.batches.find(s => s.binding.stepId === t.batchId);
      const allowed=action==='put'?['dispatch-committed']:['dispatch-committed','outcome-unknown','failed-known','succeeded'];
      if (!own || !allowed.includes(own.state) || hash(restored.manifest)!==hash(observed.value.manifest)) throw new DraftStorageError();
      const prepared=await prepareIntentScopeReview(original.source.scope,original.evidence,original.profile),batch=prepared.batches.find(b=>b.metadata.batchId===t.batchId);guard();
      if(!batch || prepared.preparationDigest!==t.preparationDigest || batch.inputDigest!==own.binding.inputDigest)throw new Conflict();
      return { original,prepared,batch,record:own };
    } finally { operations.close(); children.delete(operations); }
  }
  function metadata(t: Target, payload: Payload, current: Awaited<ReturnType<typeof context>>) {
    return metadataSchema.parse({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, ...t,
      stage: payload.stage, draftId: current.original.source.scope.draftId, draftRevision: current.original.source.revision, configurationDigest,
      owner: current.record.owner, fencingToken: current.record.fencingToken, reservationId: current.record.reservationId,
      stepInputDigest: current.batch.inputDigest, payloadDigest: hash(payload),
      requestDigest: payload.stage === 'response' ? payload.requestDigest : null, outputDigest: payload.stage === 'response' ? hash(payload.result) : null });
  }
  async function validate(t: Target, payload: Payload, current: Awaited<ReturnType<typeof context>>) {
    if (Buffer.byteLength(JSON.stringify(payload)) > 786432) throw new DraftStorageError();
    let request:Extract<Payload,{stage:'request'}>;
    if (payload.stage === 'request') {
      if (hash(payload.rendered) !== hash(current.batch.packet)) throw new Conflict();
      request=payload;
    } else {
      if (payload.result.batchId !== t.batchId || payload.result.planDigest!==current.prepared.plan.planDigest) throw new Conflict();
      validateIntentScopeAssessment(current.batch.envelope,payload.result.output,current.original.profile.profileRevision);
      const prior = await transaction(c => select(c, t, 'request'));
      if (!prior || prior.metadata.payloadDigest !== payload.requestDigest) throw new Conflict();
      const restored=await restore(t, prior, 'read');
      if(restored.payload.stage!=='request')throw new Conflict();request=restored.payload;
      const u = payload.usage;
      if (u.inputTokens !== null && u.outputTokens !== null && u.totalTokens !== null && u.inputTokens + u.outputTokens !== u.totalTokens) throw new Conflict();
    }
    guard();if(await bounded(dependencies.verifyObservation(freeze({original:current.original,batchId:t.batchId,request,
      response:payload.stage==='response'?payload:null})))!==undefined)throw new DraftStorageError();guard();
  }
  async function restore(t: Target, row: Stored, action: 'put' | 'read') {
    await authorize(t, action); await transaction(c => lifecycle(c, row.metadata));
    const key = await bounded(dependencies.originals.keyForDraft(freeze({ ...config, draftId: row.metadata.draftId }), row.envelope.keyId));
    if (!(key.bytes instanceof Uint8Array) || key.bytes.byteLength !== 32) throw new DraftStorageError();
    const lease = { keyId: key.keyId, bytes: Buffer.from(key.bytes) };
    try {
      const payload = freeze(scopeReviewObservationSchema.parse(openDraft(row.envelope, aad(row.metadata), lease)));
      const current = await context(t,action); if (hash(metadata(t, payload, current)) !== hash(row.metadata)) throw new Conflict();
      if(payload.stage==='response'&&current.record.state==='succeeded'&&current.record.resultDigest!==row.metadata.payloadDigest)throw new Conflict();
      await validate(t, payload, current);
      const fresh = await bounded(dependencies.originals.keyForDraft(freeze({ ...config, draftId: row.metadata.draftId }), row.envelope.keyId));
      if (!(fresh.bytes instanceof Uint8Array) || fresh.bytes.byteLength !== 32) throw new DraftStorageError();
      const bytes = Buffer.from(fresh.bytes);
      try { if (fresh.keyId !== lease.keyId || !bytes.equals(lease.bytes)) throw new DraftStorageError(); } finally { bytes.fill(0); }
      await authorize(t, action); const finalContext = await context(t,action);
      if (hash(metadata(t, payload, finalContext)) !== hash(row.metadata)) throw new Conflict();
      if(payload.stage==='response'&&finalContext.record.state==='succeeded'&&finalContext.record.resultDigest!==row.metadata.payloadDigest)throw new Conflict();
      const final = await transaction(async c => ({ expiry: await lifecycle(c, row.metadata), row: await select(c, t, payload.stage) }));
      guard(); if (performance.now() >= final.expiry || hash(final.row) !== hash(row)) throw new DraftStorageError();
      const checkpoint=payload.stage==='response'&&['dispatch-committed','succeeded'].includes(finalContext.record.state)
        ?describeScopeReviewCheckpoint(finalContext.original.configuration,t.preparationDigest,finalContext.record,row.metadata.payloadDigest):null;
      return {payload,state:finalContext.record.state,checkpoint};
    } finally { lease.bytes.fill(0); }
  }
  return {
    async put(raw: unknown) {
      if (closed || active || pending) return { outcome: 'unavailable' as const }; active = true; let persisted = false, created = false;
      try {
        const input = freeze(targetSchema.extend({ owner: id, fencingToken: z.number().int().positive().safe(), observation: scopeReviewObservationSchema }).parse(raw));
        const t = freeze(targetSchema.parse({ reviewId: input.reviewId, preparationDigest: input.preparationDigest, batchId: input.batchId }));
        await authorize(t, 'put'); const current = await context(t,'put'), m = metadata(t, input.observation, current);
        if (m.owner !== input.owner || m.fencingToken !== input.fencingToken) throw new Conflict();
        await validate(t, input.observation, current);
        const prior = await transaction(async c => { await lifecycle(c, m); return select(c, t, m.stage); });
        if (prior && hash(prior.metadata) !== hash(m)) throw new Conflict();
        let row = prior;
        if (!row) {
          const envelope = sealDraft(input.observation, aad(m), await bounded(dependencies.originals.keyForDraft(freeze({ ...config, draftId: m.draftId }), null)));
          await authorize(t, 'put'); if (hash(metadata(t, input.observation, await context(t,'put'))) !== hash(m)) throw new Conflict();
          row = await transaction(async c => {
            const expiry = await lifecycle(c, m), existing = await select(c, t, m.stage);
            if (existing) { if (hash(existing.metadata) !== hash(m)) throw new Conflict(); return existing; }
            await c.query(`INSERT INTO steer_drafts.scope_review_observations
              (organization_id,subject,product_id,review_id,batch_id,stage,draft_id,draft_revision,payload_digest,record,encrypted_value)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`, [m.organizationId,m.subject,m.productId,m.reviewId,m.batchId,m.stage,m.draftId,m.draftRevision,m.payloadDigest,JSON.stringify(m),JSON.stringify(envelope)]);
            guard(); if (performance.now() >= expiry) throw new DraftStorageError(); created = true; return { metadata: m, envelope };
          });
        }
        persisted = true; await restore(t, row, 'put');
        return freeze({ outcome: 'stored' as const, ...t, stage: m.stage, payloadDigest: m.payloadDigest, created });
      } catch (e) { return { outcome: persisted || e instanceof DatabaseCommitOutcomeUnknownError ? 'unknown' as const : e instanceof Conflict ? 'conflict' as const : 'unavailable' as const }; }
      finally { active = false; }
    },
    async read(raw: unknown) {
      if (closed || active || pending) throw new DraftStorageError(); active = true;
      try {
        const input = targetSchema.extend({ stage: stageSchema }).parse(raw);
        const t = freeze(targetSchema.parse({ reviewId: input.reviewId, preparationDigest: input.preparationDigest, batchId: input.batchId }));
        await authorize(t, 'read'); const row = await transaction(c => select(c, t, input.stage));
        if (!row) throw new DraftStorageError(); const restored = await restore(t, row, 'read');
        return freeze({ observation:restored.payload, payloadDigest: row.metadata.payloadDigest, stepInputDigest: row.metadata.stepInputDigest,
          outputDigest: row.metadata.outputDigest, recordsPolicyDigest: config.recordsPolicyDigest,
          checkpoint:restored.checkpoint,batchState:restored.state,requiresOutcomeResolution:['outcome-unknown','failed-known'].includes(restored.state),semanticQualityVerified:false as const,authoritativeClearance:false as const,
          executionAuthorized: false as const, retryAuthorized: false as const, gateSigned: false as const });
      } catch { throw new DraftStorageError(); } finally { active = false; }
    },
    close() { closed = true; originals.close(); for (const child of children) child.close(); },
  };
}
