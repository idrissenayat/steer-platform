import type { PoolClient } from 'pg';
import { z } from 'zod';
import { createIntentOperationStore } from './intent-operations.ts';
import { createDraftRevisionStore } from './draft-revisions.ts';
import { describeDevelopmentOriginal, developmentOriginalHash as hash, freezeOriginal as freeze, type DevelopmentOriginal } from './development-original-contracts.ts';
import { draftEnvelopeSchema, openDraft, sealDraft, DraftStorageError } from './draft-envelope.ts';
import { applyRuntimeQueryLimits, DatabaseCommitOutcomeUnknownError, type DatabasePool } from './runtime-pool.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/), uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const revision = z.number().int().min(1).max(1000);
const configurationSchema = z.strictObject({ organizationId:id,subject:id,productId:id,repository:id,branch:id,configurationRevision:id,recordsPolicyDigest:digest });
export const developmentRecordsConfigurationSchema = configurationSchema;
const targetSchema = z.strictObject({ operationId:uuid,inputDigest:digest });
const metadataSchema = configurationSchema.pick({ organizationId:true,subject:true,productId:true }).extend({ operationId:uuid,inputDigest:digest,
  draftId:uuid,draftRevision:revision,draftRevisionDigest:digest,scopeInputDigest:digest,configurationDigest:digest,executionConfigurationDigest:digest });
type Target = z.infer<typeof targetSchema>;
type Metadata = z.infer<typeof metadataSchema>;
type Stored = { metadata:Metadata; envelope:z.infer<typeof draftEnvelopeSchema> };
type DraftDependencies = Parameters<typeof createDraftRevisionStore>[2];
const aad = (m:Metadata) => JSON.stringify(['steer-development-original-content/v1',m]);
const clearScope = "SELECT set_config('steer.draft_organization','',false),set_config('steer.draft_subject','',false),set_config('steer.draft_product','',false)";
class Conflict extends Error {}

/** Disabled immutable operation-input recovery. The constructor needs only current
 * draft/records scope, not an old execution configuration. Restored configurations
 * are historical data, never renewed authorization. No dispatch, renewal or delete.
 * authorizeOriginal verifies current permission to every retained evidence source;
 * for put it also verifies the trusted profiles and actual human direction evidence.
 */
