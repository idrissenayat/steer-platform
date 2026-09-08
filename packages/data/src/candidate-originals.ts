import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { candidateBundleInputSchema, planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { intentSaveBindingSchema } from '@steer/tool-registry/intent-revision-contracts';
import { applyRuntimeQueryLimits, DatabaseCommitOutcomeUnknownError, type DatabasePool } from './runtime-pool.ts';
import { draftEnvelopeSchema, DraftStorageError, openDraft, sealDraft, type DraftKey } from './draft-envelope.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const integer = z.number().int().nonnegative().safe();
const configurationSchema = z.strictObject({ organizationId: id, subject: id, productId: id, repository: id, branch: id,
  configurationRevision: id, recordsPolicyDigest: digest });
const requestSchema = z.strictObject({ bundle: candidateBundleInputSchema, confirmation: intentSaveBindingSchema });
const targetSchema = z.strictObject({ organizationId: id, operationId: uuid, inputDigest: digest });
const lifecycleSchema = z.strictObject({ createdAt: z.iso.datetime(), useUntil: z.iso.datetime(), held: z.boolean() });
const metadataSchema = configurationSchema.pick({ organizationId: true, subject: true, productId: true }).extend({
  operationId: uuid, draftId: uuid, draftRevision: integer.positive(), inputDigest: digest, payloadDigest: digest,
  configurationDigest: digest, createdAt: integer, retentionDeadline: integer,
});
type Configuration = z.infer<typeof configurationSchema>;
type Original = z.infer<typeof requestSchema>;
type Metadata = z.infer<typeof metadataSchema>;
type Target = z.infer<typeof targetSchema>;
type Lifecycle = z.infer<typeof lifecycleSchema>;
export type CandidateDraftReference = Readonly<Configuration & { draftId: string }>;
type Stored = { metadata: Metadata; envelope: z.infer<typeof draftEnvelopeSchema>; held: boolean; useUntil: number; now: number; monotonicExpiry: number };
class Conflict extends Error {}
const week = 7 * 86400000;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const aad = (metadata: Metadata) => JSON.stringify(['steer-candidate-original/v1', metadata]);
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const clearScope = "SELECT set_config('steer.draft_organization','',false), set_config('steer.draft_subject','',false), set_config('steer.draft_product','',false)";

/** Disabled immutable payload adapter, NOT an editor/autosave or a policy verifier.
 * Trusted ports must verify adopted records/purpose/current owner grants, an exact
 * admitted operation, server draft clocks/holds, and an externally governed key.
 * No keys, text, provider IO or lifecycle lookups occur inside SQL transactions.
 * Expiry denies use; there is no deletion, key destruction or backup-proof claim.
 */
export function createCandidateOriginalStore(pool: DatabasePool, rawConfiguration: unknown, dependencies: {
  authorize: (context: Readonly<{ configuration: Configuration; target: Target }>) => Promise<void>;
  verifyOriginal: (request: Readonly<Original>) => Promise<void>;
  lifecycle: (draft: CandidateDraftReference) => Promise<unknown>;
  keyForDraft: (draft: CandidateDraftReference, keyId: string | null) => Promise<DraftKey>;
}) {
  const config = freeze(configurationSchema.parse(rawConfiguration)), configurationDigest = hash(config);
  for (const name of ['authorize', 'verifyOriginal', 'lifecycle', 'keyForDraft'] as const)
    if (typeof dependencies[name] !== 'function') throw new DraftStorageError();
  let closed = false, active = false, pending = 0;
  const bounded = async <T>(work: Promise<T>): Promise<T> => {
    pending++; void work.finally(() => { pending--; }).catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DraftStorageError()), 5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  const authorize = async (target: Target) => {
    if (closed || target.organizationId !== config.organizationId
      || await bounded(dependencies.authorize(freeze({ configuration: config, target }))) !== undefined || closed) throw new DraftStorageError();
  };
  const draftRef = (draftId: string): CandidateDraftReference => freeze({ ...config, draftId });
  async function validate(raw: unknown) {
    const request = freeze(requestSchema.parse(raw)), input = request.bundle;
    for (const key of ['organizationId', 'productId', 'repository', 'branch'] as const)
      if (input[key] !== config[key]) throw new Conflict();
    if (input.originatorSubject !== config.subject) throw new Conflict();
    const plan = await planCandidateBundle(input, request.confirmation);
    return { request, target: freeze({ organizationId: config.organizationId, operationId: input.operationId, inputDigest: plan.inputDigest }) };
  }
  async function verify(request: Original) {
    if (closed || await bounded(dependencies.verifyOriginal(request)) !== undefined || closed) throw new DraftStorageError();
  }
  async function lifecycle(draftId: string): Promise<Lifecycle> {
    const value = lifecycleSchema.parse(await bounded(dependencies.lifecycle(draftRef(draftId))));
    if (Date.parse(value.useUntil) > Date.parse(value.createdAt) + week) throw new DraftStorageError();
    return value;
  }
  async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    let client: PoolClient | undefined, finished = false, committing = false, broken = false;
    try {
      if (closed) throw new DraftStorageError();
      client = await bounded(pool.connect().then(c => { if (finished || closed) { c.release(true); throw new DraftStorageError(); } return c; }));
      if (!client) throw new DraftStorageError();
      await applyRuntimeQueryLimits(client); await client.query(clearScope); await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const role = (await client.query(`SELECT r.rolname, session_user AS login_role, r.rolsuper, r.rolbypassrls,
        EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer_drafts' AND c.relowner=r.oid) AS owns_objects
        FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
      if (!role || role.rolname !== 'steer_draft_runtime' || role.login_role !== 'steer_draft_runtime' || role.rolsuper || role.rolbypassrls || role.owns_objects)
        throw new DraftStorageError();
      await client.query("SELECT set_config('steer.draft_organization',$1,true), set_config('steer.draft_subject',$2,true), set_config('steer.draft_product',$3,true)",
        [config.organizationId, config.subject, config.productId]);
      const result = await work(client);
      if (closed) throw new DraftStorageError();
      committing = true; await client.query('COMMIT'); await client.query(clearScope);
      if (closed) throw new DraftStorageError();
      return result;
    } catch (error) {
      broken = committing;
      if (client) try { await client.query('ROLLBACK'); await client.query(clearScope); } catch { broken = true; }
      if (committing) throw new DatabaseCommitOutcomeUnknownError();
      throw error;
    } finally { finished = true; client?.release(broken); }
  }
  async function select(client: PoolClient, target: Target): Promise<Stored | null> {
    const started = performance.now();
    const row = (await client.query(`SELECT *, floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms
      FROM steer_drafts.candidate_originals WHERE organization_id=$1 AND operation_id=$2 FOR UPDATE`, [config.organizationId, target.operationId])).rows[0];
    if (!row) return null;
    const metadata = metadataSchema.parse({ organizationId: row.organization_id, subject: row.subject, productId: row.product_id,
      operationId: row.operation_id, draftId: row.draft_id, draftRevision: Number(row.draft_revision), inputDigest: row.input_digest,
      payloadDigest: row.payload_digest, configurationDigest: row.configuration_digest,
      createdAt: row.draft_created_at.getTime(), retentionDeadline: row.retention_deadline.getTime() });
    if (metadata.organizationId !== config.organizationId || metadata.subject !== config.subject || metadata.productId !== config.productId
      || metadata.inputDigest !== target.inputDigest || metadata.configurationDigest !== configurationDigest
      || metadata.retentionDeadline !== metadata.createdAt + week) throw new Conflict();
    const useUntil = integer.parse(row.use_until.getTime()), now = integer.parse(Number(row.clock_ms));
    return { metadata, envelope: draftEnvelopeSchema.parse(row.encrypted_value), held: z.boolean().parse(row.held), useUntil, now,
      monotonicExpiry: started + useUntil - now };
  }
  async function draftState(client: PoolClient, metadata: Metadata, current: Lifecycle) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,3))', [JSON.stringify([config.organizationId, config.subject, config.productId, metadata.draftId])]);
    const rows = (await client.query('SELECT draft_created_at, use_until, held FROM steer_drafts.candidate_originals WHERE organization_id=$1 AND draft_id=$2',
      [config.organizationId, metadata.draftId])).rows;
    if (rows.some(row => row.draft_created_at.getTime() !== metadata.createdAt) || Date.parse(current.createdAt) !== metadata.createdAt) throw new Conflict();
    return { useUntil: new Date(Math.min(Date.parse(current.useUntil), ...rows.map(row => row.use_until.getTime()))).toISOString(),
      held: current.held || rows.some(row => row.held) };
  }
  async function synchronize(target: Target, metadata: Metadata, current: Lifecycle) {
    // Latch denial in a committed transaction, then throw outside it. A later
    // stale lifecycle response must never undo an observed hold or earlier clock.
    const row = await transaction(async client => {
      const state = await draftState(client, metadata, current);
      const before = await select(client, target);
      if (!before || hash(before.metadata) !== hash(metadata) || Date.parse(current.createdAt) !== metadata.createdAt) throw new Conflict();
      await client.query(`UPDATE steer_drafts.candidate_originals SET use_until=LEAST(use_until,$3::timestamptz), held=held OR $4
        WHERE organization_id=$1 AND draft_id=$2`, [config.organizationId, metadata.draftId, state.useUntil, state.held]);
      return (await select(client, target))!;
    });
    if (row.held || row.now < metadata.createdAt || row.now >= row.useUntil || performance.now() >= row.monotonicExpiry
      || row.useUntil > metadata.retentionDeadline) throw new DraftStorageError();
    return row;
  }
  async function recover(target: Target, initial?: Stored): Promise<Original> {
    await authorize(target);
    const stored = initial ?? await transaction(client => select(client, target));
    if (!stored) throw new DraftStorageError();
    const row = await synchronize(target, stored.metadata, await lifecycle(stored.metadata.draftId));
    const sourceKey = await bounded(dependencies.keyForDraft(draftRef(row.metadata.draftId), row.envelope.keyId));
    const lease = { keyId: sourceKey.keyId, bytes: Buffer.from(sourceKey.bytes) };
    try {
      const decoded = await validate(openDraft(row.envelope, aad(row.metadata), lease));
      if (hash(decoded.request) !== row.metadata.payloadDigest || decoded.target.inputDigest !== target.inputDigest
        || decoded.target.operationId !== target.operationId || decoded.request.confirmation.draftId !== row.metadata.draftId
        || decoded.request.confirmation.draftRevision !== row.metadata.draftRevision) throw new Conflict();
      await verify(decoded.request);
      // Snapshot the first key: a provider-owned mutable buffer is not evidence
      // that the historical key remained unchanged during slow validation.
      const currentKey = await bounded(dependencies.keyForDraft(draftRef(row.metadata.draftId), row.envelope.keyId));
      const currentBytes = Buffer.from(currentKey.bytes);
      try { if (currentKey.keyId !== lease.keyId || !currentBytes.equals(lease.bytes)) throw new DraftStorageError(); }
      finally { currentBytes.fill(0); }
      await authorize(target);
      const final = await synchronize(target, row.metadata, await lifecycle(row.metadata.draftId));
      if (closed || performance.now() >= final.monotonicExpiry || final.envelope.keyId !== row.envelope.keyId
        || final.envelope.ciphertext !== row.envelope.ciphertext || final.envelope.tag !== row.envelope.tag || final.envelope.iv !== row.envelope.iv)
        throw new DraftStorageError();
      return decoded.request;
    } finally { lease.bytes.fill(0); }
  }
  return {
    async put(raw: unknown): Promise<{ outcome: 'stored' | 'conflict' | 'unknown' | 'unavailable' }> {
      if (closed || active || pending) return { outcome: 'unavailable' }; active = true;
      try {
        const { request, target } = await validate(raw); await authorize(target); await verify(request);
        const current = await lifecycle(request.confirmation.draftId);
        const metadata = metadataSchema.parse({ organizationId: config.organizationId, subject: config.subject, productId: config.productId,
          operationId: target.operationId, draftId: request.confirmation.draftId, draftRevision: request.confirmation.draftRevision,
          inputDigest: target.inputDigest, payloadDigest: hash(request), configurationDigest,
          createdAt: Date.parse(current.createdAt), retentionDeadline: Date.parse(current.createdAt) + week });
        const prior = await transaction(client => select(client, target));
        if (prior) {
          if (hash(prior.metadata) !== hash(metadata)) throw new Conflict();
          await recover(target, prior); return { outcome: 'stored' };
        }
        if (current.held) throw new DraftStorageError();
        const envelope = sealDraft(request, aad(metadata), await bounded(dependencies.keyForDraft(draftRef(metadata.draftId), null)));
        await authorize(target); await verify(request);
        const latest = await lifecycle(metadata.draftId);
        await transaction(async client => {
          const state = await draftState(client, metadata, { ...latest,
            useUntil: new Date(Math.min(Date.parse(current.useUntil), Date.parse(latest.useUntil))).toISOString(), held: current.held || latest.held });
          if (state.held) throw new DraftStorageError();
          await client.query(`INSERT INTO steer_drafts.candidate_originals
            (organization_id,subject,product_id,operation_id,draft_id,draft_revision,input_digest,payload_digest,configuration_digest,
             encrypted_value,draft_created_at,retention_deadline,use_until,held)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,false)
            ON CONFLICT (organization_id,operation_id) DO NOTHING`, [config.organizationId, config.subject, config.productId,
            target.operationId, metadata.draftId, metadata.draftRevision, target.inputDigest, metadata.payloadDigest, configurationDigest,
            JSON.stringify(envelope), current.createdAt, new Date(metadata.retentionDeadline).toISOString(), state.useUntil]);
          const stored = await select(client, target);
          if (!stored || hash(stored.metadata) !== hash(metadata)) throw new Conflict();
        });
        await recover(target); return { outcome: 'stored' };
      } catch (error) { return { outcome: error instanceof DatabaseCommitOutcomeUnknownError ? 'unknown' : error instanceof Conflict ? 'conflict' : 'unavailable' }; }
      finally { active = false; }
    },
    async read(raw: unknown): Promise<Original> {
      if (closed || active || pending) throw new DraftStorageError(); active = true;
      try { return await recover(freeze(targetSchema.parse(raw))); }
      catch { throw new DraftStorageError(); }
      finally { active = false; }
    },
    close() { closed = true; },
  };
}
