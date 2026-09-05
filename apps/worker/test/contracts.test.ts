import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReconciliationActivities } from '../src/activities.ts';
import { parsePlan, parseReceipt, parseScope, workflowId } from '../src/contracts.ts';
const scope = { organizationId: 'org-a', repository: 'github:1', itemId: 'intent/0001' };
const plan = { scope, rounds: 2, intervalMs: 1000 };

test('workflow identity is deterministic, bounded and distinct across tenant/repository/item and delimiter collisions', () => {
  assert.equal(workflowId(scope), workflowId({ ...scope }));
  for (const changed of [{ ...scope, organizationId: 'org-b' }, { ...scope, repository: 'github:2' }, { ...scope, itemId: 'intent/0002' }]) assert.notEqual(workflowId(scope), workflowId(changed));
  assert.notEqual(workflowId({ ...scope, repository: 'a/b', itemId: 'c' }), workflowId({ ...scope, repository: 'a', itemId: 'b/c' }));
  assert.ok(workflowId({ organizationId: 'a' + '/'.repeat(63), repository: 'a' + '/'.repeat(95), itemId: 'a' + '/'.repeat(95) }).length < 1000);
});
test('plans and receipts reject unexpected fields, secrets, malformed identifiers and unbounded history inputs', () => {
  assert.deepEqual(parsePlan(plan), plan); assert.notEqual(parseScope(scope), scope);
  for (const invalid of [{ ...plan, token: 'private' }, { ...plan, rounds: 0 }, { ...plan, rounds: 101 }, { ...plan, intervalMs: 999 },
    { ...plan, intervalMs: 86400001 }, { ...plan, scope: { ...scope, organizationId: 'a'.repeat(65) } },
    { ...plan, scope: { ...scope, itemId: '<private>' } }, { ...plan, scope: { ...scope, hats: ['admin'] } }]) assert.throws(() => parsePlan(invalid));
  for (const invalid of [{ revision: 'a'.repeat(40), status: 'reconciled', acknowledged: 101 },
    { revision: 'a'.repeat(40), status: 'approved', acknowledged: 1 }, { revision: 'private', status: 'reconciled', acknowledged: 1 },
    { revision: 'a'.repeat(40), status: 'reconciled', acknowledged: 1, content: 'private' }]) assert.throws(() => parseReceipt(invalid));
});
test('fixed activity binding denies all foreign scope before calling its port and strips artifact payloads', async () => {
  let calls = 0;
  const activities = createReconciliationActivities(scope, { runOnce: async () => { calls++; return {
    revision: 'a'.repeat(40), status: 'reconciled', outcomes: [{ path: 'private', content: 'never-in-history' }],
  }; } });
  for (const foreign of [{ ...scope, organizationId: 'other' }, { ...scope, repository: 'github:2' }, { ...scope, itemId: 'intent/2' }]) await assert.rejects(activities.reconcile(foreign));
  assert.equal(calls, 0);
  assert.deepEqual(await activities.reconcile(scope), { revision: 'a'.repeat(40), status: 'reconciled', acknowledged: 1 }); assert.equal(calls, 1);
});
test('activity failures are sanitized and actual overlap stays refused until the port settles', async () => {
  let finish: () => void = () => {};
  const activities = createReconciliationActivities(scope, { runOnce: async () => {
    await new Promise<void>((resolve) => { finish = resolve; }); throw new Error('private provider token');
  } });
  const pending = activities.reconcile(scope); await assert.rejects(activities.reconcile(scope), /already active/);
  finish(); await assert.rejects(pending, /^Error: Reconciliation did not complete\.$/);
});
