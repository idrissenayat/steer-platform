import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRuntimePool, DatabaseCapacityError } from '../src/runtime-pool.ts';

const configuration = { host: '127.0.0.1', port: 5432, database: 'synthetic',
  user: 'steer_auth_runtime', password: 'synthetic-not-a-real-password', transport: { kind: 'isolated-loopback-test' } };

test('runtime pool rejects unsafe roles, implicit transports and option/DSN overrides without exposing input', async () => {
  for (const input of [{}, { ...configuration, user: 'postgres' }, { ...configuration, transport: undefined },
    { ...configuration, host: 'database.example' }, { ...configuration, max: 10000 },
    { ...configuration, connectionString: 'postgres://secret' }, { ...configuration, options: '-c statement_timeout=0' },
    { ...configuration, transport: { kind: 'tls', ca: '' } }, { ...configuration, port: 0 }]) {
    assert.throws(() => createRuntimePool(input), (cause: unknown) => cause instanceof Error && cause.message === 'Invalid runtime database configuration.');
  }
  const pool = createRuntimePool(configuration);
  assert.deepEqual(pool.status(), { connections: 0, idle: 0, pending: 0, active: 0, idleErrors: 0, activeErrors: 0, forcedReleases: 0, closed: false });
  const ending = pool.end(); assert.equal(pool.end(), ending); await ending;
  await assert.rejects(pool.connect(), DatabaseCapacityError);
  assert.equal(pool.status().closed, true);
  assert.ok(!JSON.stringify(pool.status()).includes(configuration.password));
  const stopping = pool.shutdown(); assert.equal(pool.shutdown(), stopping); await stopping;
});
