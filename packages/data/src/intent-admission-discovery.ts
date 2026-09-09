import { z } from 'zod';
import type { PoolClient } from 'pg';
import { intentAdmissionInputSchema, intentAdmissionOutputSchema, intentAdmissionEntrySchema,
  type IntentAdmissionDiscovery, type IntentAdmissionInput, type IntentAdmissionEntry } from '@steer/tool-registry/intent-admission-discovery-contracts';
import { draftRecordsConfigurationSchema, draftRevisionMetadataSchema } from './draft-revisions.ts';
import { scopeReviewConfigurationSchema, scopeReviewManifestSchema } from './scope-review-operations.ts';
import { intentOperationConfigurationSchema } from './intent-operations.ts';
import { scopeOriginalMetadataSchema } from './scope-review-originals.ts';
import { developmentOriginalMetadataSchema } from './development-originals.ts';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from './development-original-contracts.ts';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';

const execution = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('scope'), configuration: scopeReviewConfigurationSchema }),
  z.strictObject({ kind: z.literal('development'), configuration: intentOperationConfigurationSchema.refine(c => c.action === 'develop') })]);
export const admissionDiscoveryConfigurationSchema = z.strictObject({ records: draftRecordsConfigurationSchema, executions: z.array(execution).min(1).max(16) });
const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase()), digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const operationBinding = z.strictObject({ draftId: uuid, draftRevision: z.number().int().min(1).max(1000), inputDigest: digest, configurationDigest: digest });
const clear = "SELECT set_config('steer.execution_organization','',false),set_config('steer.execution_subject','',false),set_config('steer.execution_product','',false),set_config('steer.draft_organization','',false),set_config('steer.draft_subject','',false),set_config('steer.draft_product','',false)";
const fail = () => new Error('Preparation diagnostics are unavailable. No missing-input or retry conclusion was established.');
type Configuration = z.infer<typeof admissionDiscoveryConfigurationSchema>;
type Admission = { kind: 'scope' | 'development'; id: string; inputDigest: string; revision: number; configurationDigest: string; expiresAt: string; scopeInputDigest: string | null };

/** Keyless, uninstalled diagnostics. The explicit execution bindings define the
 * limited inventory, NOT execution/spending authority. Two separate restricted
 * pools perform read-only snapshots; no cross-role grant or cross-pool transaction.
 * Missing metadata is only a sampled observation, never proof of no dispatch.
 * Present metadata does not verify ciphertext, keys, model results or recovery. */
