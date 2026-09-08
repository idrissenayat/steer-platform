import type { PoolClient } from 'pg';
import { z } from 'zod';
import { intentRoleResultSchema } from '@steer/tool-registry/intent-role-result';
import { createDevelopmentOriginalStore, developmentRecordsConfigurationSchema } from './development-originals.ts';
import { createDevelopmentResultStore } from './development-results.ts';
import { renderDevelopmentRequest } from './development-requests.ts';
import { createIntentOperationStore } from './intent-operations.ts';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';
import { draftEnvelopeSchema, sealDraft, openDraft, DraftStorageError } from './draft-envelope.ts';
import { applyRuntimeQueryLimits, DatabaseCommitOutcomeUnknownError } from './runtime-pool.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const body = z.string().min(1).max(350000).refine(v => !/[\uD800-\uDFFF]/u.test(v));
const count = z.number().int().nonnegative().safe().nullable();
const targetSchema = z.strictObject({ operationId: uuid, inputDigest: digest, stepId: z.enum(['architect', 'test-agent']) });
const stageSchema = z.enum(['request', 'response']);
export const developmentObservationSchema = z.discriminatedUnion('stage', [
  z.strictObject({ stage: z.literal('request'), adapterRevision: id, protocol: id, rendered: z.unknown(), requestBody: body }),
  z.strictObject({ stage: z.literal('response'), requestDigest: digest, providerRequestId: id.nullable(), responseBody: body,
    usage: z.strictObject({ inputTokens: count, outputTokens: count, totalTokens: count }), result: intentRoleResultSchema }),
]);
const metadataSchema = z.strictObject({ organizationId: id, subject: id, productId: id, operationId: uuid, inputDigest: digest,
  stepId: targetSchema.shape.stepId, stage: stageSchema, draftId: uuid, draftRevision: z.number().int().min(1).max(1000),
  configurationDigest: digest, owner: id, fencingToken: z.number().int().positive().safe(), reservationId: uuid,
  stepInputDigest: digest, payloadDigest: digest, requestDigest: digest.nullable(), outputDigest: digest.nullable() });
type Target = z.infer<typeof targetSchema>;
type Metadata = z.infer<typeof metadataSchema>;
type Stored = { metadata: Metadata; envelope: z.infer<typeof draftEnvelopeSchema> };
type Payload = z.infer<typeof developmentObservationSchema>;
const aad = (m: Metadata) => JSON.stringify(['steer-development-observation/v1', m]);
const clearScope = "SELECT set_config('steer.draft_organization','',false),set_config('steer.draft_subject','',false),set_config('steer.draft_product','',false)";
class Conflict extends Error {}

/** Disabled trusted-adapter journal. Request and response are separately immutable,
 * encrypted and bound to the actual sent step. Recorded bytes are not provider
 * authorship or proof the protocol body matches the rendered packet: the trusted
 * transport/parser binding must establish that correspondence before activation.
 * No headers, credentials, URLs, model dispatch, budget mutation or deletion API.
 */
