import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';
import { DraftStorageError } from './draft-envelope.ts';

const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const timestamp = z.iso.datetime({ precision: 3 });
const configurationSchema = z.strictObject({ organizationId: id, subject: id, productId: id, repository: id, branch: id,
  configurationRevision: id, recordsPolicyDigest: digest });
const targetSchema = z.strictObject({ draftId: uuid });
const holdSchema = targetSchema.extend({ holdReference: uuid });
const publicationSchema = targetSchema.extend({ operationId: uuid, inputDigest: digest });
const publicationProofSchema = publicationSchema.extend({ publishedAt: timestamp });
const lifecycleSchema = z.strictObject({ draftId: uuid, createdAt: timestamp, retentionDeadline: timestamp, useUntil: timestamp,
  held: z.boolean(), holdReference: uuid.nullable(), discardedAt: timestamp.nullable(), publishedAt: timestamp.nullable(),
  publicationOperation: uuid.nullable(), publicationInput: digest.nullable(), expired: z.boolean() });
type Configuration = z.infer<typeof configurationSchema>;
type Lifecycle = z.infer<typeof lifecycleSchema>;
type Action = 'create' | 'inspect' | 'discard' | 'hold' | 'record-publication';
type Result = { outcome: 'ok'; value: Lifecycle } | { outcome: 'unavailable' | 'unknown' | 'conflict' };
class Conflict extends Error {}
const clearScope = "SELECT set_config('steer.draft_organization','',false), set_config('steer.draft_subject','',false), set_config('steer.draft_product','',false)";
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }

/** Disabled server-clock lifecycle metadata, not deletion or policy adoption.
 * authorize verifies current adopted policy, exact owner/product and action intent.
 * Qualified hold and publication evidence require distinct trusted ports. A caller
 * supplies only references: never creation, discard, expiry or approval timestamps.
 */
