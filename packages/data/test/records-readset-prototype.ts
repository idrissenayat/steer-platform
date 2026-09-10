import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { applyRuntimeQueryLimits, type DatabasePool } from '../src/runtime-pool.ts';
import { developmentRecordsConfigurationSchema } from '../src/development-originals.ts';

// TEST ONLY: bounded storage/topology experiment, not an installed history reader.
// It returns encrypted rows to its test caller, never an HTTP/application result.
const uuid = z.uuid(), fail = () => new Error('Synthetic records read set unavailable.');
const lifetimes = new WeakMap<object, { deadline: number; last: number; clock: () => number; invalid: boolean }>();
const databaseClock = (raw: unknown) => {
  if (typeof raw !== 'number' && !(typeof raw === 'string' && /^(0|[1-9][0-9]*)$/.test(raw))) throw fail();
  const value = Number(raw); if (!Number.isSafeInteger(value) || value < 0) throw fail(); return value;
};
const milliseconds = (value: Date | string) => {
  const time = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isSafeInteger(time) || time < 0) throw fail(); return time;
};
/** Test-only elapsed validity, not current hold/grant authority. The initial
 * snapshot keeps its own deadline; a reread can shorten but cannot extend it. */
export function assertRecordsReadsetsUsable(...snapshots: object[]) {
  if (!snapshots.length || snapshots.length > 2) throw fail();
  for (const snapshot of snapshots) {
    const proof = lifetimes.get(snapshot); if (!proof || proof.invalid) throw fail();
    try {
      const now = proof.clock();
      if (!Number.isFinite(now) || now < proof.last || now >= proof.deadline) throw fail();
      proof.last = now;
    } catch { proof.invalid = true; throw fail(); }
  }
}
const targetsSchema = z.strictObject({ draftId: uuid, operationIds: z.array(uuid).min(1).max(8),
  reviewIds: z.array(uuid).min(1).max(8), revisions: z.array(z.number().int().min(1).max(1000)).min(1).max(16), budgetId: uuid });