export function createDevelopmentObservationStore(pools: Parameters<typeof createDevelopmentOriginalStore>[0], rawConfiguration: unknown, dependencies: {
  originals: Parameters<typeof createDevelopmentOriginalStore>[2];
  results: Parameters<typeof createDevelopmentResultStore>[2];
  authorize: (context: Readonly<{ configuration: z.infer<typeof developmentRecordsConfigurationSchema>; target: Target; action: 'put' | 'read' }>) => Promise<void>;
}) {
  const config = freeze(developmentRecordsConfigurationSchema.parse(rawConfiguration)), configurationDigest = hash(config);
  if (typeof dependencies.authorize !== 'function') throw new DraftStorageError();
  const originals = createDevelopmentOriginalStore(pools, config, dependencies.originals);
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
    const row = (await c.query('SELECT * FROM steer_drafts.development_observations WHERE organization_id=$1 AND operation_id=$2 AND step_id=$3 AND stage=$4',
      [config.organizationId, t.operationId, t.stepId, stage])).rows[0];
    if (!row) return null;
    const m = metadataSchema.parse(row.record);
    if (m.organizationId !== config.organizationId || m.subject !== config.subject || m.productId !== config.productId || m.configurationDigest !== configurationDigest
      || m.operationId !== t.operationId || m.inputDigest !== t.inputDigest || m.stepId !== t.stepId || m.stage !== stage
      || m.operationId !== row.operation_id || m.stepId !== row.step_id || m.stage !== row.stage || m.draftId !== row.draft_id
      || m.draftRevision !== Number(row.draft_revision) || m.payloadDigest !== row.payload_digest) throw new Conflict();
    return { metadata: m, envelope: draftEnvelopeSchema.parse(row.encrypted_value) };
  }
  async function context(t: Target) {
    guard(); const restored = await bounded(originals.read({ operationId: t.operationId, inputDigest: t.inputDigest })); guard();
    if (restored.operationExpired) throw new DraftStorageError();
    const original = restored.original;
    const operations = createIntentOperationStore(pools.execution, original.configuration, { authorize: dependencies.originals.authorizeOperation, verifyCheckpoint: async () => { throw new DraftStorageError(); } });
    const results = createDevelopmentResultStore(pools, original.configuration, dependencies.results); children.add(operations); children.add(results);
    try {
      const observed = await bounded(operations.inspect({ operationId: t.operationId, inputDigest: t.inputDigest })); guard();
      if (observed.outcome !== 'ok') throw new DraftStorageError();
      const own = observed.value.steps.find(s => s.record.binding.stepId === t.stepId);
      if (!own || !['dispatch-committed', 'succeeded'].includes(own.record.state)) throw new DraftStorageError();
      let completedOutputDigest: string | null = null;
      if (own.record.state === 'succeeded') {
        const saved = await bounded(results.read({ operationId: t.operationId, inputDigest: t.inputDigest, stepId: t.stepId }));
        if (saved.checkpoint.resultRef !== own.resultRef || saved.checkpoint.resultDigest !== own.record.resultDigest) throw new Conflict();
        completedOutputDigest = hash(saved.result);
      }
      let predecessor = null;
      if (t.stepId === 'test-agent') {
        const prior = observed.value.steps.find(s => s.record.binding.stepId === 'architect');
        if (prior?.record.state !== 'succeeded') throw new DraftStorageError();
        const saved = await bounded(results.read({ operationId: t.operationId, inputDigest: t.inputDigest, stepId: 'architect' }));
        if (saved.checkpoint.resultRef !== prior.resultRef || saved.checkpoint.resultDigest !== prior.record.resultDigest) throw new Conflict();
        predecessor = { checkpoint: saved.checkpoint, result: saved.result };
      }
      const prepared = await renderDevelopmentRequest({ original, operationId: t.operationId, role: t.stepId, predecessor }); guard();
      if (own.record.binding.inputDigest !== prepared.stepReference.stepInputDigest || own.predecessorResultDigest !== prepared.stepReference.predecessorResultDigest) throw new Conflict();
      return { original, prepared, record: own.record, completedOutputDigest };
    } finally { for (const child of [operations, results]) { child.close(); children.delete(child); } }
  }
  function metadata(t: Target, payload: Payload, current: Awaited<ReturnType<typeof context>>) {
    return metadataSchema.parse({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, ...t,
      stage: payload.stage, draftId: current.original.source.draftId, draftRevision: current.original.source.revision, configurationDigest,
      owner: current.record.owner, fencingToken: current.record.fencingToken, reservationId: current.record.reservationId,
      stepInputDigest: current.prepared.stepReference.stepInputDigest, payloadDigest: hash(payload),
      requestDigest: payload.stage === 'response' ? payload.requestDigest : null, outputDigest: payload.stage === 'response' ? hash(payload.result) : null });
  }
  async function validate(t: Target, payload: Payload, current: Awaited<ReturnType<typeof context>>) {
    if (Buffer.byteLength(JSON.stringify(payload)) > 786432) throw new DraftStorageError();
    if (payload.stage === 'request') {
      if (hash(payload.rendered) !== hash(current.prepared.rendered)) throw new Conflict();
    } else {
      if (payload.result.role !== t.stepId) throw new Conflict();
      if (current.completedOutputDigest !== null && current.completedOutputDigest !== hash(payload.result)) throw new Conflict();
      const prior = await transaction(c => select(c, t, 'request'));
      if (!prior || prior.metadata.payloadDigest !== payload.requestDigest) throw new Conflict();
      await restore(t, prior, 'read');
      const u = payload.usage;
      if (u.inputTokens !== null && u.outputTokens !== null && u.totalTokens !== null && u.inputTokens + u.outputTokens !== u.totalTokens) throw new Conflict();
    }
  }
  async function restore(t: Target, row: Stored, action: 'put' | 'read'): Promise<Payload> {
    await authorize(t, action); await transaction(c => lifecycle(c, row.metadata));
    const key = await bounded(dependencies.originals.keyForDraft(freeze({ ...config, draftId: row.metadata.draftId }), row.envelope.keyId));
    if (!(key.bytes instanceof Uint8Array) || key.bytes.byteLength !== 32) throw new DraftStorageError();
    const lease = { keyId: key.keyId, bytes: Buffer.from(key.bytes) };
    try {
      const payload = freeze(developmentObservationSchema.parse(openDraft(row.envelope, aad(row.metadata), lease)));
      const current = await context(t); if (hash(metadata(t, payload, current)) !== hash(row.metadata)) throw new Conflict();
      await validate(t, payload, current);
      const fresh = await bounded(dependencies.originals.keyForDraft(freeze({ ...config, draftId: row.metadata.draftId }), row.envelope.keyId));
      if (!(fresh.bytes instanceof Uint8Array) || fresh.bytes.byteLength !== 32) throw new DraftStorageError();
      const bytes = Buffer.from(fresh.bytes);
      try { if (fresh.keyId !== lease.keyId || !bytes.equals(lease.bytes)) throw new DraftStorageError(); } finally { bytes.fill(0); }
      await authorize(t, action); const finalContext = await context(t);
      if (hash(metadata(t, payload, finalContext)) !== hash(row.metadata)) throw new Conflict();
      if (payload.stage === 'response' && finalContext.completedOutputDigest !== null && finalContext.completedOutputDigest !== hash(payload.result)) throw new Conflict();
      const final = await transaction(async c => ({ expiry: await lifecycle(c, row.metadata), row: await select(c, t, payload.stage) }));
      guard(); if (performance.now() >= final.expiry || hash(final.row) !== hash(row)) throw new DraftStorageError(); return payload;
    } finally { lease.bytes.fill(0); }
  }
  return {
    async put(raw: unknown) {
      if (closed || active || pending) return { outcome: 'unavailable' as const }; active = true; let persisted = false, created = false;
      try {
        const input = freeze(targetSchema.extend({ owner: id, fencingToken: z.number().int().positive().safe(), observation: developmentObservationSchema }).parse(raw));
        const t = freeze(targetSchema.parse({ operationId: input.operationId, inputDigest: input.inputDigest, stepId: input.stepId }));
        await authorize(t, 'put'); const current = await context(t), m = metadata(t, input.observation, current);
        if (m.owner !== input.owner || m.fencingToken !== input.fencingToken) throw new Conflict();
        await validate(t, input.observation, current);
        const prior = await transaction(async c => { await lifecycle(c, m); return select(c, t, m.stage); });
        if (prior && hash(prior.metadata) !== hash(m)) throw new Conflict();
        let row = prior;
        if (!row) {
          const envelope = sealDraft(input.observation, aad(m), await bounded(dependencies.originals.keyForDraft(freeze({ ...config, draftId: m.draftId }), null)));
          await authorize(t, 'put'); if (hash(metadata(t, input.observation, await context(t))) !== hash(m)) throw new Conflict();
          row = await transaction(async c => {
            const expiry = await lifecycle(c, m), existing = await select(c, t, m.stage);
            if (existing) { if (hash(existing.metadata) !== hash(m)) throw new Conflict(); return existing; }
            await c.query(`INSERT INTO steer_drafts.development_observations
              (organization_id,subject,product_id,operation_id,step_id,stage,draft_id,draft_revision,payload_digest,record,encrypted_value)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`, [m.organizationId,m.subject,m.productId,m.operationId,m.stepId,m.stage,m.draftId,m.draftRevision,m.payloadDigest,JSON.stringify(m),JSON.stringify(envelope)]);
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
        const t = freeze(targetSchema.parse({ operationId: input.operationId, inputDigest: input.inputDigest, stepId: input.stepId }));
        await authorize(t, 'read'); const row = await transaction(c => select(c, t, input.stage));
        if (!row) throw new DraftStorageError(); const observation = await restore(t, row, 'read');
        return freeze({ observation, payloadDigest: row.metadata.payloadDigest, stepInputDigest: row.metadata.stepInputDigest,
          outputDigest: row.metadata.outputDigest, recordsPolicyDigest: config.recordsPolicyDigest,
          executionAuthorized: false as const, retryAuthorized: false as const, gateSigned: false as const });
      } catch { throw new DraftStorageError(); } finally { active = false; }
    },
    /** Verify an immutable pair under one current authority/source context and
     * its final recheck. No cache crosses calls or replaces current policy/key
     * checks. Both stages must share every execution/source/owner binding. */
    async readExchange(raw: unknown) {
      if (closed || active || pending) throw new DraftStorageError(); active = true;
      const leases: Array<{keyId:string;bytes:Buffer;draftId:string}> = [];
      try {
        const t=freeze(targetSchema.parse(raw)); await authorize(t,'read');
        const rows=await transaction(async c=>{
          const request=await select(c,t,'request'),response=await select(c,t,'response');
          if(!request||!response)throw new DraftStorageError();
          const common=({stage:_stage,payloadDigest:_payload,requestDigest:_request,outputDigest:_output,...binding}:Metadata)=>binding;
          if(hash(common(request.metadata))!==hash(common(response.metadata))||response.metadata.requestDigest!==request.metadata.payloadDigest)throw new Conflict();
          await lifecycle(c,response.metadata);return {request,response};
        });
        const current=await context(t);
        const decode=async(row:Stored)=>{
          if(row.metadata.draftId!==current.original.source.draftId||row.metadata.draftRevision!==current.original.source.revision)throw new Conflict();
          const key=await bounded(dependencies.originals.keyForDraft(freeze({...config,draftId:row.metadata.draftId}),row.envelope.keyId));guard();
          if(!(key.bytes instanceof Uint8Array)||key.bytes.byteLength!==32)throw new DraftStorageError();
          const lease={keyId:key.keyId,bytes:Buffer.from(key.bytes),draftId:row.metadata.draftId};leases.push(lease);
          const payload=freeze(developmentObservationSchema.parse(openDraft(row.envelope,aad(row.metadata),lease)));
          if(Buffer.byteLength(JSON.stringify(payload))>786432)throw new DraftStorageError();
          if(hash(metadata(t,payload,current))!==hash(row.metadata))throw new Conflict();return payload;
        };
        const request=await decode(rows.request),response=await decode(rows.response);
        if(request.stage!=='request'||response.stage!=='response'||hash(request.rendered)!==hash(current.prepared.rendered)
          ||response.result.role!==t.stepId||response.requestDigest!==rows.request.metadata.payloadDigest)throw new Conflict();
        const u=response.usage;if(u.inputTokens!==null&&u.outputTokens!==null&&u.totalTokens!==null&&u.inputTokens+u.outputTokens!==u.totalTokens)throw new Conflict();
        for(const lease of leases){
          const fresh=await bounded(dependencies.originals.keyForDraft(freeze({...config,draftId:lease.draftId}),lease.keyId));guard();
          if(!(fresh.bytes instanceof Uint8Array)||fresh.bytes.byteLength!==32)throw new DraftStorageError();
          const bytes=Buffer.from(fresh.bytes);try{if(fresh.keyId!==lease.keyId||!bytes.equals(lease.bytes))throw new DraftStorageError();}finally{bytes.fill(0);}
        }
        await authorize(t,'read');const finalContext=await context(t);
        if(hash(metadata(t,request,finalContext))!==hash(rows.request.metadata)||hash(metadata(t,response,finalContext))!==hash(rows.response.metadata)
          ||(finalContext.completedOutputDigest!==null&&finalContext.completedOutputDigest!==hash(response.result)))throw new Conflict();
        const final=await transaction(async c=>({expiry:await lifecycle(c,rows.response.metadata),request:await select(c,t,'request'),response:await select(c,t,'response')}));
        guard();if(performance.now()>=final.expiry||hash(final.request)!==hash(rows.request)||hash(final.response)!==hash(rows.response))throw new DraftStorageError();
        return freeze({request,response,requestDigest:rows.request.metadata.payloadDigest,responseDigest:rows.response.metadata.payloadDigest,
          stepInputDigest:rows.response.metadata.stepInputDigest,outputDigest:rows.response.metadata.outputDigest,recordsPolicyDigest:config.recordsPolicyDigest,
          executionAuthorized:false as const,retryAuthorized:false as const,gateSigned:false as const});
      }catch{throw new DraftStorageError();}finally{for(const lease of leases)lease.bytes.fill(0);active=false;}
    },
    close() { closed = true; originals.close(); for (const child of children) child.close(); },
  };
}
