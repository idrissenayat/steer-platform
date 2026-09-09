import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createIntentAdmissionDiscovery } from '../src/intent-admission-discovery.ts';
import { admissionDiscoveryFixture } from '../../tool-registry/test/intent-admission-discovery.fixture.ts';

const { input } = admissionDiscoveryFixture();
const records = { organizationId: input.organizationId, productId: input.productId, repository: input.repository,
  subject: 'human', branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
const config = { records, executions: [{ kind: 'scope', configuration: { ...records, expiresAt: new Date(Date.now()+600000).toISOString(),
  budget: { organizationId: records.organizationId, subject: records.subject, configurationRevision: records.configurationRevision, budgetId: '00000000-0000-4000-8000-000000000001', approvalDigest: 'b'.repeat(64), capMicrousd: 30, architectMicrousd: 3, testAgentMicrousd: 2 },
  scopeTerms: { approvalDigest: 'c'.repeat(64), profileDigest: 'd'.repeat(64), amountMicrousd: 4 } } }] };
test('preparation diagnostics require current metadata authority and exact scope before connecting', async () => {
  let connections = 0;
  const pool = { connect: async (): Promise<PoolClient> => { connections++; throw new Error('PRIVATE'); } };
  const service = createIntentAdmissionDiscovery({ execution: pool, drafts: pool }, config, { authorize: async () => { throw new Error('PRIVATE'); }, authorizeEntry: async () => {} });
  for (const raw of [input, { ...input, productId: 'other' }]) await assert.rejects(service.discover(raw, async () => {}), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; });
  assert.equal(connections, 0); service.close(); await assert.rejects(service.discover(input, async () => {}));
});
test('timed-out preparation diagnostics retains admission until dependencies settle and late leases are closed without reading content', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const releases: Array<(client: PoolClient) => void> = [], queries: string[] = []; let closed = 0;
  const pool = { connect: async () => new Promise<PoolClient>(resolve => releases.push(resolve)) };
  const service = createIntentAdmissionDiscovery({ execution: pool, drafts: pool }, config, { authorize: async () => {}, authorizeEntry: async () => {} });
  const requests = Array.from({ length: 4 }, () => assert.rejects(service.discover(input, async () => {})));
  for (let i = 0; i < 25 && releases.length < 4; i++) await Promise.resolve(); assert.equal(releases.length, 4);
  await assert.rejects(service.discover(input, async () => {}));
  t.mock.timers.tick(30001); await Promise.all(requests);
  await assert.rejects(service.discover(input, async () => {})); assert.equal(releases.length, 4);
  const client = { query: async (sql: string) => { queries.push(sql); return { rows: [] }; }, release: () => { closed++; } } as unknown as PoolClient;
  service.close(); releases.forEach(resolve => resolve(client));
  for (let i = 0; i < 25 && closed < 4; i++) await Promise.resolve();
  assert.equal(closed, 4); assert.ok(queries.every(sql => sql === 'ROLLBACK' || sql.startsWith("SELECT set_config('steer.execution_organization'")));
});
