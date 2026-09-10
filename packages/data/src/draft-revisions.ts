import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { describeIntentDraftRevision, intentDraftContentSchema, type IntentDraftContent } from '@steer/tool-registry/intent-draft-content';
import { applyRuntimeQueryLimits, DatabaseCommitOutcomeUnknownError, type DatabasePool } from './runtime-pool.ts';
import { draftEnvelopeSchema, DraftStorageError, openDraft, sealDraft, type DraftKey } from './draft-envelope.ts';
import { registerDraftReadSession } from './draft-read-session.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/), uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const revision = z.number().int().min(1).max(1000), timestamp = z.iso.datetime({ precision: 3 });
const configurationSchema = z.strictObject({ organizationId: id, subject: id, productId: id, repository: id, branch: id,
  configurationRevision: id, recordsPolicyDigest: digest });
export const draftRecordsConfigurationSchema = configurationSchema;
const appendSchema = z.strictObject({ draftId: uuid, mutationId: uuid, expectedRevision: z.number().int().min(0).max(1000),
  expectedDigest: digest.nullable(), content: intentDraftContentSchema }).superRefine((v, ctx) => {
  if ((v.expectedRevision === 0) !== (v.expectedDigest === null)) ctx.addIssue({ code: 'custom', message: 'Invalid draft parent.' });
});
const readSchema = z.strictObject({ draftId: uuid, revision: z.union([revision, z.literal('latest')]) });
const metadataSchema = z.strictObject({ organizationId: id, subject: id, productId: id, draftId: uuid, revision,
  mutationId: uuid, commandDigest: digest, parentRevision: z.number().int().min(0).max(999), parentDigest: digest.nullable(),
  sourceRevision: revision, contentDigest: digest, scopeInputDigest: digest, configurationDigest: digest, draftCreatedAt: timestamp });
/** Canonical metadata ordering is shared by ciphertext-free discovery validation. */
export const draftRevisionMetadataSchema = metadataSchema;
type Configuration = z.infer<typeof configurationSchema>;
type Metadata = z.infer<typeof metadataSchema>;
type Stored = { metadata: Metadata; revisionDigest: string; envelope: z.infer<typeof draftEnvelopeSchema> };
type Header = { createdAt: string; monotonicExpiry: number; clock: number };
type Snapshot = { content: IntentDraftContent; reference: Metadata & { revisionDigest: string }; latestRevision: number };
class Conflict extends Error {}
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const revisionHash = (metadata: Metadata) => hash(['steer-draft-revision/v1', metadata]);
const aad = (metadata: Metadata) => JSON.stringify(['steer-draft-revision-content/v1', metadata]);
/** Internal canonical format; using it does not establish records/key authority. */
export const draftRevisionCodec = Object.freeze({ metadata: metadataSchema, aad, revisionDigest: revisionHash, payload: intentDraftContentSchema });
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const clearScope = "SELECT set_config('steer.draft_organization','',false), set_config('steer.draft_subject','',false), set_config('steer.draft_product','',false)";

/** Disabled versioned content, never review/generation provenance or a Git save.
 * Requires the actual server-owned lifecycle row and current owner/policy authority.
 * Keys stay external; no transaction spans authorization or key-service calls.
 */
