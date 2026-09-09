import assert from 'node:assert/strict';
import test from 'node:test';
import { intentAdmissionOutputSchema, verifyIntentAdmissionDiscovery } from '../src/intent-admission-discovery-contracts.ts';
import { admissionDiscoveryFixture } from './intent-admission-discovery.fixture.ts';
test('preparation diagnostic contract distinguishes metadata presence from execution, content and retry authority', () => {
  const f = admissionDiscoveryFixture(); assert.deepEqual(verifyIntentAdmissionDiscovery(f.input, f.output), f.output);
  for (const key of ['originalContentVerified', 'retryAuthorized', 'executionAuthorized', 'savedToGit', 'gateSigned'])
    assert.equal(intentAdmissionOutputSchema.safeParse({ ...f.output, [key]: true }).success, false);
  for (const patch of [{ executionState: 'not-started' }, { coverage: 'all-history' }, { subject: 'foreign' }, { configuredExecutionCount: 0 },
    { entries: [{ ...f.output.entries[0], originalRecord: 'never-captured' }] }, { useUntil: f.output.observedAt }])
    assert.equal(intentAdmissionOutputSchema.safeParse({ ...f.output, ...patch }).success, false);
  assert.throws(() => verifyIntentAdmissionDiscovery({ ...f.input, productId: 'foreign' }, f.output));
});
test('preparation diagnostic cursors bind source and configured inventory, reject unordered or duplicate references', () => {
  const f = admissionDiscoveryFixture(), entry = f.output.entries[0]!;
  const cursor = { revision: 2, kind: 'development', runId: '00000000-0000-4000-8000-000000000009', latestRevisionDigest: f.output.latest.revisionDigest, bindingSetDigest: f.output.bindingSetDigest };
  assert.equal(intentAdmissionOutputSchema.safeParse({ ...f.output, cursor }).success, true);
  for (const patch of [{ cursor: { ...cursor, bindingSetDigest: 'a'.repeat(64) } }, { cursor: { ...cursor, latestRevisionDigest: 'a'.repeat(64) } },
    { nextCursor: cursor }, { entries: [...f.output.entries].reverse() }, { entries: [entry, entry] },
    { entries: [{ ...entry, source: f.output.latest }, entry] }]) assert.equal(intentAdmissionOutputSchema.safeParse({ ...f.output, ...patch }).success, false);
});
