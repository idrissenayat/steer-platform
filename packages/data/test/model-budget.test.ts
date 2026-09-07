import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModelBudgetPermit } from '../src/model-budget.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';

const binding = { organizationId: 'org', subject: 'human', budgetId: '00000000-0000-4000-8000-000000000001',
  configurationRevision: 'fixture', approvalDigest: 'a'.repeat(64), capMicrousd: 10, architectMicrousd: 3, testAgentMicrousd: 2 };
const input = { organizationId: 'org', subject: 'human', configurationRevision: 'fixture', role: 'architect' as const };
function fixture(options: { role?: object; fail?: string; reserved?: boolean } = {}) {
  const queries: { sql: string; values: unknown[] | undefined }[] = []; let released: boolean | undefined;
  const client = { query: async (sql: string, values?: unknown[]) => {
    queries.push({ sql, values });
    if (sql === options.fail) throw new Error('private-db-detail');
    if (sql.includes('FROM pg_roles')) return { rows: [options.role ?? { rolname: 'steer_app', login_role: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: false }] };
    if (sql.startsWith('INSERT')) return { rows: options.reserved === false ? [] : [{ reservation_id: values![3] }] };
    return { rows: [] };
  }, release: (broken: boolean) => { released = broken; } };
  const pool = { connect: async () => client } as unknown as DatabasePool;
  return { pool, queries, released: () => released };
}
test('fixed owner/configuration scope, integer limits and invalid input reject before I/O', async () => {
  const f = fixture(), permit = createModelBudgetPermit(f.pool, binding);
  for (const change of [{ subject: 'other' }, { organizationId: 'other' }, { configurationRevision: 'other' }, { role: 'other' }, { approval: true }])
    assert.equal(await permit.reserve({ ...input, ...change } as typeof input), false);
  assert.equal(f.queries.length, 0);
  for (const change of [{ capMicrousd: 1.5 }, { architectMicrousd: 0 }, { capMicrousd: 2 }, { approvalDigest: 'approved' }])
    assert.throws(() => createModelBudgetPermit(f.pool, { ...binding, ...change }));
});
test('serializes budget at explicit read committed isolation and acknowledges only committed inserts', async () => {
  const f = fixture(); assert.equal(await createModelBudgetPermit(f.pool, binding).reserve(input), true);
  assert.ok(f.queries.some(q => q.sql === 'BEGIN ISOLATION LEVEL READ COMMITTED'));
  const lock = f.queries.findIndex(q => q.sql.includes('pg_advisory_xact_lock')), insert = f.queries.findIndex(q => q.sql.startsWith('INSERT'));
  assert.ok(lock > 0 && insert > lock); assert.equal(f.queries[insert]!.values![8], 3);
  assert.match(f.queries[insert]!.sql, /sum\(r.amount_microusd\)/); assert.match(f.queries[insert]!.sql, /< 10000/);
  assert.equal(f.queries.at(-2)!.sql, 'COMMIT'); assert.equal(f.released(), false);
});
test('unavailable or denied budget is false; uncertain commit consumes no model permission and never retries', async () => {
  const denied = fixture({ reserved: false }); assert.equal(await createModelBudgetPermit(denied.pool, binding).reserve(input), false);
  const failed = fixture({ fail: 'COMMIT' }); assert.equal(await createModelBudgetPermit(failed.pool, binding).reserve(input), false);
  assert.equal(failed.queries.filter(q => q.sql.startsWith('INSERT')).length, 1); assert.equal(failed.released(), true);
  assert.equal(await createModelBudgetPermit({ connect: async () => { throw new Error('private'); } }, binding).reserve(input), false);
});
test('unexpected login/owner/superuser roles cannot reserve', async () => {
  for (const change of [{ rolname: 'steer_projector' }, { login_role: 'postgres' }, { rolsuper: true }, { rolbypassrls: true }, { owns_objects: true }]) {
    const f = fixture({ role: { rolname: 'steer_app', login_role: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: false, ...change } });
    assert.equal(await createModelBudgetPermit(f.pool, binding).reserve(input), false); assert.equal(f.queries.some(q => q.sql.startsWith('INSERT')), false);
  }
});
