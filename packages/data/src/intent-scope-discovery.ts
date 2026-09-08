import type { PoolClient } from 'pg';
import { intentScopeDiscoveryInputSchema, intentScopeDiscoveryOutputSchema,
  type IntentScopeDiscoveryReader, type IntentScopeDiscoveryInput, type IntentScopeDiscoveryEntry } from '@steer/tool-registry/intent-scope-discovery-contracts';
import { draftRecordsConfigurationSchema, draftRevisionMetadataSchema } from './draft-revisions.ts';
import { scopeOriginalMetadataSchema } from './scope-review-originals.ts';
import { scopeOriginalHash as hash, freezeScopeOriginal as freeze } from './scope-original-contracts.ts';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';

const unavailable = () => new Error('Scope review discovery is unavailable.');
const clearScope = "SELECT set_config('steer.draft_organization','',false),set_config('steer.draft_subject','',false),set_config('steer.draft_product','',false)";
/** Keyless, read-only pointers for the exact latest draft, never findings or an
 * execution grant. UUID order is stable, NOT newest-first. Different retained
 * corpus/profile versions may appear; only the authorized content reader can
 * establish their provenance and the editor must check the current corpus. */
export function createIntentScopeDiscovery(pool: DatabasePool, rawConfiguration: unknown, deps: {
  authorize(context: Readonly<{ configuration: ReturnType<typeof draftRecordsConfigurationSchema.parse>; input: IntentScopeDiscoveryInput }>): Promise<void>;
  authorizeEntry(context: Readonly<{ configuration: ReturnType<typeof draftRecordsConfigurationSchema.parse>; input: IntentScopeDiscoveryInput; entry: IntentScopeDiscoveryEntry }>): Promise<void>;
}) {
  const config = freeze(draftRecordsConfigurationSchema.parse(rawConfiguration)), configurationDigest = hash(config);
  if (typeof deps.authorize !== 'function' || typeof deps.authorizeEntry !== 'function') throw unavailable();
  const { organizationId, subject, productId, repository } = config, scope = freeze({ organizationId, subject, productId, repository });
  let closed = false, active = 0;
  return {
    scope,
    async discover(raw, revalidate) {
      const input = freeze(intentScopeDiscoveryInputSchema.parse(raw));
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
          const m = draftRevisionMetadataSchema.parse(row.record);
          if (m.organizationId !== organizationId || m.subject !== subject || m.productId !== productId || m.draftId !== input.draftId
            || m.revision !== Number(row.revision) || m.revision !== input.revision || m.configurationDigest !== configurationDigest
            || m.draftCreatedAt !== row.created_at.toISOString() || m.mutationId !== row.mutation_id || m.commandDigest !== row.command_digest
            || m.parentRevision !== m.revision - 1 || (m.parentRevision === 0) !== (m.parentDigest === null)
            || hash(['steer-draft-revision/v1', m]) !== row.revision_digest || row.revision_digest !== input.revisionDigest || m.scopeInputDigest !== input.scopeInputDigest) throw unavailable();
          const rows = (await client.query(`SELECT review_id,preparation_digest,payload_digest,draft_id,draft_revision,record
            FROM steer_drafts.scope_review_originals WHERE organization_id=$1 AND subject=$2 AND product_id=$3 AND draft_id=$4 AND draft_revision=$5
              AND record->>'configurationDigest'=$6 AND record->>'draftRevisionDigest'=$7 AND record->>'scopeInputDigest'=$8
              AND ($9::uuid IS NULL OR review_id<$9::uuid) ORDER BY review_id DESC LIMIT 21`,
          [organizationId, subject, productId, input.draftId, input.revision, configurationDigest, input.revisionDigest, input.scopeInputDigest, input.cursor])).rows;
          const entries = rows.map(r => {
            const meta = scopeOriginalMetadataSchema.parse(r.record);
            if (meta.organizationId !== organizationId || meta.subject !== subject || meta.productId !== productId || meta.reviewId !== r.review_id
              || meta.preparationDigest !== r.preparation_digest || meta.payloadDigest !== r.payload_digest || meta.draftId !== input.draftId || meta.draftId !== r.draft_id
              || meta.draftRevision !== input.revision || meta.draftRevision !== Number(r.draft_revision) || meta.draftRevisionDigest !== input.revisionDigest
              || meta.scopeInputDigest !== input.scopeInputDigest || meta.configurationDigest !== configurationDigest) throw unavailable();
            return { reviewId: meta.reviewId, preparationDigest: meta.preparationDigest };
          });
          await client.query('COMMIT'); await client.query(clearScope); guard();
          return { entries, observedAt: clock.toISOString(), useUntil: row.use_until.toISOString(), expires: start + Math.min(row.use_until.getTime() - clock.getTime(), 30000) };
        } catch { broken = true; if (client) try { await client.query('ROLLBACK'); await client.query(clearScope); } catch {} throw unavailable(); }
        finally { client?.release(broken); }
      };
      const work = Promise.resolve().then(async () => {
        const first = await read();
        for (const entry of first.entries) { await current(); if (await deps.authorizeEntry(freeze({ configuration: config, input, entry })) !== undefined) throw unavailable(); await current(); }
        const final = await read();
        if (final.observedAt < first.observedAt || first.useUntil !== final.useUntil || hash(first.entries) !== hash(final.entries)) throw unavailable();
        // Both metadata authorizations precede the final SQL snapshot. Do not run
        // a source-authority callback after that snapshot and then release stale
        // rows if the callback observed or caused a lifecycle/source change.
        await current(); guard(); if (performance.now() >= Math.min(first.expires, final.expires)) throw unavailable();
        const entries = final.entries.slice(0, 20);
        return freeze(intentScopeDiscoveryOutputSchema.parse({ ...input, kind: 'steer-scope-discovery/v1', observedAt: final.observedAt, useUntil: final.useUntil,
          entries, nextCursor: final.entries.length > 20 ? entries.at(-1)!.reviewId : null,
          scope: 'current-owner-configuration-exact-latest-draft', order: 'review-id-descending-not-chronological',
          contentLoaded: false, executionAuthorized: false, savedToGit: false, gateSigned: false }));
      });
      void work.finally(() => { active--; }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); }
    },
    close() { closed = true; },
  } satisfies IntentScopeDiscoveryReader & { close(): void };
}
