import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createModelBudgetPermit } from '../src/model-budget.ts';
import type { DatabasePool } from '../src/runtime-pool.ts';

export async function testModelBudget({ admin, app, connect, check }: {
  admin: Pool; app: Pool; connect(user: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  const provision = async (cap = 9, architect = 3, testAgent = 2) => {
    const binding = { organizationId: 'budget-fixture', budgetId: randomUUID(), subject: 'synthetic-human',
      configurationRevision: 'synthetic-budget-v1', approvalDigest: 'a'.repeat(64), capMicrousd: cap, architectMicrousd: architect, testAgentMicrousd: testAgent };
    await admin.query(`INSERT INTO steer_usage.model_budgets VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()-interval '1 minute',now()+interval '1 hour',true)`,
      [binding.organizationId, binding.budgetId, binding.subject, binding.configurationRevision, binding.approvalDigest, cap, architect, testAgent]);
    return binding;
  };
  const request = (b: Awaited<ReturnType<typeof provision>>, role: 'architect' | 'test-agent' = 'architect') =>
    ({ organizationId: b.organizationId, subject: b.subject, configurationRevision: b.configurationRevision, role });
  const used = async (budgetId: string) => Number((await admin.query('SELECT COALESCE(sum(amount_microusd),0) AS used FROM steer_usage.model_reservations WHERE budget_id=$1', [budgetId])).rows[0].used);

  await check('usage tables force RLS; runtime cannot provision, raise, refund or delete a budget', async () => {
    const rows = (await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer_usage' AND c.relkind='r'")).rows;
    assert.equal(rows.length, 3); assert.ok(rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
    assert.equal((await app.query('SELECT * FROM steer_usage.model_budgets')).rowCount, 0);
    assert.equal((await app.query('SELECT * FROM steer_usage.model_reservations')).rowCount, 0);
    for (const sql of ["UPDATE steer_usage.model_budgets SET cap_microusd=100", 'DELETE FROM steer_usage.model_budgets',
      'DELETE FROM steer_usage.model_reservations', 'UPDATE steer_usage.model_reservations SET amount_microusd=1',
      'TRUNCATE steer_usage.model_reservations', 'INSERT INTO steer_usage.model_budgets SELECT * FROM steer_usage.model_budgets']) {
      await assert.rejects(app.query(sql), { code: '42501' });
    }
    for (const role of ['steer_projector', 'steer_auth_runtime']) {
      await assert.rejects(connect(role).query('SELECT * FROM steer_usage.model_budgets'), { code: '42501' });
    }
  });
  await check('parallel independent permits share one durable cap even under contaminated isolation defaults', async () => {
    const b = await provision();
    const pools = Array.from({ length: 8 }, () => connect('steer_app'));
    for (const pool of pools) await pool.query("SET default_transaction_isolation='repeatable read'");
    const results = await Promise.all(pools.map(pool => createModelBudgetPermit(pool, b).reserve(request(b))));
    assert.equal(results.filter(Boolean).length, 3); assert.equal(await used(b.budgetId), 9);
    assert.equal(await createModelBudgetPermit(connect('steer_app'), b).reserve(request(b)), false);
    for (const pool of pools) assert.equal((await pool.query('SELECT * FROM steer_usage.model_reservations')).rowCount, 0);
    await assert.rejects(admin.query("UPDATE steer_usage.model_budgets SET subject='another-human' WHERE budget_id=$1", [b.budgetId]), { code: '23503' });
  });
  await check('role upper bounds consume exact integer amounts without refunds or role substitution', async () => {
    const b = await provision(5), permit = createModelBudgetPermit(app, b);
    assert.equal(await permit.reserve(request(b)), true); assert.equal(await permit.reserve(request(b, 'test-agent')), true);
    assert.equal(await used(b.budgetId), 5); assert.equal(await permit.reserve(request(b, 'test-agent')), false);
  });
  await check('missing, expired, inactive, changed approval/configuration and wrong owner deny reservation', async () => {
    const b = await provision();
    for (const change of [{ budgetId: randomUUID() }, { organizationId: 'other' }, { subject: 'other' },
      { approvalDigest: 'b'.repeat(64) }, { configurationRevision: 'other' }, { capMicrousd: 99 }, { architectMicrousd: 4 }]) {
      const altered = { ...b, ...change };
      assert.equal(await createModelBudgetPermit(app, altered).reserve(request(altered)), false);
    }
    assert.equal(await used(b.budgetId), 0);
    await admin.query('UPDATE steer_usage.model_budgets SET active=false WHERE budget_id=$1', [b.budgetId]);
    assert.equal(await createModelBudgetPermit(app, b).reserve(request(b)), false);
    await admin.query("UPDATE steer_usage.model_budgets SET active=true,valid_after=now()-interval '1 hour',expires_at=now()-interval '1 minute' WHERE budget_id=$1", [b.budgetId]);
    assert.equal(await createModelBudgetPermit(app, b).reserve(request(b)), false);
  });
  await check('lost commit acknowledgement returns no permission but durable reservation survives reconstruction', async () => {
    const b = await provision(3, 3, 2);
    const uncertain: DatabasePool = { async connect() {
      const client = await app.connect();
      return { query: async (sql: string, values?: unknown[]) => {
        const result = await client.query(sql, values);
        if (sql === 'COMMIT') throw new Error('synthetic acknowledgement loss after actual commit');
        return result;
      }, release: (broken: boolean) => client.release(broken) } as PoolClient;
    } };
    assert.equal(await createModelBudgetPermit(uncertain, b).reserve(request(b)), false);
    assert.equal(await used(b.budgetId), 3);
    assert.equal(await createModelBudgetPermit(app, b).reserve(request(b)), false);
  });
}
