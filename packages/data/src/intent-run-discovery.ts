import type { PoolClient } from 'pg';
import { intentRunDiscoveryInputSchema, intentRunDiscoveryOutputSchema, intentRunEntrySchema, runCursorFor,
  type IntentRunDiscoveryReader, type IntentRunDiscoveryInput, type IntentRunEntry } from '@steer/tool-registry/intent-run-discovery-contracts';
import { draftRecordsConfigurationSchema, draftRevisionMetadataSchema } from './draft-revisions.ts';
import { scopeOriginalMetadataSchema } from './scope-review-originals.ts';
import { developmentOriginalMetadataSchema } from './development-originals.ts';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';

const unavailable = () => new Error('Retained run discovery is unavailable.');
const clearScope = "SELECT set_config('steer.draft_organization','',false),set_config('steer.draft_subject','',false),set_config('steer.draft_product','',false)";
/** Keyless, metadata-only history pointers. No execution pool, content reader,
 * model transport or writes. Discovery never establishes completed generation.
 * Every page is checked again after authority callbacks, outside SQL leases. */
export function createIntentRunDiscovery(pool: DatabasePool, rawConfiguration: unknown, deps: {
  authorize(context: Readonly<{ configuration: ReturnType<typeof draftRecordsConfigurationSchema.parse>; input: IntentRunDiscoveryInput }>): Promise<void>;
  authorizeEntry(context: Readonly<{ configuration: ReturnType<typeof draftRecordsConfigurationSchema.parse>; input: IntentRunDiscoveryInput; entry: IntentRunEntry }>): Promise<void>;
}) {
  const config = freeze(draftRecordsConfigurationSchema.parse(rawConfiguration)), configurationDigest = hash(config);
  if (typeof deps.authorize !== 'function' || typeof deps.authorizeEntry !== 'function') throw unavailable();
  const { organizationId, subject, productId, repository } = config, scope = freeze({ organizationId, subject, productId, repository });
  let closed = false, active = 0;
  return {
    scope,
    async discover(raw, revalidate) {
      const input = freeze(intentRunDiscoveryInputSchema.parse(raw));
      if (closed || active >= 4 || typeof revalidate !== 'function' || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])) throw unavailable();
      active++; let finished = false, timer: ReturnType<typeof setTimeout> | undefined;
      const guard = () => { if (closed || finished) throw unavailable(); };
      const current = async () => { guard(); if (await revalidate() !== undefined) throw unavailable(); guard(); };
      const authorize = async () => { await current(); if (await deps.authorize(freeze({ configuration: config, input })) !== undefined) throw unavailable(); await current(); };
      const read = async () => {
        await authorize(); let client: PoolClient | undefined, broken = false; const start = performance.now();
        try {
          client = await pool.connect(); guard(); await applyRuntimeQueryLimits(client); await client.query(clearScope);
          await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
          const role = (await client.query(`SELECT r.rolname,session_user AS login_role,r.rolsuper,r.rolbypassrls,
            EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer_drafts' AND c.relowner=r.oid) AS owns_objects
            FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
          if (!role || role.rolname !== 'steer_draft_runtime' || role.login_role !== 'steer_draft_runtime' || role.rolsuper || role.rolbypassrls || role.owns_objects) throw unavailable();
          await client.query("SELECT set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)", [organizationId, subject, productId]);
          const clock = (await client.query("SELECT date_trunc('milliseconds',clock_timestamp()) AS clock")).rows[0].clock as Date;
          const row = (await client.query(`SELECT d.created_at,d.use_until,r.revision,r.revision_digest,r.record,r.mutation_id,r.command_digest
            FROM steer_drafts.draft_lifecycles d JOIN LATERAL
              (SELECT revision,revision_digest,record,mutation_id,command_digest FROM steer_drafts.draft_revisions
               WHERE organization_id=d.organization_id AND draft_id=d.draft_id ORDER BY revision DESC LIMIT 1) r ON true
            WHERE d.organization_id=$1 AND d.subject=$2 AND d.product_id=$3 AND d.configuration_digest=$4 AND d.draft_id=$5
              AND NOT d.held AND d.discarded_at IS NULL AND d.published_at IS NULL AND d.created_at<=$6 AND d.use_until>$6`,
          [organizationId, subject, productId, configurationDigest, input.draftId, clock])).rows[0];
          if (!row) throw unavailable();
          const revision = (r: typeof row) => {
            const m = draftRevisionMetadataSchema.parse(r.record);
            if (m.organizationId !== organizationId || m.subject !== subject || m.productId !== productId || m.draftId !== input.draftId
              || m.revision !== Number(r.revision) || m.configurationDigest !== configurationDigest || m.draftCreatedAt !== row.created_at.toISOString()
              || m.mutationId !== r.mutation_id || m.commandDigest !== r.command_digest || m.parentRevision !== m.revision - 1
              || (m.parentRevision === 0) !== (m.parentDigest === null) || hash(['steer-draft-revision/v1', m]) !== r.revision_digest) throw unavailable();
            return { revision: m.revision, revisionDigest: r.revision_digest as string, scopeInputDigest: m.scopeInputDigest };
          };
          const latest = revision(row);
          if (input.cursor && input.cursor.latestRevisionDigest !== latest.revisionDigest) throw unavailable();
          const rows = (await client.query(`WITH originals AS (
            SELECT 0 AS kind_rank,review_id AS run_id,preparation_digest AS input_digest,payload_digest,draft_revision,record AS original_record
              FROM steer_drafts.scope_review_originals WHERE organization_id=$1 AND subject=$2 AND product_id=$3 AND draft_id=$4 AND record->>'configurationDigest'=$5
            UNION ALL
            SELECT 1 AS kind_rank,operation_id AS run_id,input_digest,NULL::text AS payload_digest,draft_revision,record AS original_record
              FROM steer_drafts.development_originals WHERE organization_id=$1 AND subject=$2 AND product_id=$3 AND draft_id=$4 AND record->>'configurationDigest'=$5
          ) SELECT o.*,r.revision,r.revision_digest,r.record,r.mutation_id,r.command_digest FROM originals o
            LEFT JOIN steer_drafts.draft_revisions r ON r.organization_id=$1 AND r.draft_id=$4 AND r.revision=o.draft_revision
            WHERE ($6::integer IS NULL OR (o.draft_revision,o.kind_rank,o.run_id)<($6::integer,$7::integer,$8::uuid))
            ORDER BY o.draft_revision DESC,o.kind_rank DESC,o.run_id DESC LIMIT 21`,
          [organizationId, subject, productId, input.draftId, configurationDigest, input.cursor?.revision ?? null,
            input.cursor ? Number(input.cursor.kind === 'development') : null, input.cursor?.runId ?? null])).rows;
          const entries = rows.map(r => {
            const source = revision(r);
            if (source.revision > latest.revision || source.revision !== Number(r.draft_revision)) throw unavailable();
            const m = r.kind_rank === 0 ? scopeOriginalMetadataSchema.parse(r.original_record) : developmentOriginalMetadataSchema.parse(r.original_record);
            if (m.organizationId !== organizationId || m.subject !== subject || m.productId !== productId || m.draftId !== input.draftId
              || m.draftRevision !== source.revision || m.draftRevisionDigest !== source.revisionDigest || m.scopeInputDigest !== source.scopeInputDigest
              || m.configurationDigest !== configurationDigest) throw unavailable();
            if ('reviewId' in m) {
              if (r.kind_rank !== 0 || m.reviewId !== r.run_id || m.preparationDigest !== r.input_digest || m.payloadDigest !== r.payload_digest) throw unavailable();
              return intentRunEntrySchema.parse({ kind: 'scope', source, reviewId: m.reviewId, preparationDigest: m.preparationDigest });
            }
            if (r.kind_rank !== 1 || m.operationId !== r.run_id || m.inputDigest !== r.input_digest) throw unavailable();
            return intentRunEntrySchema.parse({ kind: 'development', source, operationId: m.operationId, inputDigest: m.inputDigest });
          });
          await client.query('COMMIT'); await client.query(clearScope); guard();
          return { latest, entries, observedAt: clock.toISOString(), useUntil: row.use_until.toISOString(),
            expires: start + Math.min(row.use_until.getTime() - clock.getTime(), 30000) };
        } catch { broken = true; if (client) try { await client.query('ROLLBACK'); await client.query(clearScope); } catch {} throw unavailable(); }
        finally { client?.release(broken); }
      };
      const work = Promise.resolve().then(async () => {
        const first = await read();
        for (const entry of first.entries) { await current(); if (await deps.authorizeEntry(freeze({ configuration: config, input, entry })) !== undefined) throw unavailable(); await current(); }
        const final = await read();
        if (final.observedAt < first.observedAt || hash([first.latest, first.entries, first.useUntil]) !== hash([final.latest, final.entries, final.useUntil])) throw unavailable();
        await current(); guard(); if (performance.now() >= Math.min(first.expires, final.expires)) throw unavailable();
        const entries = final.entries.slice(0, 20), last = entries.at(-1);
        return freeze(intentRunDiscoveryOutputSchema.parse({ ...input, kind: 'steer-run-discovery/v1', observedAt: final.observedAt,
          useUntil: final.useUntil, latest: final.latest, entries, nextCursor: final.entries.length > 20 && last ? runCursorFor(last, final.latest.revisionDigest) : null,
          scope: 'current-owner-records-configuration-all-preserved-revisions', order: 'revision-type-id-descending-not-chronological',
          contentLoaded: false, executionAuthorized: false, savedToGit: false, gateSigned: false }));
      });
      void work.finally(() => { active--; }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); }
    },
    close() { closed = true; },
  } satisfies IntentRunDiscoveryReader & { close(): void };
}
