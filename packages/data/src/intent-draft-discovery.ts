import type { PoolClient } from 'pg';
import { intentDraftDiscoveryInputSchema, intentDraftDiscoveryOutputSchema, intentDraftDiscoveryEntrySchema,
  type IntentDraftDiscoveryReader, type IntentDraftDiscoveryInput, type IntentDraftDiscoveryEntry } from '@steer/tool-registry/intent-draft-discovery-contracts';
import { draftRecordsConfigurationSchema, draftRevisionMetadataSchema } from './draft-revisions.ts';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';

const unavailable = () => new Error('Working draft discovery is unavailable.');
const clearScope = "SELECT set_config('steer.draft_organization','',false), set_config('steer.draft_subject','',false), set_config('steer.draft_product','',false)";
/** Metadata only, with no key or execution pool. A discovered reference is not
 * content preservation, a verified role result or authority to start generation.
 * Expired/held/discarded/published records are excluded, never deleted. */
export function createIntentDraftDiscovery(pool: DatabasePool, rawConfiguration: unknown, deps: {
  authorize(context: Readonly<{ configuration: ReturnType<typeof draftRecordsConfigurationSchema.parse>; input: IntentDraftDiscoveryInput }>): Promise<void>;
  authorizeEntry(context: Readonly<{ configuration: ReturnType<typeof draftRecordsConfigurationSchema.parse>; entry: IntentDraftDiscoveryEntry }>): Promise<void>;
}) {
  const config = freeze(draftRecordsConfigurationSchema.parse(rawConfiguration)), configurationDigest = hash(config);
  if (typeof deps.authorize !== 'function' || typeof deps.authorizeEntry !== 'function') throw unavailable();
  const { organizationId, subject, productId, repository } = config, scope = freeze({ organizationId, subject, productId, repository });
  let closed = false, active = 0;
  return {
    scope,
    async discover(raw, revalidate) {
      const input = freeze(intentDraftDiscoveryInputSchema.parse(raw));
      if (closed || active >= 4 || typeof revalidate !== 'function' || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])) throw unavailable();
      active++; let finished = false, timer: ReturnType<typeof setTimeout> | undefined;
      const guard = () => { if (closed || finished) throw unavailable(); };
      const current = async () => { guard(); if (await revalidate() !== undefined) throw unavailable(); guard(); };
      const authorize = async () => { await current(); if (await deps.authorize(freeze({ configuration: config, input })) !== undefined) throw unavailable(); await current(); };
      const read = async () => {
        await authorize(); let client: PoolClient | undefined, broken = false;
        const start = performance.now();
        try {
          client = await pool.connect(); guard(); await applyRuntimeQueryLimits(client); await client.query(clearScope);
          await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
          const role = (await client.query(`SELECT r.rolname, session_user AS login_role, r.rolsuper, r.rolbypassrls,
            EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer_drafts' AND c.relowner=r.oid) AS owns_objects
            FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
          if (!role || role.rolname !== 'steer_draft_runtime' || role.login_role !== 'steer_draft_runtime' || role.rolsuper || role.rolbypassrls || role.owns_objects) throw unavailable();
          await client.query("SELECT set_config('steer.draft_organization',$1,true), set_config('steer.draft_subject',$2,true), set_config('steer.draft_product',$3,true)", [organizationId, subject, productId]);
          const clock = (await client.query("SELECT date_trunc('milliseconds',clock_timestamp()) AS clock")).rows[0].clock as Date;
          const rows = (await client.query(`SELECT d.draft_id,d.created_at,d.use_until,r.revision,r.revision_digest,r.record,r.mutation_id,r.command_digest,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('operationId',o.operation_id,'inputDigest',o.input_digest))
              FROM (SELECT o.operation_id,o.input_digest FROM steer_drafts.development_originals o
                WHERE o.organization_id=d.organization_id AND o.subject=d.subject AND o.product_id=d.product_id
                AND o.draft_id=d.draft_id AND o.draft_revision=r.revision AND o.record->>'configurationDigest'=$4
                AND o.record->>'draftRevisionDigest'=r.revision_digest AND o.record->>'scopeInputDigest'=r.record->>'scopeInputDigest' LIMIT 2) o), '[]'::jsonb) AS runs
            FROM steer_drafts.draft_lifecycles d LEFT JOIN LATERAL
              (SELECT revision,revision_digest,record,mutation_id,command_digest FROM steer_drafts.draft_revisions WHERE organization_id=d.organization_id AND draft_id=d.draft_id ORDER BY revision DESC LIMIT 1) r ON true
            WHERE d.organization_id=$1 AND d.subject=$2 AND d.product_id=$3 AND d.configuration_digest=$4
              AND NOT d.held AND d.discarded_at IS NULL AND d.published_at IS NULL AND d.created_at<=$5 AND d.use_until>$5
              AND ($6::timestamptz IS NULL OR (d.created_at,d.draft_id)<($6::timestamptz,$7::uuid))
            ORDER BY d.created_at DESC,d.draft_id DESC LIMIT 21`,
          [organizationId, subject, productId, configurationDigest, clock, input.cursor?.createdAt ?? null, input.cursor?.draftId ?? null])).rows;
          guard();
          const entries = rows.map(row => {
            let latest: IntentDraftDiscoveryEntry['latest'] = null;
            if (row.record !== null) {
              const m = draftRevisionMetadataSchema.parse(row.record);
              if (m.organizationId !== organizationId || m.subject !== subject || m.productId !== productId || m.draftId !== row.draft_id
                || m.revision !== Number(row.revision) || m.configurationDigest !== configurationDigest || m.draftCreatedAt !== row.created_at.toISOString()
                || m.mutationId !== row.mutation_id || m.commandDigest !== row.command_digest || m.parentRevision !== m.revision - 1
                || (m.parentRevision === 0) !== (m.parentDigest === null)
                || hash(['steer-draft-revision/v1', m]) !== row.revision_digest) throw unavailable();
              latest = { revision: Number(row.revision), revisionDigest: row.revision_digest, sourceRevision: m.sourceRevision, scopeInputDigest: m.scopeInputDigest };
            }
            if (!Array.isArray(row.runs) || row.runs.length > 1) throw unavailable();
            return intentDraftDiscoveryEntrySchema.parse({ draftId: row.draft_id, createdAt: row.created_at.toISOString(), useUntil: row.use_until.toISOString(), latest, run: row.runs[0] ?? null });
          });
          await client.query('COMMIT'); await client.query(clearScope); guard();
          return { entries, observedAt: clock.toISOString(), expires: start + Math.min(...entries.map(e => Date.parse(e.useUntil) - clock.getTime()), 30000) };
        } catch { broken = true; if (client) try { await client.query('ROLLBACK'); await client.query(clearScope); } catch {} throw unavailable(); }
        finally { client?.release(broken); }
      };
      const work = Promise.resolve().then(async () => {
        const first = await read();
        for (const entry of first.entries) { await current(); if (await deps.authorizeEntry(freeze({ configuration: config, entry })) !== undefined) throw unavailable(); await current(); }
        const final = await read();
        if (final.observedAt < first.observedAt || hash(first.entries) !== hash(final.entries) || performance.now() >= Math.min(first.expires, final.expires)) throw unavailable();
        await authorize(); guard(); if (performance.now() >= Math.min(first.expires, final.expires)) throw unavailable();
        const entries = final.entries.slice(0, 20), last = entries.at(-1);
        return freeze(intentDraftDiscoveryOutputSchema.parse({ ...input, kind: 'steer-draft-discovery/v1', observedAt: final.observedAt, entries,
          nextCursor: final.entries.length > 20 && last ? { createdAt: last.createdAt, draftId: last.draftId } : null,
          scope: 'current-owner-records-configuration', contentLoaded: false, executionAuthorized: false, savedToGit: false, gateSigned: false }));
      });
      void work.finally(() => { active--; }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); }
    },
    close() { closed = true; },
  } satisfies IntentDraftDiscoveryReader & { close(): void };
}
