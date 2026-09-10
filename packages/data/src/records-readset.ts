import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';
import { developmentRecordsConfigurationSchema } from './development-originals.ts';

const uuid = z.uuid().refine(value => value === value.toLowerCase());
const resolvedTargetSchema = z.strictObject({ draftId: uuid, operationIds: z.array(uuid).max(8),
  reviewIds: z.array(uuid).max(8), revisions: z.array(z.number().int().min(1).max(1000)).min(1).max(16), budgetId: uuid });
const targetSchema = resolvedTargetSchema.extend({ operationIds: z.array(uuid).min(1).max(8), reviewIds: z.array(uuid).min(1).max(8) });
const scopeTargetSchema = z.strictObject({ kind: z.literal('scope-review'), mode: z.enum(['current', 'history', 'original']), reviewId: uuid,
  preparationDigest: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/) });
const developmentTargetSchema = z.strictObject({ kind: z.literal('development-history'), operationId: uuid,
  inputDigest: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/) });
type Configuration = z.infer<typeof developmentRecordsConfigurationSchema>;
export type RecordsReadSetTarget = z.infer<typeof resolvedTargetSchema>;
type Row = Readonly<Record<string, unknown>>;
const draftGroups = [
  { name: 'revisions', table: 'draft_revisions', filter: 'r.draft_id=q.draft AND r.revision=ANY(q.revisions)', order: 'r.revision', max: 16, identity: ['revision'] },
  { name: 'latest_revision', table: 'draft_revisions', filter: 'r.draft_id=q.draft', order: 'r.revision DESC', max: 1, identity: ['revision'] },
  { name: 'scope_originals', table: 'scope_review_originals', filter: 'r.review_id=ANY(q.reviews) AND r.draft_id=q.draft', order: 'r.review_id', max: 8, identity: ['review_id'] },
  { name: 'scope_observations', table: 'scope_review_observations', filter: 'r.review_id=ANY(q.reviews) AND r.draft_id=q.draft', order: 'r.review_id,r.batch_id,r.stage', max: 128, identity: ['review_id', 'batch_id', 'stage'] },
  { name: 'development_originals', table: 'development_originals', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id', max: 8, identity: ['operation_id'] },
  { name: 'development_results', table: 'development_results', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id,r.step_id', max: 16, identity: ['operation_id', 'step_id'] },
  { name: 'development_observations', table: 'development_observations', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id,r.step_id,r.stage', max: 32, identity: ['operation_id', 'step_id', 'stage'] },
  { name: 'candidate_originals', table: 'candidate_originals', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id', max: 8, identity: ['operation_id'] },
] as const;
const executionGroups = [
  { name: 'operations', schema: 'steer_execution', table: 'intent_operations', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id', max: 8, identity: ['operation_id'] },
  { name: 'steps', schema: 'steer_execution', table: 'intent_steps', filter: 'r.operation_id=ANY(q.ops)', order: 'r.operation_id,r.step_id', max: 24, identity: ['operation_id', 'step_id'] },
  { name: 'scope_runs', schema: 'steer_execution', table: 'scope_review_runs', filter: 'r.review_id=ANY(q.reviews) AND r.draft_id=q.draft', order: 'r.review_id', max: 8, identity: ['review_id'] },
  { name: 'scope_batches', schema: 'steer_execution', table: 'scope_review_batches', filter: 'r.review_id=ANY(q.reviews)', order: 'r.review_id,r.batch_id', max: 64, identity: ['review_id', 'batch_id'] },
  { name: 'reservations', schema: 'steer_usage', table: 'model_reservations', filter: 'r.budget_id=q.budget AND (r.operation_id=ANY(q.ops) OR r.operation_id=ANY(q.reviews))', order: 'r.reservation_id', max: 96, identity: ['reservation_id'] },
  { name: 'budget', schema: 'steer_usage', table: 'model_budgets', filter: 'r.budget_id=q.budget', order: 'r.budget_id', max: 1, identity: ['budget_id'] },
  { name: 'scope_terms', schema: 'steer_usage', table: 'scope_review_terms', filter: 'r.budget_id=q.budget', order: 'r.budget_id', max: 1, identity: ['budget_id'] },
] as const;
type Group = (typeof draftGroups)[number] | (typeof executionGroups)[number];
export type RecordsReadSetGroup = Group['name'];
type Data = Readonly<Record<RecordsReadSetGroup, readonly Row[]>>;
type Context = Readonly<{ configuration: Configuration; target: RecordsReadSetTarget }>;
export type RecordsReadSetAuthority = {
  /** Separate present grant for metadata-only scope target discovery. No stored
   * execution approval or configuration string can supply this revision. The
   * trusted records resolver binds the retained budget ID, which must match the
   * decoded original; it is not a new budget or a spending permission. */
  authorizeScopeDiscovery?(context: Readonly<{ configuration: Configuration; request: z.infer<typeof scopeTargetSchema> }>): Promise<{ permissionsRevision: string; budgetId: string }>;
  authorizeDevelopmentDiscovery?(context: Readonly<{ configuration: Configuration; request: z.infer<typeof developmentTargetSchema> }>): Promise<{ permissionsRevision: string; budgetId: string }>;
  /** Present metadata-enumeration grant. Revision covers every independent records grant. */
  authorize(context: Context): Promise<{ permissionsRevision: string }>;
  records: { [G in RecordsReadSetGroup]: (context: Context & Readonly<{ group: G; metadata: Row }>) => Promise<void> };
};
export type RecordsReadSetSnapshot = Readonly<{ target: RecordsReadSetTarget; data: Data; lifecycle: Row; digest: string;
  keys: readonly Readonly<{ draftId: string; keyId: string; records: readonly string[] }>[]; plaintextVerified: false }>;
export type RecordsReadSetLease = Readonly<{ snapshot: RecordsReadSetSnapshot; check(): void; recheck(): Promise<void>; hasExpired(expiresAt: string): boolean }>;
const groups: readonly Group[] = [...draftGroups, ...executionGroups];
const fail = () => new Error('The complete records read set could not be verified.');
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
function rowValue(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(); return value as Row;
}
const databaseClock = (raw: unknown) => {
  if (typeof raw !== 'number' && !(typeof raw === 'string' && /^(0|[1-9][0-9]*)(?![\s\S])/.test(raw))) throw fail();
  const value = Number(raw); if (!Number.isSafeInteger(value) || value < 0) throw fail(); return value;
};
const milliseconds = (raw: unknown) => {
  const value = raw instanceof Date ? raw.getTime() : typeof raw === 'string' ? Date.parse(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < 0) throw fail(); return value;
};
const originalGroups = new Set<RecordsReadSetGroup>(['revisions', 'latest_revision', 'scope_originals', 'scope_runs', 'budget', 'scope_terms']);
const queryFor = (selectedGroups: readonly Group[], metadata: boolean, expiredScope = false, originalOnly = false) => `WITH requested AS
  (SELECT $1::text AS org,$2::uuid AS draft,$3::uuid[] AS ops,$4::uuid[] AS reviews,$5::int[] AS revisions,$6::uuid AS budget)
  SELECT jsonb_build_object(${selectedGroups.map(g => `'${g.name}',(SELECT COALESCE(jsonb_agg(to_jsonb(selected)${metadata ? " - 'encrypted_value'" : ''}),'[]'::jsonb)
    FROM (SELECT ${g.name === 'latest_revision' ? 'r.organization_id,r.subject,r.product_id,r.revision' : 'r.*'}
      FROM ${'schema' in g ? g.schema : 'steer_drafts'}.${g.table} r,requested q
      WHERE r.organization_id=q.org AND ${g.filter}${originalOnly && !originalGroups.has(g.name) ? ' AND FALSE /* scope original only */' : expiredScope && ['scope_observations', 'scope_batches', 'reservations'].includes(g.name) ? ' AND FALSE /* expired current scope */' : ''}
      ORDER BY ${g.order} LIMIT ${g.max + (g.name === 'latest_revision' ? 0 : 1)}) selected)`).join(',')}) AS data,
    floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms`;
const clear = (role: 'drafts' | 'execution') => `SELECT ${
  (role === 'drafts' ? ['draft_organization', 'draft_subject', 'draft_product']
    : ['execution_organization', 'execution_subject', 'execution_product', 'usage_organization', 'usage_subject', 'usage_budget'])
    .map(name => `set_config('steer.${name}','',false)`).join(',')}`;
const metadataOf = (data: Data): Data => {
  const result: Partial<Record<RecordsReadSetGroup, readonly Row[]>> = {};
  for (const group of groups) result[group.name] = data[group.name].map(({ encrypted_value: _ciphertext, ...metadata }) => metadata);
  return result as Data;
};

/** Internal read-only owner. The trusted verifier must perform independent key,
 * crypto, SDK and source checks, then await recheck inside final source closure.
 * No untrusted callback, effect, cached permission or factory activation here. */
export function createRecordsReadSetReader(pools: { drafts: DatabasePool; execution: DatabasePool }, rawConfiguration: unknown,
  authority: RecordsReadSetAuthority, options: { monotonicNow?: () => number } = {}) {
  const configuration = freeze(developmentRecordsConfigurationSchema.parse(rawConfiguration)), configurationDigest = hash(configuration);
  const clock = options.monotonicNow ?? (() => performance.now()), lifetime = new AbortController(), pending = new Set<Promise<unknown>>();
  const connections = { drafts: pools.drafts.connect, execution: pools.execution.connect }, boundPools = { ...pools };
  const authorize = authority.authorize, discover = authority.authorizeScopeDiscovery, discoverDevelopment = authority.authorizeDevelopmentDiscovery,
    records = authority.records, policies = { ...records };
  if (typeof authorize !== 'function' || groups.some(g => typeof policies[g.name] !== 'function')
    || Object.keys(records).length !== groups.length || Object.values(connections).some(p => typeof p !== 'function')) throw fail();
  const pinned = () => {
    if (lifetime.signal.aborted || authority.authorize !== authorize || authority.authorizeScopeDiscovery !== discover || authority.records !== records
      || authority.authorizeDevelopmentDiscovery !== discoverDevelopment
      || groups.some(g => records[g.name] !== policies[g.name]) || Object.keys(records).length !== groups.length
      || (['drafts', 'execution'] as const).some(role => pools[role] !== boundPools[role] || pools[role].connect !== connections[role])) throw fail();
  };
  async function withReadSet<T>(rawTarget: unknown, current: () => Promise<void>, use: (lease: RecordsReadSetLease) => Promise<T>, externalSignal?: AbortSignal,
    observeWork?: (work: Promise<unknown>) => void) {
    pinned(); const requested = freeze(z.union([targetSchema, scopeTargetSchema, developmentTargetSchema]).parse(rawTarget));
    const discoveryRequest = 'kind' in requested ? requested : undefined;
    const scopeRequest = discoveryRequest?.kind === 'scope-review' ? discoveryRequest : undefined;
    const originalOnly = scopeRequest?.mode === 'original';
    const developmentRequest = discoveryRequest?.kind === 'development-history' ? discoveryRequest : undefined;
    let target: RecordsReadSetTarget = discoveryRequest ? undefined! : requested as RecordsReadSetTarget;
    let context: Context = discoveryRequest ? undefined! : freeze({ configuration, target });
    if (pending.size >= 4 || typeof current !== 'function' || typeof use !== 'function'
      || (discoveryRequest ? typeof (scopeRequest ? discover : discoverDevelopment) !== 'function'
        : [target.operationIds, target.reviewIds, target.revisions].some(values => new Set<string | number>(values).size !== values.length))) throw fail();
    const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(30000), ...(externalSignal ? [externalSignal] : [])]);
    const metrics = { statements: 0, roleTransactions: 0, callerChecks: 0, metadataGrants: 0, recordPolicyChecks: 0 };
    let finished = false, invalid = false, lastClock = -Infinity, lastDatabaseClock = -Infinity, deadline = Infinity;
    let permissionsRevision: string | undefined, discoveryRevision: string | undefined, discoveryBudget: string | undefined, discoveredRun: Row | undefined;
    let expiredScope = false;
    let databaseObservedAt = Infinity, rechecking: Promise<void> | undefined, rechecked = false, using = false;
    const monotonic = () => { const now = clock(); if (!Number.isFinite(now) || now < 0 || now < lastClock) throw fail(); lastClock = now; return now; };
    const guard = () => {
      try { pinned(); signal.throwIfAborted(); if (invalid || finished || monotonic() >= deadline) throw fail(); }
      catch { invalid = true; throw fail(); }
    };
    const observeDatabase = (raw: unknown, started = monotonic()) => {
      const now = databaseClock(raw); if (now < lastDatabaseClock) throw fail(); lastDatabaseClock = now; databaseObservedAt = started; return now;
    };
    const discoveryGrant = async () => {
      if (!discoveryRequest) return;
      guard(); const grant = z.strictObject({ permissionsRevision: z.string().min(1).max(256), budgetId: uuid }).parse(
        await Reflect.apply((scopeRequest ? discover : discoverDevelopment)!, authority, [freeze({ configuration, request: discoveryRequest })]));
      guard(); if (discoveryRevision !== undefined && (grant.permissionsRevision !== discoveryRevision || grant.budgetId !== discoveryBudget)) throw fail();
      discoveryRevision = grant.permissionsRevision; discoveryBudget = grant.budgetId;
    };
    const fresh = async () => {
      guard(); metrics.callerChecks++; if (await current() !== undefined) throw fail(); guard(); metrics.metadataGrants++;
      await discoveryGrant();
      const grant = z.strictObject({ permissionsRevision: z.string().min(1).max(256) }).parse(await Reflect.apply(authorize, authority, [context]));
      guard(); if (permissionsRevision !== undefined && grant.permissionsRevision !== permissionsRevision) throw fail(); permissionsRevision = grant.permissionsRevision;
    };
    const grantRecords = async (data: Data) => {
      for (const g of groups) for (const metadata of data[g.name]) {
        guard(); metrics.recordPolicyChecks++;
        if (await Reflect.apply(policies[g.name], records, [freeze({ ...context, group: g.name, metadata })]) !== undefined) throw fail(); guard();
      }
    };
    const read = async (metadata: boolean) => {
      const data: Partial<Record<RecordsReadSetGroup, readonly Row[]>> = {}; let lifecycle: Row | undefined;
      for (const role of ['drafts', 'execution'] as const) {
        await fresh(); let client: PoolClient | undefined, broken = false;
        try {
          client = await Reflect.apply(connections[role], boundPools[role], []); guard(); metrics.roleTransactions++;
          const query = async (sql: string, args?: unknown[]) => { guard(); metrics.statements++; const result = await client!.query(sql, args); guard(); return result; };
          await applyRuntimeQueryLimits({ query } as PoolClient); await query(clear(role)); await query('BEGIN ISOLATION LEVEL READ COMMITTED');
          const expected = role === 'drafts' ? 'steer_draft_runtime' : 'steer_app';
          const actor = (await query(`SELECT r.rolname,session_user AS login_role,r.rolsuper,r.rolbypassrls,
            EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname=ANY($1::text[]) AND c.relowner=r.oid) AS owns_objects FROM pg_roles r WHERE r.rolname=current_user`,
          [role === 'drafts' ? ['steer_drafts'] : ['steer_execution', 'steer_usage']])).rows[0];
          if (!actor || actor.rolname !== expected || actor.login_role !== expected || actor.rolsuper !== false || actor.rolbypassrls !== false || actor.owns_objects !== false) throw fail();
          if (role === 'drafts') {
            await query("SELECT set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)", [configuration.organizationId, configuration.subject, configuration.productId]);
            const started = monotonic(), result = await query(`SELECT *,floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms
              FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND draft_id=$2 FOR UPDATE`, [configuration.organizationId, target.draftId]);
            if (result.rows.length !== 1) throw fail(); const row = rowValue(result.rows[0]);
            if (row.organization_id !== configuration.organizationId || row.draft_id !== target.draftId || row.subject !== configuration.subject
              || row.product_id !== configuration.productId || row.configuration_digest !== configurationDigest || row.held !== false) throw fail();
            const observed = observeDatabase(row.clock_ms, started), expiry = milliseconds(row.use_until);
            if (milliseconds(row.created_at) > observed || expiry <= observed) throw fail();
            deadline = Math.min(deadline, started + expiry - observed); const { clock_ms: _clock, ...header } = row;
            lifecycle = JSON.parse(JSON.stringify(header)) as Row;
          } else await query("SELECT set_config('steer.execution_organization',$1,true),set_config('steer.execution_subject',$2,true),set_config('steer.execution_product',$3,true),set_config('steer.usage_organization',$1,true),set_config('steer.usage_subject',$2,true),set_config('steer.usage_budget',$4,true)", [configuration.organizationId, configuration.subject, configuration.productId, target.budgetId]);
          const selectedGroups = role === 'drafts' ? draftGroups : executionGroups, started = monotonic();
          const result = await query(queryFor(selectedGroups, metadata, expiredScope, originalOnly), [configuration.organizationId, target.draftId, target.operationIds, target.reviewIds, target.revisions, target.budgetId]);
          if (result.rows.length !== 1) throw fail(); const aggregate = rowValue(result.rows[0]), value = rowValue(aggregate.data);
          if (Buffer.byteLength(JSON.stringify(value)) > 16 * 1024 * 1024 || Object.keys(value).length !== selectedGroups.length) throw fail();
          const observed = observeDatabase(aggregate.clock_ms, started);
          for (const g of selectedGroups) {
            const rawRows = value[g.name]; if (!Array.isArray(rawRows) || rawRows.length > g.max) throw fail();
            const rows: Row[] = rawRows.map(rowValue), identities = new Set<string>();
            for (const row of rows) {
              const productScoped = role === 'drafts' || g.name === 'scope_runs' || g.name === 'scope_batches';
              if (row.organization_id !== configuration.organizationId || row.subject !== configuration.subject
                || (productScoped ? row.product_id !== configuration.productId : row.product_id !== undefined && row.product_id !== configuration.productId)
                || ('draft_id' in row && row.draft_id !== target.draftId) || ('review_id' in row && !target.reviewIds.includes(row.review_id as string))
                || ('operation_id' in row && !(g.name === 'reservations' ? [...target.operationIds, ...target.reviewIds] : target.operationIds).includes(row.operation_id as string))
                || (g.name === 'steps' ? row.budget_id !== (row.step_id === 'candidate-save' ? null : target.budgetId)
                  : 'budget_id' in row && row.budget_id !== target.budgetId) || (metadata && 'encrypted_value' in row)) throw fail();
              const parts = g.identity.map(field => row[field]);
              if (parts.some(part => typeof part !== 'string' && typeof part !== 'number') || identities.has(hash(parts))) throw fail(); identities.add(hash(parts));
              if (g.name !== 'latest_revision' && g.filter.includes('r.draft_id=') && row.draft_id !== target.draftId) throw fail();
              if (role === 'drafts' && g.name !== 'latest_revision' && !metadata && !row.encrypted_value) throw fail();
            }
            data[g.name] = rows;
            if (originalOnly && !originalGroups.has(g.name) && rows.length) throw fail();
            if (expiredScope && ['scope_observations', 'scope_batches', 'reservations'].includes(g.name) && rows.length) throw fail();
          }
          if (role === 'drafts') for (const row of data.candidate_originals!) {
            const expiry = milliseconds(row.use_until);
            if (row.held !== false || milliseconds(row.draft_created_at) > observed || expiry <= observed
              || expiry > milliseconds(row.retention_deadline) || row.configuration_digest !== configurationDigest) throw fail();
            deadline = Math.min(deadline, started + expiry - observed);
          }
          await query('COMMIT'); await query(clear(role));
        } catch { broken = true; if (client) try { await client.query('ROLLBACK'); await client.query(clear(role)); } catch {} throw fail(); }
        finally { client?.release(broken); }
        await fresh();
      }
      const complete = data as Data;
      if (!lifecycle || complete.revisions.length !== target.revisions.length || complete.revisions.some(row => !target.revisions.includes(row.revision as number))
        || complete.latest_revision.length !== 1 || !Number.isInteger(complete.latest_revision[0]!.revision)
        || Number(complete.latest_revision[0]!.revision) < Math.max(...target.revisions)
        || complete.operations.length !== target.operationIds.length || complete.scope_runs.length !== target.reviewIds.length
        || complete.scope_originals.length !== target.reviewIds.length || complete.budget.length !== 1
        || (target.reviewIds.length > 0 && complete.scope_terms.length !== 1)
        || Buffer.byteLength(JSON.stringify(complete)) > 16 * 1024 * 1024) throw fail();
      guard(); return freeze({ data: complete, lifecycle });
    };
    const work = Promise.resolve().then(async () => {
      try {
        deadline = monotonic() + 30000; guard();
        if (discoveryRequest) {
          // The run table has no ciphertext. Discover only this exact reference
          // under the execution role; never invent a development operation ID.
          metrics.callerChecks++; if (await current() !== undefined) throw fail(); guard(); await discoveryGrant();
          let client: PoolClient | undefined, broken = false;
          try {
            client = await Reflect.apply(connections.execution, boundPools.execution, []); guard(); metrics.roleTransactions++;
            const query = async (sql: string, args?: unknown[]) => { guard(); metrics.statements++; const result = await client!.query(sql, args); guard(); return result; };
            await applyRuntimeQueryLimits({ query } as PoolClient); await query(clear('execution')); await query('BEGIN ISOLATION LEVEL READ COMMITTED');
            const actor = (await query(`SELECT r.rolname,session_user AS login_role,r.rolsuper,r.rolbypassrls,
              EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname=ANY($1::text[]) AND c.relowner=r.oid) AS owns_objects FROM pg_roles r WHERE r.rolname=current_user`,
            [['steer_execution', 'steer_usage']])).rows[0];
            if (!actor || actor.rolname !== 'steer_app' || actor.login_role !== 'steer_app'
              || actor.rolsuper !== false || actor.rolbypassrls !== false || actor.owns_objects !== false) throw fail();
            await query("SELECT set_config('steer.execution_organization',$1,true),set_config('steer.execution_subject',$2,true),set_config('steer.execution_product',$3,true)",
              [configuration.organizationId, configuration.subject, configuration.productId]);
            const started = monotonic(), result = await query(scopeRequest ? `SELECT to_jsonb(r) AS metadata,
              floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms FROM steer_execution.scope_review_runs r
              WHERE r.organization_id=$1 AND r.review_id=$2 AND r.preparation_digest=$3 LIMIT 2`
              : `SELECT to_jsonb(r) AS metadata,floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms
                FROM steer_execution.intent_operations r WHERE r.organization_id=$1 AND r.operation_id=$2
                AND r.binding->>'inputDigest'=$3 AND r.action='develop' LIMIT 2`,
              [configuration.organizationId, scopeRequest?.reviewId ?? developmentRequest!.operationId,
                scopeRequest?.preparationDigest ?? developmentRequest!.inputDigest]);
            if (result.rows.length !== 1) throw fail(); discoveredRun = freeze(rowValue(result.rows[0].metadata));
            if (Buffer.byteLength(JSON.stringify(discoveredRun)) > 65536 || 'encrypted_value' in discoveredRun
              || discoveredRun.organization_id !== configuration.organizationId || discoveredRun.subject !== configuration.subject
              || (scopeRequest ? discoveredRun.product_id !== configuration.productId || discoveredRun.review_id !== scopeRequest.reviewId
                || discoveredRun.preparation_digest !== scopeRequest.preparationDigest
                : discoveredRun.operation_id !== developmentRequest!.operationId || discoveredRun.action !== 'develop'
                  || rowValue(discoveredRun.binding).inputDigest !== developmentRequest!.inputDigest)) throw fail();
            const observed = observeDatabase(result.rows[0].clock_ms, started), expiry = milliseconds(discoveredRun.expires_at);
            if (scopeRequest && scopeRequest.mode !== 'history') {
              if (originalOnly && expiry <= observed) throw fail();
              expiredScope = expiry <= observed;
              if (!expiredScope) deadline = Math.min(deadline, started + expiry - observed);
            }
            target = freeze(resolvedTargetSchema.parse({ draftId: discoveredRun.draft_id,
              operationIds: developmentRequest ? [developmentRequest.operationId] : [], reviewIds: scopeRequest ? [scopeRequest.reviewId] : [],
              revisions: [discoveredRun.draft_revision], budgetId: discoveryBudget }));
            context = freeze({ configuration, target });
            await query('COMMIT'); await query(clear('execution'));
          } catch { broken = true; if (client) try { await client.query('ROLLBACK'); await client.query(clear('execution')); } catch {} throw fail(); }
          finally { client?.release(broken); }
        }
        const metadata = await read(true);
        if (discoveredRun && hash(scopeRequest ? metadata.data.scope_runs : metadata.data.operations) !== hash([discoveredRun])) throw fail();
        await grantRecords(metadata.data);
        const first = await read(false);
        if (hash({ data: metadataOf(first.data), lifecycle: first.lifecycle }) !== hash(metadata)) throw fail();
        const keyRefs = new Map<string, { draftId: string; keyId: string; records: string[] }>();
        for (const g of draftGroups.filter(g => g.name !== 'latest_revision')) for (const [i, row] of first.data[g.name].entries()) {
          const envelope = rowValue(row.encrypted_value), chunks = envelope.chunks ?? [envelope];
          if (!Array.isArray(chunks) || !chunks.length || chunks.length > 1024) throw fail();
          for (const chunk of chunks) {
            const keyId = rowValue(chunk).keyId; if (typeof keyId !== 'string' || !/^[A-Za-z0-9_-]{1,100}(?![\s\S])/.test(keyId)) throw fail();
            const id = JSON.stringify([target.draftId, keyId]), ref = keyRefs.get(id) ?? { draftId: target.draftId, keyId, records: [] };
            const member = `${g.name}:${i}`; if (!ref.records.includes(member)) ref.records.push(member); keyRefs.set(id, ref);
          }
        }
        const snapshot: RecordsReadSetSnapshot = freeze({ ...first, target, digest: hash(first), keys: [...keyRefs.values()], plaintextVerified: false });
        const recheck = () => {
          try { guard(); if (!using || rechecking) throw fail(); }
          catch { invalid = true; return Promise.reject(fail()); }
          rechecking = Promise.resolve().then(async () => {
            await grantRecords(metadata.data); const last = await read(false);
            if (hash(last) !== snapshot.digest) throw fail(); guard(); rechecked = true;
          }).catch(() => { invalid = true; throw fail(); });
          // The owner drains this child even when a trusted verifier forgets to await it.
          void rechecking.catch(() => {}); return rechecking;
        };
        const hasExpired = (expiresAt: string) => {
          guard(); if (!Number.isFinite(lastDatabaseClock) || !Number.isFinite(databaseObservedAt)) throw fail();
          return lastDatabaseClock + monotonic() - databaseObservedAt >= milliseconds(expiresAt);
        };
        using = true; const value = await use(freeze({ snapshot, check: guard, recheck, hasExpired })); using = false;
        if (!rechecked || invalid) throw fail(); await fresh(); guard(); return { value, metrics: freeze({ ...metrics }) };
      } finally { using = false; await rechecking?.catch(() => {}); }
    });
    pending.add(work); void work.finally(() => pending.delete(work)).catch(() => {});
    observeWork?.(work);
    let abort = () => {};
    try {
      return await Promise.race([work, new Promise<never>((_, reject) => {
        abort = () => reject(fail()); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
      })]);
    } catch { throw fail(); }
    finally { finished = true; signal.removeEventListener('abort', abort); }
  }
  return { withReadSet<T>(target: unknown, current: () => Promise<void>, use: (lease: RecordsReadSetLease) => Promise<T>, signal?: AbortSignal) {
      return withReadSet(target, current, use, signal);
    },
    startReadSet<T>(target: unknown, current: () => Promise<void>, use: (lease: RecordsReadSetLease) => Promise<T>, signal?: AbortSignal) {
      let drained = Promise.resolve();
      const result = withReadSet(target, current, use, signal, work => { drained = work.then(() => {}, () => {}); });
      return { result, drained };
    },
    close() { lifetime.abort(); }, async shutdown() { lifetime.abort(); await Promise.allSettled([...pending]); } };
}
