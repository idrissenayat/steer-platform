import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createIntentRunDiscovery } from '../src/intent-run-discovery.ts';
import { runDiscoveryFixture } from '../../tool-registry/test/intent-run-discovery.fixture.ts';

const { input } = runDiscoveryFixture();
const config = { organizationId: input.organizationId, productId: input.productId, repository: input.repository,
  subject: 'human', branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
test('discovery requires current metadata authority and exact scope before connecting', async () => {
  let connections = 0;
  const pool = { connect: async (): Promise<PoolClient> => { connections++; throw new Error('PRIVATE'); } };
  const service = createIntentRunDiscovery(pool, config, { authorize: async () => { throw new Error('PRIVATE'); }, authorizeEntry: async () => {} });
  for (const raw of [input, { ...input, productId: 'other' }]) await assert.rejects(service.discover(raw, async () => {}), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; });
  assert.equal(connections, 0); service.close(); await assert.rejects(service.discover(input, async () => {}));
});
test('timed-out discovery retains admission until dependencies settle and late leases are closed without reading content', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const releases: Array<(client: PoolClient) => void> = [], queries: string[] = []; let closed = 0;
  const pool = { connect: async () => new Promise<PoolClient>(resolve => releases.push(resolve)) };
  const service = createIntentRunDiscovery(pool, config, { authorize: async () => {}, authorizeEntry: async () => {} });
  const requests = Array.from({ length: 4 }, () => assert.rejects(service.discover(input, async () => {})));
  for (let i = 0; i < 25 && releases.length < 4; i++) await Promise.resolve(); assert.equal(releases.length, 4);
  await assert.rejects(service.discover(input, async () => {}));
  t.mock.timers.tick(30001); await Promise.all(requests);
  await assert.rejects(service.discover(input, async () => {})); assert.equal(releases.length, 4);
  const client = { query: async (sql: string) => { queries.push(sql); return { rows: [] }; }, release: () => { closed++; } } as unknown as PoolClient;
  service.close(); releases.forEach(resolve => resolve(client));
  for (let i = 0; i < 25 && closed < 4; i++) await Promise.resolve();
  assert.equal(closed, 4); assert.ok(queries.every(sql => sql === 'ROLLBACK' || sql.startsWith("SELECT set_config('steer.draft_organization'")));
});
