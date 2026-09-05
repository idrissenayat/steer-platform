import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RepositoryReader } from '@steer/adapters/github';
import { createWorkerProjectionRuntime } from '../src/runtime.ts';
const scope = { organizationId: 'synthetic', repository: 'github:1', itemId: 'intent/0001' };
const database = { host: '127.0.0.1', port: 5432, database: 'synthetic', transport: { kind: 'isolated-loopback-test' } };
const secret = { databasePassword: 'synthetic-unused-password' };
let reads = 0;
const reader: RepositoryReader = { binding: { organizationId: 'synthetic', repositoryId: 1, installationId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' },
  readHead: async () => { reads++; throw new Error('Must not contact provider'); }, readArtifact: async () => { throw new Error(); }, readInventory: async () => { throw new Error(); } };

test('worker runtime requires exact source scope and safe database/selector configuration', async () => {
  for (const options of [{ scope: { ...scope, organizationId: 'other' }, database, selector: { paths: ['BRIEF.md'] } },
    { scope: { ...scope, repository: 'github:2' }, database, selector: { paths: ['BRIEF.md'] } },
    { scope, database: { ...database, user: 'postgres' }, selector: { paths: ['BRIEF.md'] } },
    { scope, database, selector: { paths: ['BRIEF.md', 'BRIEF.md'] } }]) {
    await assert.rejects(createWorkerProjectionRuntime(options, secret, { reader, authenticate: async () => null }), /configuration could not be initialized/);
  }
  assert.equal(reads, 0);
});
test('worker runtime is lazy, refuses unauthorized work, and confirms owned resource closure', async () => {
  const runtime = await createWorkerProjectionRuntime({ scope, database, selector: { paths: ['BRIEF.md'] } }, secret, { reader, authenticate: async () => null });
  assert.equal(runtime.status().database.connections, 0); assert.equal(reads, 0);
  await assert.rejects(runtime.activities.reconcile(scope), /^Error: Reconciliation did not complete\.$/);
  const stop = runtime.shutdown(); assert.equal(stop, runtime.shutdown()); await stop;
  assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().active, false);
  await assert.rejects(runtime.activities.reconcile(scope)); assert.equal(reads, 0);
});