export function createDraftLifecycleStore(pool: DatabasePool, rawConfiguration: unknown, dependencies: {
  authorize: (context: Readonly<{ configuration: Configuration; action: Action; request: unknown }>) => Promise<void>;
  verifyHold?: (context: Readonly<{ configuration: Configuration; request: z.infer<typeof holdSchema> }>) => Promise<void>;
  verifyPublication?: (context: Readonly<{ configuration: Configuration; request: z.infer<typeof publicationSchema> }>) => Promise<unknown>;
}) {
  const config = freeze(configurationSchema.parse(rawConfiguration));
  if (typeof dependencies.authorize !== 'function') throw new DraftStorageError();
  const configurationDigest = createHash('sha256').update(JSON.stringify(config)).digest('hex');
  let closed = false, active = false, pending = 0;
  const bounded = async <T>(work: Promise<T>): Promise<T> => {
    pending++; void work.finally(() => { pending--; }).catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DraftStorageError()), 5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  async function run(action: Action, request: unknown): Promise<Result> {
    if (closed || active || pending) return { outcome: 'unavailable' }; active = true;
    let client: PoolClient | undefined, finished = false, committing = false, broken = false;
    const authorize = async () => {
      if (closed || await bounded(dependencies.authorize(freeze({ configuration: config, action, request }))) !== undefined || closed) throw new DraftStorageError();
    };
    try {
      await authorize();
      let proof: z.infer<typeof publicationProofSchema> | undefined, verifiedAt = 0;
      if (action === 'hold') {
        if (!dependencies.verifyHold || await bounded(dependencies.verifyHold(freeze({ configuration: config, request: holdSchema.parse(request) }))) !== undefined)
          throw new DraftStorageError();
        verifiedAt = performance.now();
      }
      if (action === 'record-publication') {
        if (!dependencies.verifyPublication) throw new DraftStorageError();
        const ref = publicationSchema.parse(request);
        proof = publicationProofSchema.parse(await bounded(dependencies.verifyPublication(freeze({ configuration: config, request: ref }))));
        if (proof.draftId !== ref.draftId || proof.operationId !== ref.operationId || proof.inputDigest !== ref.inputDigest) throw new Conflict();
        verifiedAt = performance.now();
      }
      await authorize();
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
      let draftId: string;
      if (action === 'create') {
        const { requestId } = z.strictObject({ requestId: uuid }).parse(request);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,4))', [JSON.stringify([config.organizationId, config.subject])]);
        const existing = (await client.query('SELECT draft_id FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND subject=$2 AND request_id=$3',
          [config.organizationId, config.subject, requestId])).rows[0];
        draftId = existing?.draft_id ?? randomUUID();
        if (!existing) {
          const count = Number((await client.query('SELECT count(*)::int AS n FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND subject=$2', [config.organizationId, config.subject])).rows[0].n);
          if (count >= 10000) throw new DraftStorageError();
          await client.query(`WITH observed AS MATERIALIZED (SELECT date_trunc('milliseconds',clock_timestamp()) AS clock)
            INSERT INTO steer_drafts.draft_lifecycles
            (organization_id,subject,product_id,draft_id,request_id,configuration_digest,created_at,retention_deadline,use_until)
            SELECT $1,$2,$3,$4,$5,$6,clock,clock+interval '168 hours',clock+interval '168 hours'
            FROM observed`,
            [config.organizationId, config.subject, config.productId, draftId, requestId, configurationDigest]);
        }
      } else draftId = targetSchema.parse({ draftId: (request as { draftId: string }).draftId }).draftId;
      const row = (await client.query('SELECT * FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND draft_id=$2 FOR UPDATE', [config.organizationId, draftId])).rows[0];
      if (!row) throw new DraftStorageError();
      if (row.configuration_digest !== configurationDigest || row.subject !== config.subject || row.product_id !== config.productId) throw new Conflict();
      if (action === 'hold') {
        const ref = holdSchema.parse(request);
        if (row.hold_reference && row.hold_reference !== ref.holdReference) throw new Conflict();
        await client.query('UPDATE steer_drafts.draft_lifecycles SET held=true, hold_reference=$3 WHERE organization_id=$1 AND draft_id=$2', [config.organizationId, draftId, ref.holdReference]);
      }
      if (action === 'discard') await client.query(`WITH observed AS MATERIALIZED (SELECT date_trunc('milliseconds',clock_timestamp()) AS clock)
        UPDATE steer_drafts.draft_lifecycles SET discarded_at=COALESCE(discarded_at,observed.clock),
        use_until=LEAST(use_until,COALESCE(discarded_at,observed.clock)+interval '60 seconds')
        FROM observed WHERE organization_id=$1 AND draft_id=$2`, [config.organizationId, draftId]);
      if (proof) {
        if (row.published_at && (row.published_at.toISOString() !== proof.publishedAt || row.publication_operation !== proof.operationId || row.publication_input !== proof.inputDigest)) throw new Conflict();
        await client.query(`UPDATE steer_drafts.draft_lifecycles SET published_at=$3,publication_operation=$4,publication_input=$5,
          use_until=LEAST(use_until,$3::timestamptz+interval '60 seconds') WHERE organization_id=$1 AND draft_id=$2`,
          [config.organizationId, draftId, proof.publishedAt, proof.operationId, proof.inputDigest]);
      }
      if (closed || (verifiedAt && performance.now() - verifiedAt >= 5000)) throw new DraftStorageError();
      const observedAt = performance.now();
      const updated = (await client.query(`SELECT *, clock_timestamp() >= use_until AS expired,
        floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms
        FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND draft_id=$2`, [config.organizationId, draftId])).rows[0];
      const value = lifecycleSchema.parse({ draftId, createdAt: updated.created_at.toISOString(), retentionDeadline: updated.retention_deadline.toISOString(), useUntil: updated.use_until.toISOString(),
        held: updated.held, holdReference: updated.hold_reference, discardedAt: updated.discarded_at?.toISOString() ?? null,
        publishedAt: updated.published_at?.toISOString() ?? null, publicationOperation: updated.publication_operation, publicationInput: updated.publication_input, expired: updated.expired });
      if (closed || (verifiedAt && performance.now() - verifiedAt >= 5000)) throw new DraftStorageError();
      committing = true; await client.query('COMMIT'); await client.query(clearScope);
      // Current authorization is outside the transaction; a late denial withholds
      // acknowledgement even when restriction metadata was durably committed.
      await authorize();
      value.expired ||= performance.now() >= observedAt + Date.parse(value.useUntil) - Number(updated.clock_ms);
      return freeze({ outcome: 'ok', value });
    } catch (error) {
      broken = committing;
      if (client) try { await client.query('ROLLBACK'); await client.query(clearScope); } catch { broken = true; }
      return { outcome: committing ? 'unknown' : error instanceof Conflict ? 'conflict' : 'unavailable' };
    } finally { finished = true; client?.release(broken); active = false; }
  }
  return {
    create: (raw: unknown) => run('create', freeze(z.strictObject({ requestId: uuid }).parse(raw))),
    inspect: (raw: unknown) => run('inspect', freeze(targetSchema.parse(raw))),
    discard: (raw: unknown) => run('discard', freeze(targetSchema.parse(raw))),
    hold: (raw: unknown) => run('hold', freeze(holdSchema.parse(raw))),
    recordPublication: (raw: unknown) => run('record-publication', freeze(publicationSchema.parse(raw))),
    async lifecycle(raw: unknown) {
      const ref = configurationSchema.extend({ draftId: uuid }).parse(raw);
      for (const key of Object.keys(config) as Array<keyof Configuration>) if (ref[key] !== config[key]) throw new DraftStorageError();
      const result = await run('inspect', freeze({ draftId: ref.draftId }));
      if (result.outcome !== 'ok') throw new DraftStorageError();
      return freeze({ createdAt: result.value.createdAt, useUntil: result.value.useUntil, held: result.value.held });
    },
    close() { closed = true; },
  };
}