type Target = z.infer<typeof targetsSchema>;
type Group = { name: string; schema: string; table: string; filter: string; order: string; max: number };
const draftGroups: Group[] = [
  { name: 'revisions', schema: 'steer_drafts', table: 'draft_revisions', filter: 'r.draft_id=q.draft AND r.revision=ANY(q.revisions)', order: 'r.revision', max: 16 },
  { name: 'latest_revision', schema: 'steer_drafts', table: 'draft_revisions', filter: 'r.draft_id=q.draft', order: 'r.revision DESC', max: 1 },
  { name: 'scope_originals', schema: 'steer_drafts', table: 'scope_review_originals', filter: 'r.review_id=ANY(q.reviews) AND r.draft_id=q.draft', order: 'r.review_id', max: 8 },
  { name: 'scope_observations', schema: 'steer_drafts', table: 'scope_review_observations', filter: 'r.review_id=ANY(q.reviews) AND r.draft_id=q.draft', order: 'r.review_id,r.batch_id,r.stage', max: 128 },
  { name: 'development_originals', schema: 'steer_drafts', table: 'development_originals', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id', max: 8 },
  { name: 'development_results', schema: 'steer_drafts', table: 'development_results', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id,r.step_id', max: 16 },
  { name: 'development_observations', schema: 'steer_drafts', table: 'development_observations', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id,r.step_id,r.stage', max: 32 },
  { name: 'candidate_originals', schema: 'steer_drafts', table: 'candidate_originals', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id', max: 8 },
];
const executionGroups: Group[] = [
  { name: 'operations', schema: 'steer_execution', table: 'intent_operations', filter: 'r.operation_id=ANY(q.ops) AND r.draft_id=q.draft', order: 'r.operation_id', max: 8 },
  { name: 'steps', schema: 'steer_execution', table: 'intent_steps', filter: 'r.operation_id=ANY(q.ops)', order: 'r.operation_id,r.step_id', max: 24 },
  { name: 'scope_runs', schema: 'steer_execution', table: 'scope_review_runs', filter: 'r.review_id=ANY(q.reviews) AND r.draft_id=q.draft', order: 'r.review_id', max: 8 },
  { name: 'scope_batches', schema: 'steer_execution', table: 'scope_review_batches', filter: 'r.review_id=ANY(q.reviews)', order: 'r.review_id,r.batch_id', max: 64 },
  { name: 'reservations', schema: 'steer_usage', table: 'model_reservations', filter: 'r.budget_id=q.budget AND (r.operation_id=ANY(q.ops) OR r.operation_id=ANY(q.reviews))', order: 'r.reservation_id', max: 96 },
  { name: 'budget', schema: 'steer_usage', table: 'model_budgets', filter: 'r.budget_id=q.budget', order: 'r.budget_id', max: 1 },
  { name: 'scope_terms', schema: 'steer_usage', table: 'scope_review_terms', filter: 'r.budget_id=q.budget', order: 'r.budget_id', max: 1 },
];
export const recordsReadsetGroups = [...draftGroups, ...executionGroups].map(({ name, max }) => Object.freeze({ name, max }));
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const queryFor = (groups: Group[]) => `WITH requested AS (SELECT $1::text AS org,$2::uuid AS draft,$3::uuid[] AS ops,
  $4::uuid[] AS reviews,$5::int[] AS revisions,$6::uuid AS budget)
  SELECT jsonb_build_object(${groups.map(g => `'${g.name}',(SELECT COALESCE(jsonb_agg(to_jsonb(selected)),'[]'::jsonb)
    FROM (SELECT ${g.name === 'latest_revision' ? 'r.organization_id,r.subject,r.product_id,r.revision' : 'r.*'} FROM ${g.schema}.${g.table} r,requested q WHERE r.organization_id=q.org AND ${g.filter}
      ORDER BY ${g.order} LIMIT ${g.max + (g.name === 'latest_revision' ? 0 : 1)}) selected)`).join(',')}) AS data,
      floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms`;
const clear = (role: 'drafts' | 'execution') => `SELECT ${
  (role === 'drafts' ? ['draft_organization', 'draft_subject', 'draft_product']
    : ['execution_organization', 'execution_subject', 'execution_product', 'usage_organization', 'usage_subject', 'usage_budget'])
    .map(name => `set_config('steer.${name}','',false)`).join(',')}`;

export async function readRecordsReadsetPrototype(pools: { drafts: DatabasePool; execution: DatabasePool }, configuration: unknown,
  rawTarget: unknown, current: () => Promise<void>, signal: AbortSignal = new AbortController().signal,
  clock: () => number = () => performance.now()) {
  const config = Object.freeze(developmentRecordsConfigurationSchema.parse(configuration)), target = targetsSchema.parse(rawTarget);
  if (!config.organizationId.startsWith('authenticated-generation-')) throw fail();
  for (const values of [target.operationIds, target.reviewIds, target.revisions]) if (new Set<string | number>(values).size !== values.length) throw fail();
  const configDigest = hash(config), pinned = [pools.drafts, pools.execution, pools.drafts.connect, pools.execution.connect];
  const metrics = { statements: 0, roleTransactions: 0, callerChecks: 0 };
  let lastClock = -Infinity, lastDatabaseClock = -Infinity;
  const observeDatabaseClock = (raw: unknown) => { const now = databaseClock(raw);
    if (now < lastDatabaseClock) throw fail(); lastDatabaseClock = now; return now; };
  const monotonic = () => { const now = clock(); if (!Number.isFinite(now) || now < 0 || now < lastClock) throw fail(); lastClock = now; return now; };
  const guard = () => { signal.throwIfAborted(); if (monotonic() >= monotonicUseDeadline) throw fail();
    if ([pools.drafts, pools.execution, pools.drafts.connect, pools.execution.connect].some((p, i) => p !== pinned[i])) throw fail(); };
  const fresh = async () => { guard(); metrics.callerChecks++; if (await current() !== undefined) throw fail(); guard(); };
  const values = [config.organizationId, target.draftId, target.operationIds, target.reviewIds, target.revisions, target.budgetId];
  const data: Record<string, any[]> = {};
  let lifecycle: any, monotonicUseDeadline = Infinity;
  for (const role of ['drafts', 'execution'] as const) {
    await fresh(); let client: PoolClient | undefined, broken = false, phase = 'connect';
    try {
      client = await pools[role].connect(); guard(); metrics.roleTransactions++;
      const query = async (sql: string, args?: unknown[]) => { guard(); metrics.statements++;
        phase = sql.startsWith('WITH requested') ? 'aggregate' : sql.includes('FROM pg_roles') ? 'role'
          : sql.includes('FROM steer_drafts.draft_lifecycles') ? 'lifecycle' : 'transaction'; return client!.query(sql, args); };
      await applyRuntimeQueryLimits({ query } as PoolClient); await query(clear(role)); await query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const schemas = role === 'drafts' ? ['steer_drafts'] : ['steer_execution', 'steer_usage'];
      const expectedRole = role === 'drafts' ? 'steer_draft_runtime' : 'steer_app';
      const actor = (await query(`SELECT r.rolname,session_user AS login_role,r.rolsuper,r.rolbypassrls,
        EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=ANY($1::text[]) AND c.relowner=r.oid) AS owns_objects FROM pg_roles r WHERE r.rolname=current_user`, [schemas])).rows[0];
      if (!actor || actor.rolname !== expectedRole || actor.login_role !== expectedRole || actor.rolsuper || actor.rolbypassrls || actor.owns_objects) throw fail();
      if (role === 'drafts') {
        await query("SELECT set_config('steer.draft_organization',$1,true),set_config('steer.draft_subject',$2,true),set_config('steer.draft_product',$3,true)", [config.organizationId, config.subject, config.productId]);
        const started = monotonic();
        const row = (await query(`SELECT *,floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS clock_ms
          FROM steer_drafts.draft_lifecycles WHERE organization_id=$1 AND draft_id=$2 FOR UPDATE`, [config.organizationId, target.draftId])).rows[0];
        if (!row || row.subject !== config.subject || row.product_id !== config.productId || row.configuration_digest !== configDigest
          || row.held !== false) throw fail();
        const observed = observeDatabaseClock(row.clock_ms), expiry = milliseconds(row.use_until);
        if (milliseconds(row.created_at) > observed || expiry <= observed) throw fail();
        const { clock_ms, ...header } = row; lifecycle = JSON.parse(JSON.stringify(header));
        monotonicUseDeadline = started + expiry - observed;
      } else await query("SELECT set_config('steer.execution_organization',$1,true),set_config('steer.execution_subject',$2,true),set_config('steer.execution_product',$3,true),set_config('steer.usage_organization',$1,true),set_config('steer.usage_subject',$2,true),set_config('steer.usage_budget',$4,true)", [config.organizationId, config.subject, config.productId, target.budgetId]);
      const groups = role === 'drafts' ? draftGroups : executionGroups;
      const readStarted = monotonic(), aggregate = (await query(queryFor(groups), values)).rows[0], value = aggregate?.data;
      if (!value || Buffer.byteLength(JSON.stringify(value)) > 16 * 1024 * 1024) throw fail();
      const observed = observeDatabaseClock(aggregate.clock_ms);
      for (const group of groups) {
        const rows = value[group.name]; if (!Array.isArray(rows) || rows.length > group.max) throw fail();
        for (const row of rows) if (row.organization_id !== config.organizationId || row.subject !== config.subject
          || (row.product_id !== undefined && row.product_id !== config.productId)) throw fail();
        data[group.name] = rows;
      }
      if (role === 'drafts') for (const row of data.candidate_originals!) {
        const expiry = milliseconds(row.use_until);
        if (row.held !== false || milliseconds(row.draft_created_at) > observed
          || expiry <= observed || expiry > milliseconds(row.retention_deadline) || row.configuration_digest !== configDigest) throw fail();
        monotonicUseDeadline = Math.min(monotonicUseDeadline, readStarted + expiry - observed);
      }
      await query('COMMIT'); await query(clear(role)); guard();
    } catch (error) { broken = true; if (client) try { await client.query('ROLLBACK'); await client.query(clear(role)); } catch {}
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : 'denied';
      throw new Error(`Synthetic records read set unavailable: ${role}/${phase}/${code}.`); }
    finally { client?.release(broken); }
    await fresh();
  }
  if (monotonic() >= monotonicUseDeadline || data.revisions!.length !== target.revisions.length
    || data.latest_revision!.length !== 1 || data.operations!.length !== target.operationIds.length || data.scope_runs!.length !== target.reviewIds.length
    || data.scope_originals!.length !== target.reviewIds.length) throw fail();
  const keys = new Map<string, { draftId: string; keyId: string; records: string[] }>();
  for (const [group, rows] of Object.entries(data)) for (const [i, row] of rows.entries()) {
    if (!row.encrypted_value || group === 'latest_revision') continue;
    const envelopes = row.encrypted_value.chunks ?? [row.encrypted_value];
    for (const envelope of envelopes) {
      if (!row.draft_id || typeof envelope.keyId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(envelope.keyId)) throw fail();
      const id = JSON.stringify([row.draft_id, envelope.keyId]), existing = keys.get(id) ?? { draftId: row.draft_id, keyId: envelope.keyId, records: [] as string[] };
      const ref = `${group}:${i}`; if (!existing.records.includes(ref)) existing.records.push(ref); keys.set(id, existing);
    }
  }
  guard();
  const result = { target: target as Target, data, lifecycle, digest: hash({ data, lifecycle }), keys: [...keys.values()], metrics,
    plaintextVerified: false as const, recordsPoliciesVerified: false as const, productionInstalled: false as const };
  lifetimes.set(result, { deadline: monotonicUseDeadline, last: lastClock, clock, invalid: false });
  assertRecordsReadsetsUsable(result); return result;
}
