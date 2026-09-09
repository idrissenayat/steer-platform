import assert from 'node:assert/strict';
import test from 'node:test';
import { createExpiredDevelopmentStepReader, createHistoricalDevelopmentStepReader } from '../src/intent-operations.ts';
const config={ organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',action:'develop',
  configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64),expiresAt:'2026-09-08T00:00:00.000Z',
  budget:{ organizationId:'org',subject:'human',configurationRevision:'r1',budgetId:'00000000-0000-4000-8000-000000000218',
    approvalDigest:'b'.repeat(64),capMicrousd:5,architectMicrousd:3,testAgentMicrousd:2 } };
const target={ operationId:'00000000-0000-4000-8000-000000000219',inputDigest:'c'.repeat(64),stepId:'architect' };
test('retained step history has a separate inspect-only surface with current authority and strict target validation',async()=>{
  let connections=0,calls=0;const reader=createHistoricalDevelopmentStepReader({connect:async()=>{connections++;throw new Error('Private SQL');}},config,
    {authorize:async()=>{calls++;return true as any;}});
  assert.deepEqual(Object.keys(reader),['inspectHistorical','close']);await assert.rejects(reader.inspectHistorical({...target,stepId:'candidate-save'}));
  assert.equal(calls,0);await assert.rejects(reader.inspectHistorical(target));assert.equal(calls,1);assert.equal(connections,0);reader.close();
});
test('historical metadata has only read/close, requires current authorization and rejects extra fields or candidate-save roles before SQL', async () => {
  let connections=0,authorizations=0;
  const pool={ connect:async () => { connections++; throw new Error('private-history-connection'); } };
  const reader=createExpiredDevelopmentStepReader(pool,config,{ authorize:async () => { authorizations++; throw new Error('private-history-denial'); } });
  assert.deepEqual(Object.keys(reader),['inspectExpired','close']);
  for (const patch of [{ approved:true },{ stepId:'candidate-save' },{ source:'private' },{ inputDigest:'d'.repeat(64)+'\n' }])
    await assert.rejects(reader.inspectExpired({ ...target,...patch }));
  assert.equal(authorizations,0); assert.equal(connections,0);
  await assert.rejects(reader.inspectExpired(target)); assert.equal(authorizations,1); assert.equal(connections,0);
  reader.close(); await assert.rejects(reader.inspectExpired(target)); assert.equal(authorizations,1);
});
test('timed-out historical authority retains admission until it drains and close suppresses late SQL acquisition', async () => {
  let release!: () => void,authorizations=0,connections=0;
  const held=new Promise<void>(resolve => { release=resolve; });
  const pool={ connect:async () => { connections++; throw new Error('private-connection'); } };
  const reader=createExpiredDevelopmentStepReader(pool,config,{ authorize:async () => { authorizations++; await held; } });
  await assert.rejects(reader.inspectExpired(target)); await assert.rejects(reader.inspectExpired(target));
  assert.equal(authorizations,1); assert.equal(connections,0);
  reader.close(); release(); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(reader.inspectExpired(target)); assert.equal(connections,0);
});
