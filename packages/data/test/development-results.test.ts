import assert from 'node:assert/strict';
import test from 'node:test';
import { createDevelopmentResultStore } from '../src/development-results.ts';
const config = { organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',action:'develop',
  configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64),expiresAt:'2026-09-08T12:00:00.000Z',
  budget:{ organizationId:'org',subject:'human',configurationRevision:'r1',budgetId:'00000000-0000-4000-8000-000000000217',
    approvalDigest:'b'.repeat(64),capMicrousd:5,architectMicrousd:3,testAgentMicrousd:2 } };
const target = { operationId:'00000000-0000-4000-8000-000000000218',stepId:'architect',inputDigest:'c'.repeat(64) };
test('result capture has no construction effects and malformed or denied requests cannot acquire a database connection', async () => {
  let connects=0;
  const pool = { connect:async () => { connects++; throw new Error('private-connection-marker'); } };
  const deps = { authorizeOperation:async () => {},authorizeDraft:async () => {},authorizeResult:async () => { throw new Error('private-denial'); },
    keyForDraft:async () => { throw new Error('must not load keys'); } };
  assert.throws(() => createDevelopmentResultStore({ execution:pool,drafts:pool },{ ...config,action:'candidate-save',budget:null },deps));
  const store = createDevelopmentResultStore({ execution:pool,drafts:pool },config,deps);
  await assert.rejects(store.read({ ...target,source:'private' })); await assert.rejects(store.read(target));
  await assert.rejects(store.readHistorical(target));
  assert.equal(connects,0); store.close(); await assert.rejects(store.read(target)); assert.equal(connects,0);
});
test('timed-out result authorization keeps admission until it drains and never starts a late database operation', async () => {
  let release!: () => void, calls=0,connects=0;
  const held = new Promise<void>(resolve => { release=resolve; });
  const pool = { connect:async () => { connects++; throw new Error('synthetic unavailable'); } };
  const store = createDevelopmentResultStore({ execution:pool,drafts:pool },config,{ authorizeOperation:async () => {},authorizeDraft:async () => {},
    authorizeResult:async () => { calls++; await held; },keyForDraft:async () => { throw new Error('must not load keys'); } });
  await assert.rejects(store.read(target)); await assert.rejects(store.read(target)); assert.equal(calls,1); assert.equal(connects,0);
  release(); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(store.read(target)); assert.equal(calls,2); assert.equal(connects,1); store.close();
});