export function createDevelopmentOriginalStore(pools:{ drafts:DatabasePool; execution:DatabasePool }, rawConfiguration:unknown, dependencies:{
  authorize:(context:Readonly<{ configuration:z.infer<typeof configurationSchema>; target:Target; action:'put'|'read' }>)=>Promise<void>;
  authorizeOriginal:(context:Readonly<{ original:DevelopmentOriginal; action:'put'|'read' }>)=>Promise<void>;
  authorizeOperation:Parameters<typeof createIntentOperationStore>[2]['authorize'];
  authorizeDraft:DraftDependencies['authorize']; keyForDraft:DraftDependencies['keyForDraft'];
}) {
  const config=freeze(configurationSchema.parse(rawConfiguration)), configurationDigest=hash(config);
  for (const name of ['authorize','authorizeOriginal','authorizeOperation','authorizeDraft','keyForDraft'] as const)
    if (typeof dependencies[name]!=='function') throw new DraftStorageError();
  const drafts=createDraftRevisionStore(pools.drafts,config,{ authorize:dependencies.authorizeDraft,keyForDraft:dependencies.keyForDraft });
  let closed=false,active=false,pending=0;
  const bounded=async <T>(work:Promise<T>):Promise<T> => {
    pending++; void work.finally(()=>{ pending--; }).catch(()=>{}); let timer:ReturnType<typeof setTimeout>|undefined;
    try { return await Promise.race([work,new Promise<never>((_,reject)=>{ timer=setTimeout(()=>reject(new DraftStorageError()),5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  const authorize=async (target:Target,action:'put'|'read') => {
    if (closed || await bounded(dependencies.authorize(freeze({ configuration:config,target:{ operationId:target.operationId,inputDigest:target.inputDigest },action })))!==undefined || closed)
      throw new DraftStorageError();
  };
  const verify=async (original:DevelopmentOriginal,action:'put'|'read') => {
    if (closed || await bounded(dependencies.authorizeOriginal(freeze({ original,action })))!==undefined || closed) throw new DraftStorageError();
  };
  const key=(draftId:string,keyId:string|null)=>bounded(dependencies.keyForDraft(freeze({ ...config,draftId }),keyId));
  async function transaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T> {
    let client:PoolClient|undefined,finished=false,committing=false,broken=false;
    try {
      if (closed) throw new DraftStorageError();
      client=await bounded(pools.drafts.connect().then(c=>{ if (finished || closed) { c.release(true); throw new DraftStorageError(); } return c; }));
      if (!client) throw new DraftStorageError();
      await applyRuntimeQueryLimits(client); await client.query(clearScope); await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const r=(await client.query(`SELECT r.rolname,session_user AS login_role,r.rolsuper,r.rolbypassrls,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer_drafts' AND c.relowner=r.oid) AS owns_objects
        FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
      if (!r || r.rolname!=='steer_draft_runtime' || r.login_role!=='steer_draft_runtime' || r.rolsuper || r.rolbypassrls || r.owns_objects) throw new DraftStorageError();
      await client.query("SELECT set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)",
        [config.organizationId,config.subject,config.productId]);
      const value=await work(client); if (closed) throw new DraftStorageError();
      committing=true; await client.query('COMMIT'); await client.query(clearScope); if (closed) throw new DraftStorageError(); return value;
    } catch (e) {
      broken=committing; if (client) try { await client.query('ROLLBACK'); await client.query(clearScope); } catch { broken=true; }
      if (committing) throw new DatabaseCommitOutcomeUnknownError(); throw e;
    } finally { finished=true; client?.release(broken); }
  }
  async function sourceState(c:PoolClient,m:Metadata) {
    const start=performance.now(),h=(await c.query(`SELECT *,floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms
      FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND draft_id=$2 FOR UPDATE`,[config.organizationId,m.draftId])).rows[0];
    if (!h || h.subject!==config.subject || h.product_id!==config.productId || h.configuration_digest!==configurationDigest
      || h.held || h.created_at.getTime()>Number(h.clock_ms) || h.use_until.getTime()<=Number(h.clock_ms)) throw new DraftStorageError();
    const s=(await c.query('SELECT revision_digest,record FROM steer_drafts.draft_revisions WHERE organization_id=$1 AND draft_id=$2 AND revision=$3',
      [config.organizationId,m.draftId,m.draftRevision])).rows[0];
    if (!s || s.revision_digest!==m.draftRevisionDigest || s.record.scopeInputDigest!==m.scopeInputDigest) throw new Conflict();
    const latest=Number((await c.query('SELECT max(revision) AS revision FROM steer_drafts.draft_revisions WHERE organization_id=$1 AND draft_id=$2',
      [config.organizationId,m.draftId])).rows[0].revision);
    return { expiry:start+h.use_until.getTime()-Number(h.clock_ms),clock:Number(h.clock_ms),latestRevision:latest };
  }
  async function select(c:PoolClient,t:Target):Promise<Stored|null> {
    const r=(await c.query('SELECT * FROM steer_drafts.development_originals WHERE organization_id=$1 AND operation_id=$2',[config.organizationId,t.operationId])).rows[0];
    if (!r) return null; const m=metadataSchema.parse(r.record);
    if (m.organizationId!==config.organizationId || m.subject!==config.subject || m.productId!==config.productId || m.configurationDigest!==configurationDigest
      || m.operationId!==t.operationId || m.inputDigest!==t.inputDigest || m.operationId!==r.operation_id || m.inputDigest!==r.input_digest
      || m.draftId!==r.draft_id || m.draftRevision!==Number(r.draft_revision)) throw new Conflict();
    return { metadata:m,envelope:draftEnvelopeSchema.parse(r.encrypted_value) };
  }
  function metadata(t:Target,original:DevelopmentOriginal):Metadata {
    for (const k of Object.keys(config) as Array<keyof typeof config>) if (original.configuration[k]!==config[k]) throw new Conflict();
    return metadataSchema.parse({ organizationId:config.organizationId,subject:config.subject,productId:config.productId,...t,
      draftId:original.source.draftId,draftRevision:original.source.revision,draftRevisionDigest:original.source.revisionDigest,
      scopeInputDigest:original.source.scopeInputDigest,configurationDigest,executionConfigurationDigest:hash(original.configuration) });
  }
  async function execution(t:Target,original:DevelopmentOriginal) {
    const store=createIntentOperationStore(pools.execution,original.configuration,{ authorize:dependencies.authorizeOperation,verifyCheckpoint:async()=>{ throw new DraftStorageError(); } });
    try {
      const result=await store.inspect(t);
      if (closed || result.outcome!=='ok' || result.value.operation.draftId!==original.source.draftId || result.value.operation.draftRevision!==original.source.revision)
        throw new Conflict();
    } finally { store.close(); }
  }
  async function source(original:DevelopmentOriginal) {
    const s=original.source,actual=await drafts.read({ draftId:s.draftId,revision:s.revision });
    if (actual.reference.revisionDigest!==s.revisionDigest || actual.reference.scopeInputDigest!==s.scopeInputDigest
      || actual.reference.sourceRevision!==s.sourceRevision || hash(actual.content)!==hash(s.content)) throw new Conflict();
  }
  async function restore(t:Target,row:Stored,action:'put'|'read') {
    await authorize(t,action); await transaction(c=>sourceState(c,row.metadata));
    const originalKey=await key(row.metadata.draftId,row.envelope.keyId);
    if (!(originalKey.bytes instanceof Uint8Array) || originalKey.bytes.byteLength!==32) throw new DraftStorageError();
    const lease={ keyId:originalKey.keyId,bytes:Buffer.from(originalKey.bytes) };
    try {
      const described=await describeDevelopmentOriginal(openDraft(row.envelope,aad(row.metadata),lease)),original=described.original;
      if (described.inputDigest!==t.inputDigest || hash(metadata(t,original))!==hash(row.metadata)) throw new Conflict();
      await verify(original,action); await source(original);
      const currentKey=await key(row.metadata.draftId,row.envelope.keyId);
      if (!(currentKey.bytes instanceof Uint8Array) || currentKey.bytes.byteLength!==32) throw new DraftStorageError();
      const current=Buffer.from(currentKey.bytes);
      try { if (currentKey.keyId!==lease.keyId || !current.equals(lease.bytes)) throw new DraftStorageError(); } finally { current.fill(0); }
      if (await bounded(dependencies.authorizeDraft(freeze({ configuration:config,draftId:row.metadata.draftId,action:'read' })))!==undefined || closed) throw new DraftStorageError();
      await verify(original,action); await authorize(t,action);
      if (action==='put') await execution(t,original);
      const final=await transaction(async c=>({ state:await sourceState(c,row.metadata),row:await select(c,t) }));
      if (closed || performance.now()>=final.state.expiry || hash(final.row)!==hash(row)) throw new DraftStorageError();
      return freeze({ original,latestDraftRevision:final.state.latestRevision,operationExpired:final.state.clock>=Date.parse(original.configuration.expiresAt),
        executionAuthorized:false as const,retryAuthorized:false as const,gateSigned:false as const });
    } finally { lease.bytes.fill(0); }
  }
  return {
    async put(raw:unknown) {
      if (closed || active || pending) return { outcome:'unavailable' as const }; active=true; let persisted=false;
      try {
        const request=z.strictObject({ operationId:uuid,inputDigest:digest,original:z.unknown() }).parse(raw),t=freeze(targetSchema.parse({ operationId:request.operationId,inputDigest:request.inputDigest }));
        await authorize(t,'put'); const described=await describeDevelopmentOriginal(request.original),original=described.original;
        if (described.inputDigest!==t.inputDigest) throw new Conflict(); const m=metadata(t,original);
        await verify(original,'put'); await execution(t,original); await source(original);
        const prior=await transaction(async c=>{ await sourceState(c,m); return select(c,t); });
        let row=prior;
        if (!row) {
          const candidate={ metadata:m,envelope:sealDraft(original,aad(m),await key(m.draftId,null)) };
          await verify(original,'put'); await authorize(t,'put'); await execution(t,original);
          if (await bounded(dependencies.authorizeDraft(freeze({configuration:config,draftId:m.draftId,action:'read'})))!==undefined || closed) throw new DraftStorageError();
          row=await transaction(async c=>{
            const state=await sourceState(c,m),duplicate=await select(c,t); if (duplicate) return duplicate;
            await c.query(`INSERT INTO steer_drafts.development_originals
              (organization_id,subject,product_id,operation_id,input_digest,draft_id,draft_revision,record,encrypted_value)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)`,[m.organizationId,m.subject,m.productId,m.operationId,m.inputDigest,m.draftId,m.draftRevision,JSON.stringify(m),JSON.stringify(candidate.envelope)]);
            if (closed || performance.now()>=state.expiry) throw new DraftStorageError(); return candidate;
          });
        }
        persisted=true; await restore(t,row,'put'); return freeze({ outcome:'stored' as const,...t });
      } catch (e) { return { outcome:persisted || e instanceof DatabaseCommitOutcomeUnknownError ? 'unknown' as const : e instanceof Conflict ? 'conflict' as const : 'unavailable' as const }; }
      finally { active=false; }
    },
    async read(raw:unknown) {
      if (closed || active || pending) throw new DraftStorageError(); active=true;
      try { const t=freeze(targetSchema.parse(raw)); await authorize(t,'read'); const row=await transaction(c=>select(c,t));
        if (!row) throw new DraftStorageError(); return await restore(t,row,'read');
      } catch { throw new DraftStorageError(); } finally { active=false; }
    },
    close() { closed=true; drafts.close(); },
  };
}
