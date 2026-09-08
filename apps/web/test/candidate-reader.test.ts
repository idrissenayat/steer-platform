import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateReadFixture } from '../../../packages/tool-registry/test/candidate-read-fixture.ts';
import { candidateFragment, readCandidateLocation } from '../app/candidate-location.ts';
import { createCandidateReader } from '../app/candidate-reader.ts';

test('saved bundle links contain only exact reference metadata and reject ambiguous or incomplete locations', async () => {
  const { reference } = await candidateReadFixture(), fragment = candidateFragment(reference);
  assert.deepEqual(readCandidateLocation(fragment), { kind: 'candidate', reference });
  assert.deepEqual(readCandidateLocation('#brief=v1'), { kind: 'none' });
  for (const bad of [fragment + '&revision=' + reference.revision, fragment + '&extra=1', fragment.replace('v1', 'v2'),
    fragment.replace(reference.revision, 'main'), '#candidate=', '#candidate=' + 'a'.repeat(4096)])
    assert.deepEqual(readCandidateLocation(bad), { kind: 'invalid' });
  assert.throws(() => candidateFragment({ ...reference, branch: 'branch\n' }));
  assert.doesNotMatch(fragment, /Saved|private|token|consent/);
});

test('browser reader verifies every byte, uses only same-origin authenticated read, and never falls back', async () => {
  const f = await candidateReadFixture(); let calls = 0, fail = false;
  const reader = createCandidateReader(f.reference, 'https://steer.test', async (url, init) => {
    calls++; assert.equal(url, 'https://steer.test/v1/tools/intent.candidate.read');
    assert.equal(init?.method, 'POST'); assert.equal(init.credentials, 'same-origin'); assert.equal(init.mode, 'same-origin');
    assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert.equal(init.referrerPolicy, 'no-referrer');
    assert.deepEqual(JSON.parse(String(init.body)), f.reference);
    return Response.json(fail ? { ...f.output, documents: { ...f.output.documents, spec: 'PRIVATE wrong bytes' } } : f.output);
  });
  assert.deepEqual((await reader.read(f.reference)).documents, f.output.documents);
  for (const patch of [{ organizationId: 'other' }, { repository: 'github:99' }, { revision: 'main' }]) await assert.rejects(reader.read({ ...f.reference, ...patch }));
  assert.equal(calls, 1); fail = true;
  await assert.rejects(reader.read(f.reference), error => error instanceof Error && !error.message.includes('PRIVATE'));
  assert.equal(calls, 2); reader.close(); await assert.rejects(reader.read(f.reference)); assert.equal(calls, 2);
});

test('browser bundle close rejects a stalled response and ignores its late contents without retry', async () => {
  const f = await candidateReadFixture(); let calls = 0, release!: (value: Response) => void;
  const reader = createCandidateReader(f.reference, 'https://steer.test', async () => {
    calls++; return new Promise(resolve => { release = resolve; });
  });
  const pending = assert.rejects(reader.read(f.reference));
  await Promise.resolve(); reader.close(); await pending;
  release(Response.json(f.output)); await Promise.resolve(); assert.equal(calls, 1);
});