export function createDraftRevisionStore(pool: DatabasePool, rawConfiguration: unknown, dependencies: {
  authorize: (context: Readonly<{ configuration: Configuration; draftId: string; action: 'append' | 'read' }>) => Promise<void>;
  keyForDraft: (reference: Readonly<Configuration & { draftId: string }>, keyId: string | null) => Promise<DraftKey>;
}) {
  const config = freeze(configurationSchema.parse(rawConfiguration)), configurationDigest = hash(config);
  if (typeof dependencies.authorize !== 'function' || typeof dependencies.keyForDraft !== 'function') throw new DraftStorageError();
  let closed = false, active = false, pending = 0;
  const bounded = async <T>(work: Promise<T>): Promise<T> => {
    pending++; void work.finally(() => { pending--; }).catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DraftStorageError()), 5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  const authorize = async (draftId: string, action: 'append' | 'read') => {
    if (closed || await bounded(dependencies.authorize(freeze({ configuration: config, draftId, action }))) !== undefined || closed) throw new DraftStorageError();
  };
  const key = (draftId: string, keyId: string | null) => bounded(dependencies.keyForDraft(freeze({ ...config, draftId }), keyId));
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
      if (!role || role.rolname !== 'steer_draft_runtime' || role.login_role !== 'steer_draft_runtime' || role.rolsuper || role.rolbypassrls || role.owns_objects) throw new DraftStorageError();
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
  async function header(client: PoolClient, draftId: string): Promise<Header> {
    const started = performance.now();
    const row = (await client.query(`SELECT *, floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms
      FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND draft_id=$2 FOR UPDATE`, [config.organizationId, draftId])).rows[0];
    const clock = Number(row?.clock_ms);
    if (!row || !Number.isSafeInteger(clock) || clock < 0 || row.subject !== config.subject || row.product_id !== config.productId || row.configuration_digest !== configurationDigest
      || row.held || row.created_at.getTime() > clock || row.use_until.getTime() <= clock) throw new DraftStorageError();
    return { createdAt: row.created_at.toISOString(), monotonicExpiry: started + row.use_until.getTime() - clock, clock };
  }
  function stored(row: any, draftId: string, h: Header): Stored | null {
    if (!row) return null;
    const metadata = metadataSchema.parse(row.record), revisionDigest = digest.parse(row.revision_digest);
    if (metadata.organizationId !== config.organizationId || metadata.subject !== config.subject || metadata.productId !== config.productId
      || metadata.draftId !== draftId || metadata.draftCreatedAt !== h.createdAt || metadata.configurationDigest !== configurationDigest
      || metadata.revision !== Number(row.revision) || metadata.mutationId !== row.mutation_id || metadata.commandDigest !== row.command_digest
      || metadata.parentRevision !== metadata.revision - 1 || (metadata.parentRevision === 0) !== (metadata.parentDigest === null)
      || revisionHash(metadata) !== revisionDigest) throw new Conflict();
    return { metadata, revisionDigest, envelope: draftEnvelopeSchema.parse(row.encrypted_value) };
  }
  async function lookup(client: PoolClient, draftId: string, h: Header, selector: { revision: number | 'latest' } | { mutationId: string }) {
    const filter = 'mutationId' in selector ? 'AND mutation_id=$3' : selector.revision === 'latest' ? 'ORDER BY revision DESC LIMIT 1' : 'AND revision=$3';
    const args = [config.organizationId, draftId, ...('mutationId' in selector ? [selector.mutationId] : selector.revision === 'latest' ? [] : [selector.revision])];
    return stored((await client.query(`SELECT * FROM steer_drafts.draft_revisions WHERE organization_id=$1 AND draft_id=$2 ${filter}`, args)).rows[0], draftId, h);
  }
  async function plaintext(value: Stored, snapshot: DraftKey): Promise<IntentDraftContent> {
    const content = intentDraftContentSchema.parse(openDraft(value.envelope, aad(value.metadata), snapshot));
    if (hash(content) !== value.metadata.contentDigest) throw new Conflict();
    // Recompute at the server-selected source revision; recovered content never
    // restores review, approval or execution authority.
    const computed = await describeIntentDraftRevision({ ...config, draftId: value.metadata.draftId }, content,
      { content, sourceRevision: value.metadata.sourceRevision });
    if (computed.scopeInputDigest !== value.metadata.scopeInputDigest) throw new Conflict();
    return content;
  }
  async function decode(value: Stored): Promise<IntentDraftContent> {
    const originalKey = await key(value.metadata.draftId, value.envelope.keyId);
    if (!(originalKey.bytes instanceof Uint8Array) || originalKey.bytes.byteLength !== 32) throw new DraftStorageError();
    const snapshot = { keyId: originalKey.keyId, bytes: Buffer.from(originalKey.bytes) };
    try {
      const content = await plaintext(value, snapshot);
      const currentKey = await key(value.metadata.draftId, value.envelope.keyId);
      if (!(currentKey.bytes instanceof Uint8Array) || currentKey.bytes.byteLength !== 32) throw new DraftStorageError();
      const current = Buffer.from(currentKey.bytes);
      try { if (currentKey.keyId !== snapshot.keyId || !current.equals(snapshot.bytes)) throw new DraftStorageError(); }
      finally { current.fill(0); }
      if (closed) throw new DraftStorageError(); return content;
    } finally { snapshot.bytes.fill(0); }
  }
  async function restore(draftId: string, selector: number | 'latest', action: 'append' | 'read'): Promise<Snapshot> {
    await authorize(draftId, action);
    const current = await transaction(async c => { const h = await header(c, draftId); return { h, row: await lookup(c, draftId, h, { revision: selector }) }; });
    if (!current.row) throw new DraftStorageError();
    const content = await decode(current.row); await authorize(draftId, action);
    const final = await transaction(async c => { const h = await header(c, draftId); return { h,
      row: await lookup(c, draftId, h, { revision: current.row!.metadata.revision }), latest: await lookup(c, draftId, h, { revision: 'latest' }) }; });
    if (closed || performance.now() >= final.h.monotonicExpiry || !final.row || !final.latest
      || JSON.stringify(final.row) !== JSON.stringify(current.row)) throw new DraftStorageError();
    return freeze({ content, reference: { ...final.row.metadata, revisionDigest: final.row.revisionDigest }, latestRevision: final.latest.metadata.revision });
  }
  const store = {
    async append(raw: unknown): Promise<{ outcome: 'acknowledged'; reference: Snapshot['reference']; latestRevision: number }
      | { outcome: 'conflict' | 'unknown' | 'unavailable' }> {
      if (closed || active || pending) return { outcome: 'unavailable' }; active = true; let persisted = false;
      try {
        const input = freeze(appendSchema.parse(raw)), commandDigest = hash(['steer-draft-command/v1', configurationDigest, input]);
        await authorize(input.draftId, 'append');
        const prior = await transaction(async c => { const h = await header(c, input.draftId); return { h,
          duplicate: await lookup(c, input.draftId, h, { mutationId: input.mutationId }), latest: await lookup(c, input.draftId, h, { revision: 'latest' }) }; });
        let target: number;
        if (prior.duplicate) {
          if (prior.duplicate.metadata.commandDigest !== commandDigest) throw new Conflict();
          target = prior.duplicate.metadata.revision; persisted = true;
        } else {
          if ((prior.latest?.metadata.revision ?? 0) !== input.expectedRevision || (prior.latest?.revisionDigest ?? null) !== input.expectedDigest) throw new Conflict();
          if (input.expectedRevision >= 1000) throw new DraftStorageError();
          const previous = prior.latest ? { content: await decode(prior.latest), sourceRevision: prior.latest.metadata.sourceRevision } : null;
          const described = await describeIntentDraftRevision({ ...config, draftId: input.draftId }, input.content, previous);
          const metadata = metadataSchema.parse({ organizationId: config.organizationId, subject: config.subject, productId: config.productId,
            draftId: input.draftId, revision: input.expectedRevision + 1, mutationId: input.mutationId, commandDigest,
            parentRevision: input.expectedRevision, parentDigest: input.expectedDigest, sourceRevision: described.sourceRevision,
            contentDigest: hash(input.content), scopeInputDigest: described.scopeInputDigest, configurationDigest, draftCreatedAt: prior.h.createdAt });
          const revisionDigest = revisionHash(metadata), envelope = sealDraft(input.content, aad(metadata), await key(input.draftId, null));
          await authorize(input.draftId, 'append');
          target = await transaction(async c => {
            const h = await header(c, input.draftId), duplicate = await lookup(c, input.draftId, h, { mutationId: input.mutationId });
            if (duplicate) { if (duplicate.metadata.commandDigest !== commandDigest) throw new Conflict(); return duplicate.metadata.revision; }
            const latest = await lookup(c, input.draftId, h, { revision: 'latest' });
            if ((latest?.metadata.revision ?? 0) !== input.expectedRevision || (latest?.revisionDigest ?? null) !== input.expectedDigest || h.createdAt !== prior.h.createdAt) throw new Conflict();
            await c.query(`INSERT INTO steer_drafts.draft_revisions
              (organization_id,subject,product_id,draft_id,revision,mutation_id,command_digest,revision_digest,record,encrypted_value)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`, [config.organizationId, config.subject, config.productId,
              input.draftId, metadata.revision, input.mutationId, commandDigest, revisionDigest, JSON.stringify(metadata), JSON.stringify(envelope)]);
            if (closed || performance.now() >= h.monotonicExpiry) throw new DraftStorageError(); return metadata.revision;
          });
          persisted = true;
        }
        const restored = await restore(input.draftId, target, 'append');
        if (hash(restored.content) !== hash(input.content)) throw new Conflict();
        return freeze({ outcome: 'acknowledged', reference: restored.reference, latestRevision: restored.latestRevision });
      } catch (error) { return { outcome: persisted || error instanceof DatabaseCommitOutcomeUnknownError ? 'unknown' : error instanceof Conflict ? 'conflict' : 'unavailable' }; }
      finally { active = false; }
    },
    async read(raw: unknown): Promise<Snapshot> {
      if (closed || active || pending) throw new DraftStorageError(); active = true;
      try { const input = readSchema.parse(raw); return await restore(input.draftId, input.revision, 'read'); }
      catch { throw new DraftStorageError(); }
      finally { active = false; }
    },
    close() { closed = true; },
  };
  registerDraftReadSession(store.read, config, async (raw, current, work) => {
    if (closed || active || pending) throw new DraftStorageError(); active = true;
    const ports = [dependencies.authorize, dependencies.keyForDraft, pool.connect, store.append, store.read, store.close];
    let ended = false, failed = false, reading = false, consumed = false, expiry = Infinity, observedClock = -1;
    let lease: { keyId: string; bytes: Buffer } | undefined, captured: Snapshot | undefined, row: Stored | undefined;
    const tasks = new Set<Promise<unknown>>();
    const guard = () => { if (closed || ended || failed || (expiry !== Infinity && !Number.isFinite(expiry)) || performance.now() >= expiry
      || [dependencies.authorize, dependencies.keyForDraft, pool.connect, store.append, store.read, store.close].some((p, i) => p !== ports[i])) throw new DraftStorageError(); };
    const present = async () => { guard(); if (await current() !== undefined) throw new DraftStorageError(); guard(); };
    try {
      const input = freeze(readSchema.parse(raw)); await present();
      const read = () => {
        if (reading || ended || failed) { failed = true; const denied = Promise.reject(new DraftStorageError()); void denied.catch(() => {}); return denied; }
        reading = true;
        const task = Promise.resolve().then(async () => {
          guard(); await authorize(input.draftId, 'read'); await present();
          if (!captured) {
            const first = await transaction(async c => { const h = await header(c, input.draftId); return { h,
              row: await lookup(c, input.draftId, h, { revision: input.revision }), latest: await lookup(c, input.draftId, h, { revision: 'latest' }) }; });
            if (!first.row || !first.latest) throw new DraftStorageError(); row = first.row; observedClock = first.h.clock; expiry = Math.min(expiry, first.h.monotonicExpiry); guard();
            const original = await key(input.draftId, row.envelope.keyId); guard();
            if (!(original.bytes instanceof Uint8Array) || original.bytes.byteLength !== 32) throw new DraftStorageError();
            lease = { keyId: original.keyId, bytes: Buffer.from(original.bytes) };
            const content = await plaintext(row, lease); guard();
            await authorize(input.draftId, 'read'); await present();
            captured = freeze({ content, reference: { ...row.metadata, revisionDigest: row.revisionDigest }, latestRevision: first.latest.metadata.revision });
          }
          guard(); consumed = true; return captured;
        }).catch(error => { failed = true; throw error; }).finally(() => { reading = false; });
        tasks.add(task); void task.finally(() => tasks.delete(task)).catch(() => {}); return task;
      };
      if (await work(read) !== undefined || reading || tasks.size || !consumed || !captured || !row || !lease) throw new DraftStorageError();
      await present(); await authorize(input.draftId, 'read');
      const fresh = await key(input.draftId, row.envelope.keyId); guard();
      if (!(fresh.bytes instanceof Uint8Array) || fresh.bytes.byteLength !== 32) throw new DraftStorageError();
      const bytes = Buffer.from(fresh.bytes);
      try { if (fresh.keyId !== lease.keyId || !bytes.equals(lease.bytes)) throw new DraftStorageError(); } finally { bytes.fill(0); }
      await authorize(input.draftId, 'read'); await present();
      const final = await transaction(async c => { const h = await header(c, input.draftId); return { h,
        row: await lookup(c, input.draftId, h, { revision: captured!.reference.revision }), latest: await lookup(c, input.draftId, h, { revision: 'latest' }) }; });
      expiry = Math.min(expiry, final.h.monotonicExpiry); guard();
      if (final.h.clock < observedClock || hash(final.row) !== hash(row) || final.latest?.metadata.revision !== captured.latestRevision) throw new DraftStorageError();
      await present();
    } catch { failed = true; throw new DraftStorageError(); }
    finally { ended = true; await Promise.allSettled([...tasks]); lease?.bytes.fill(0); captured = undefined; row = undefined; active = false; }
  });
  return store;
}
