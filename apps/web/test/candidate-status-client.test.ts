import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateReadFixture } from '../../../packages/tool-registry/test/candidate-read-fixture.ts';
import { candidateSaveStatusFragment, readCandidateSaveStatusLocation, createCandidateSaveStatusClient } from '../app/candidate-save-status-client.ts';

export const statusInput = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: 'codex/fixture',
  draftId: '00000000-0000-4000-8000-000000000001', draftRevision: 1,
  operationId: '00000000-0000-4000-8000-000000000002', inputDigest: 'a'.repeat(64) };
test('save-status links bind exact original metadata and reject ambiguous revisions and extra authority', () => {
  const fragment = candidateSaveStatusFragment(statusInput);
  assert.deepEqual(readCandidateSaveStatusLocation(fragment), { kind: 'status', reference: statusInput });
  assert.deepEqual(readCandidateSaveStatusLocation('#candidate=version=v1'), { kind: 'none' });
  for (const raw of [fragment + '&draftRevision=1', fragment + '&approved=true', fragment.replace('draftRevision=1', 'draftRevision=01'),
    fragment.replace('version=v1', 'version=v2'), '#candidate-save=', '#candidate-save=' + 'a'.repeat(4096)])
    assert.deepEqual(readCandidateSaveStatusLocation(raw), { kind: 'invalid' });
});
test('status client admits only matching current-origin metadata, never retry permission or a substituted original', async () => {
  const f = await candidateReadFixture(); let calls = 0;
  const base = { ...statusInput, kind: 'steer-candidate-save-status/v1', retryAuthorized: false, gateSigned: false, executionAuthorized: false };
  let output: unknown = { ...base, outcome: 'committed', saveVerified: true, reference: f.reference,
    expectedHead: 'e'.repeat(40), pointerDigest: 'b'.repeat(64), confirmationDigest: 'c'.repeat(64) };
  const client = createCandidateSaveStatusClient(statusInput, 'https://steer.test', async (url, init) => {
    calls++; assert.equal(url, 'https://steer.test/v1/tools/intent.candidate.save.status');
    assert.equal(init?.method, 'POST'); assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
    assert.deepEqual(JSON.parse(String(init.body)), statusInput); return Response.json(output);
  });
  assert.equal((await client.read(statusInput)).outcome, 'committed');
  for (const change of [{ organizationId: 'other' }, { repository: 'other' }, { original: 'PRIVATE payload' }]) await assert.rejects(client.read({ ...statusInput, ...change }));
  assert.equal(calls, 1);
  for (const bad of [{ ...base, operationId: '00000000-0000-4000-8000-000000000003', outcome: 'unknown', saveVerified: false },
    { ...base, outcome: 'unknown', saveVerified: false, retryAuthorized: true },
    { ...base, outcome: 'not-found', observedHead: 'e'.repeat(40), saveVerified: true },
    { ...base, outcome: 'unknown', saveVerified: false, reference: f.reference }]) {
    output = bad; await assert.rejects(client.read(statusInput));
  }
  const count = calls; client.close(); await assert.rejects(client.read(statusInput)); assert.equal(calls, count);
});
