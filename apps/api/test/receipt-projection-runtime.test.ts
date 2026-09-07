import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordedBriefProjectionRuntime } from '../src/runtime.ts';
import type { ArtifactReader } from '@steer/adapters/github';

const profile = { version: 'steer-recorded-brief-projection-runtime/v1',
  scope: { organizationId: 'org', repository: 'github:1', branch: 'main', paths: ['items/0160-fixture/BRIEF.md'] },
  database: { host: '127.0.0.1', port: 5432, database: 'synthetic', transport: { kind: 'isolated-loopback-test' } } };
const secrets = { databasePassword: 'synthetic-unused-password' };
const principal = { subject: 'projector', organizationId: 'org', type: 'agent', hats: [], toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 600000).toISOString() };
function fixture() {
  let sourceCalls = 0, receiptCalls = 0;
  const reader: ArtifactReader = { binding: { organizationId: 'org', repositoryId: 1, installationId: 1, owner: 'fixture', repository: 'fixture', branch: 'main' },
    readHead: async () => { sourceCalls++; throw new Error('Private source detail'); },
    readArtifact: async () => { sourceCalls++; throw new Error('Private source detail'); } };
  return { reader, authenticate: async (): Promise<unknown> => principal,
    readReceipt: async (): Promise<unknown> => { receiptCalls++; throw new Error('Private receipt detail'); },
    counts: () => ({ sourceCalls, receiptCalls }) };
}
test('recorded runtime is lazy and closes only its owned pool without receipt/source access', async () => {
  const f = fixture(), runtime = await createRecordedBriefProjectionRuntime(profile, secrets, f);
  assert.deepEqual(f.counts(), { sourceCalls: 0, receiptCalls: 0 }); assert.equal(runtime.status().database.connections, 0);
  assert.equal(runtime.status().database.closed, false);
  const closed = runtime.shutdown(); assert.equal(closed, runtime.shutdown()); await closed;
  assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().database.active, 0);
  await assert.rejects(runtime.runOnce(), /^Error: Recorded Brief projection did not complete\.$/);
  assert.deepEqual(f.counts(), { sourceCalls: 0, receiptCalls: 0 });
});
test('configuration rejects foreign scope, extra options and unsafe database transport without calling dependencies', async () => {
  const f = fixture();
  for (const value of [{ ...profile, scope: { ...profile.scope, organizationId: 'foreign' } },
    { ...profile, scope: { ...profile.scope, repository: 'github:2' } }, { ...profile, scope: { ...profile.scope, branch: 'other' } },
    { ...profile, scope: { ...profile.scope, paths: ['../BRIEF.md'] } }, { ...profile, scheduler: true },
    { ...profile, database: { ...profile.database, host: 'remote.example' } },
    { ...profile, database: { ...profile.database, user: 'postgres' } }]) {
    await assert.rejects(createRecordedBriefProjectionRuntime(value, secrets, f), /^Error: Recorded Brief projection configuration could not be initialized\.$/);
  }
  await assert.rejects(createRecordedBriefProjectionRuntime(profile, { ...secrets, providerKey: 'not-accepted' }, f));
  assert.deepEqual(f.counts(), { sourceCalls: 0, receiptCalls: 0 });
});
test('invalid projectors and receipt failure are sanitized before any SQL connection or source read', async () => {
  for (const identity of [null, { ...principal, type: 'human' }, { ...principal, toolGrants: [] }, { ...principal, organizationId: 'foreign' }]) {
    const f = fixture(); f.authenticate = async () => identity;
    const runtime = await createRecordedBriefProjectionRuntime(profile, secrets, f);
    await assert.rejects(runtime.runOnce(), /^Error: Recorded Brief projection did not complete\.$/);
    assert.deepEqual(f.counts(), { sourceCalls: 0, receiptCalls: 0 }); assert.equal(runtime.status().database.connections, 0); await runtime.shutdown();
  }
  const f = fixture(), runtime = await createRecordedBriefProjectionRuntime(profile, secrets, f);
  await assert.rejects(runtime.runOnce(), /^Error: Recorded Brief projection did not complete\.$/);
  assert.deepEqual(f.counts(), { sourceCalls: 0, receiptCalls: 1 }); assert.equal(runtime.status().database.connections, 0); await runtime.shutdown();
});
test('owned runtime drains admitted readback before pool shutdown and refuses overlap or reopening', async () => {
  const f = fixture(); let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  f.readReceipt = async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); throw new Error('Private late receipt'); };
  const runtime = await createRecordedBriefProjectionRuntime(profile, secrets, f), run = runtime.runOnce();
  const rejected = assert.rejects(run, /^Error: Recorded Brief projection did not complete\.$/);
  await started; await assert.rejects(runtime.runOnce()); const closed = runtime.shutdown();
  assert.equal(closed, runtime.shutdown()); await Promise.resolve(); assert.equal(runtime.status().active, true);
  assert.equal(runtime.status().database.closed, false); release(); await rejected; await closed;
  assert.equal(runtime.status().active, false); assert.equal(runtime.status().database.closed, true); await assert.rejects(runtime.runOnce());
});