export function createIntentAdmissionDiscovery(pools: { execution: DatabasePool; drafts: DatabasePool }, rawConfiguration: unknown, deps: {
  authorize(context: Readonly<{ configuration: Configuration; input: IntentAdmissionInput }>): Promise<void>;
  authorizeEntry(context: Readonly<{ configuration: Configuration['executions'][number]; input: IntentAdmissionInput; entry: IntentAdmissionEntry }>): Promise<void>;
}) {
  const parsed = admissionDiscoveryConfigurationSchema.parse(rawConfiguration);
  const config = freeze({ ...parsed, executions: [...parsed.executions].sort((a, b) => hash(a).localeCompare(hash(b))) });
  const { records } = config, recordsDigest = hash(records), bindingSetDigest = hash(config);
  const configurations = new Map(config.executions.map(v => [hash(v.configuration), v]));
  if (configurations.size !== config.executions.length || typeof deps.authorize !== 'function' || typeof deps.authorizeEntry !== 'function'
    || config.executions.some(v => (['organizationId', 'subject', 'productId', 'repository', 'branch', 'recordsPolicyDigest'] as const).some(k => v.configuration[k] !== records[k]))) throw fail();
  const scope = freeze({ organizationId: records.organizationId, subject: records.subject, productId: records.productId, repository: records.repository });
  let closed = false, active = 0;
  return { scope,
    async discover(raw, revalidate) {
      const input = freeze(intentAdmissionInputSchema.parse(raw));
      if (closed || active >= 4 || typeof revalidate !== 'function' || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])
        || (input.cursor && input.cursor.bindingSetDigest !== bindingSetDigest)) throw fail();
      active++; let finished = false, settled = false, pending = 0, released = false, timer: ReturnType<typeof setTimeout> | undefined;
      const release = () => { if (settled && !pending && !released) { released = true; active--; } };
      const guard = () => { if (closed || finished) throw fail(); };
      const tracked = async <T>(work: Promise<T>) => { pending++; try { return await work; } finally { pending--; release(); } };
      const current = async () => { guard(); if (await tracked(Promise.resolve().then(revalidate)) !== undefined) throw fail(); guard(); };
      const authorize = async () => { await current(); if (await tracked(Promise.resolve().then(() => deps.authorize(freeze({ configuration: config, input })))) !== undefined) throw fail(); await current(); };
      const transaction = async <T>(kind: 'execution' | 'drafts', work: (client: PoolClient) => Promise<T>): Promise<T> => {
        guard(); let client: PoolClient | undefined, broken = false;
        try {
          client = await tracked(pools[kind].connect()); guard(); await applyRuntimeQueryLimits(client); await client.query(clear);
          await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
          const role = (await client.query(`SELECT r.rolname,session_user AS login_role,r.rolsuper,r.rolbypassrls,
            EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname IN ('steer_execution','steer_usage','steer_drafts') AND c.relowner=r.oid) AS owns_objects
            FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
          const expected = kind === 'execution' ? 'steer_app' : 'steer_draft_runtime';
          if (!role || role.rolname !== expected || role.login_role !== expected || role.rolsuper || role.rolbypassrls || role.owns_objects) throw fail();
          await client.query("SELECT set_config('steer.execution_organization',$1,true),set_config('steer.execution_subject',$2,true),set_config('steer.execution_product',$3,true),set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)",
            [scope.organizationId, scope.subject, scope.productId]);
          const result = await work(client); guard(); await client.query('COMMIT'); await client.query(clear); guard(); return result;
        } catch { broken = true; if (client) try { await client.query('ROLLBACK'); await client.query(clear); } catch {} throw fail(); }
        finally { client?.release(broken); }
      };
      const read = async () => {
        await authorize();
        const admissions = await transaction('execution', async c => {
          const digests = (kind: 'scope' | 'development') => [...configurations].filter(([, value]) => value.kind === kind).map(([key]) => key);
          const rows = (await c.query(`WITH admissions AS (
            SELECT 0 AS kind_rank,review_id AS run_id,preparation_digest AS input_digest,draft_revision,configuration_digest,
              manifest AS record,expires_at,created_at,NULL::text AS configuration_revision
              FROM steer_execution.scope_review_runs WHERE organization_id=$1 AND subject=$2 AND product_id=$3 AND draft_id=$4 AND configuration_digest=ANY($5::text[])
            UNION ALL
            SELECT 1 AS kind_rank,operation_id AS run_id,binding->>'inputDigest' AS input_digest,draft_revision,binding->>'configurationDigest' AS configuration_digest,
              binding AS record,expires_at,created_at,configuration_revision
              FROM steer_execution.intent_operations WHERE organization_id=$1 AND subject=$2 AND draft_id=$4 AND action='develop' AND binding->>'configurationDigest'=ANY($6::text[])
          ) SELECT * FROM admissions WHERE ($7::integer IS NULL OR (draft_revision,kind_rank,run_id)<($7::integer,$8::integer,$9::uuid))
            ORDER BY draft_revision DESC,kind_rank DESC,run_id DESC LIMIT 11`,
          [scope.organizationId, scope.subject, scope.productId, input.draftId, digests('scope'), digests('development'), input.cursor?.revision ?? null,
            input.cursor ? Number(input.cursor.kind === 'development') : null, input.cursor?.runId ?? null])).rows;
          return rows.map(row => {
            const selected = configurations.get(row.configuration_digest);
            if (!selected || Number(selected.kind === 'development') !== row.kind_rank || row.expires_at.getTime() !== Date.parse(selected.configuration.expiresAt)
              || row.created_at.getTime() >= row.expires_at.getTime() || row.expires_at.getTime() - row.created_at.getTime() > 86400000) throw fail();
            const result: Admission = { kind: selected.kind, id: uuid.parse(row.run_id), inputDigest: digest.parse(row.input_digest), revision: Number(row.draft_revision),
              configurationDigest: row.configuration_digest, expiresAt: row.expires_at.toISOString(), scopeInputDigest: null };
            if (selected.kind === 'scope') {
              const manifest = scopeReviewManifestSchema.parse(row.record);
              if (manifest.organizationId !== scope.organizationId || manifest.productId !== scope.productId || manifest.repository !== scope.repository
                || manifest.draftId !== input.draftId || manifest.draftRevision !== result.revision || manifest.preparationDigest !== result.inputDigest
                || manifest.profileDigest !== selected.configuration.scopeTerms.profileDigest) throw fail();
              result.scopeInputDigest = manifest.scopeInputDigest;
            } else {
              const binding = operationBinding.parse(row.record);
              if (binding.draftId !== input.draftId || binding.draftRevision !== result.revision || binding.inputDigest !== result.inputDigest
                || binding.configurationDigest !== result.configurationDigest || row.configuration_revision !== selected.configuration.configurationRevision) throw fail();
            }
            return result;
          });
        });
        await current();
        return transaction('drafts', async c => {
          const started = performance.now(), clock = (await c.query("SELECT date_trunc('milliseconds',clock_timestamp()) AS clock")).rows[0].clock as Date;
          const lifecycle = (await c.query(`SELECT created_at,use_until FROM steer_drafts.draft_lifecycles
            WHERE organization_id=$1 AND subject=$2 AND product_id=$3 AND draft_id=$4 AND configuration_digest=$5
              AND NOT held AND discarded_at IS NULL AND published_at IS NULL AND created_at<=$6 AND use_until>$6`,
          [scope.organizationId, scope.subject, scope.productId, input.draftId, recordsDigest, clock])).rows[0];
          if (!lifecycle) throw fail();
          const columns = 'revision,revision_digest,record,mutation_id,command_digest';
          const latestRow = (await c.query(`SELECT ${columns} FROM steer_drafts.draft_revisions WHERE organization_id=$1 AND draft_id=$2 ORDER BY revision DESC LIMIT 1`, [scope.organizationId, input.draftId])).rows[0];
          const source = (row: any) => {
            if (!row) throw fail(); const m = draftRevisionMetadataSchema.parse(row.record);
            if (m.organizationId !== scope.organizationId || m.subject !== scope.subject || m.productId !== scope.productId || m.draftId !== input.draftId
              || m.configurationDigest !== recordsDigest || m.draftCreatedAt !== lifecycle.created_at.toISOString() || m.revision !== Number(row.revision)
              || m.mutationId !== row.mutation_id || m.commandDigest !== row.command_digest || m.parentRevision !== m.revision - 1
              || (m.parentRevision === 0) !== (m.parentDigest === null) || hash(['steer-draft-revision/v1', m]) !== row.revision_digest) throw fail();
            return { revision: m.revision, revisionDigest: row.revision_digest as string, scopeInputDigest: m.scopeInputDigest };
          };
          const latest = source(latestRow); if (input.cursor && input.cursor.latestRevisionDigest !== latest.revisionDigest) throw fail();
          const sources = new Map((await c.query(`SELECT ${columns} FROM steer_drafts.draft_revisions WHERE organization_id=$1 AND draft_id=$2 AND revision=ANY($3::integer[])`,
            [scope.organizationId, input.draftId, admissions.map(a => a.revision)])).rows.map(row => [Number(row.revision), source(row)]));
          const rows = (await c.query(`SELECT 0 AS kind_rank,review_id AS run_id,preparation_digest AS input_digest,payload_digest,draft_id,draft_revision,record
            FROM steer_drafts.scope_review_originals WHERE organization_id=$1 AND subject=$2 AND product_id=$3 AND review_id=ANY($4::uuid[])
            UNION ALL SELECT 1 AS kind_rank,operation_id AS run_id,input_digest,NULL::text AS payload_digest,draft_id,draft_revision,record
            FROM steer_drafts.development_originals WHERE organization_id=$1 AND subject=$2 AND product_id=$3 AND operation_id=ANY($5::uuid[])`,
          [scope.organizationId, scope.subject, scope.productId, admissions.filter(a => a.kind === 'scope').map(a => a.id), admissions.filter(a => a.kind === 'development').map(a => a.id)])).rows;
          const entries = admissions.map(a => {
            const s = sources.get(a.revision); if (!s || s.revision > latest.revision || (a.scopeInputDigest && a.scopeInputDigest !== s.scopeInputDigest)) throw fail();
            const matching = rows.filter(row => row.kind_rank === Number(a.kind === 'development') && row.run_id === a.id);
            if (matching.length > 1) throw fail(); const row = matching[0];
            if (row) {
              const m = a.kind === 'scope' ? scopeOriginalMetadataSchema.parse(row.record) : developmentOriginalMetadataSchema.parse(row.record);
              if (m.organizationId !== scope.organizationId || m.subject !== scope.subject || m.productId !== scope.productId || m.draftId !== input.draftId
                || m.draftRevision !== a.revision || m.draftRevisionDigest !== s.revisionDigest || m.scopeInputDigest !== s.scopeInputDigest || m.configurationDigest !== recordsDigest
                || m.executionConfigurationDigest !== a.configurationDigest || row.input_digest !== a.inputDigest || row.draft_id !== input.draftId || Number(row.draft_revision) !== a.revision) throw fail();
              if ('reviewId' in m ? (m.reviewId !== a.id || m.preparationDigest !== a.inputDigest || m.payloadDigest !== row.payload_digest) : (m.operationId !== a.id || m.inputDigest !== a.inputDigest)) throw fail();
            }
            return intentAdmissionEntrySchema.parse({ kind: a.kind, source: s, ...(a.kind === 'scope' ? { reviewId: a.id, preparationDigest: a.inputDigest } : { operationId: a.id, inputDigest: a.inputDigest }),
              originalRecord: row ? 'present-metadata' : 'not-observed', executionExpired: Date.parse(a.expiresAt) <= clock.getTime() });
          });
          return { admissions, latest, entries, observedAt: clock.toISOString(), useUntil: lifecycle.use_until.toISOString(), expiry: started + Math.min(30000, lifecycle.use_until.getTime() - clock.getTime()) };
        });
      };
      const work = Promise.resolve().then(async () => {
        const first = await read();
        for (let index = 0; index < first.entries.length; index++) {
          await current(); if (await tracked(Promise.resolve().then(() => deps.authorizeEntry(freeze({ configuration: configurations.get(first.admissions[index]!.configurationDigest)!, input, entry: first.entries[index]! })))) !== undefined) throw fail(); await current();
        }
        const final = await read();
        if (final.observedAt < first.observedAt || hash([first.admissions, first.latest, first.entries, first.useUntil]) !== hash([final.admissions, final.latest, final.entries, final.useUntil])) throw fail();
        await current(); guard(); if (performance.now() >= Math.min(first.expiry, final.expiry)) throw fail();
        const entries = final.entries.slice(0, 10), last = entries.at(-1);
        return freeze(intentAdmissionOutputSchema.parse({ ...input, kind: 'steer-admission-discovery/v1', bindingSetDigest, configuredExecutionCount: config.executions.length,
          observedAt: final.observedAt, useUntil: final.useUntil, latest: final.latest, entries, nextCursor: final.entries.length > 10 && last ? {
            revision: last.source.revision, kind: last.kind, runId: last.kind === 'scope' ? last.reviewId : last.operationId, latestRevisionDigest: final.latest.revisionDigest, bindingSetDigest } : null,
          coverage: 'configured-scope-and-development-bindings-only', originalContentVerified: false, executionState: 'not-inspected',
          retryAuthorized: false, executionAuthorized: false, savedToGit: false, gateSigned: false }));
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(fail()), 30000); })]); }
      catch { throw fail(); }
      finally { finished = true; if (timer) clearTimeout(timer); }
    },
    close() { closed = true; },
  } satisfies IntentAdmissionDiscovery & { close(): void };
}
