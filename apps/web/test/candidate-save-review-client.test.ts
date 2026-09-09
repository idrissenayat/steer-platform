import assert from 'node:assert/strict';
import test from 'node:test';
import { createCandidateSaveReviewClient } from '../app/candidate-save-review-client.ts';
import { candidateSaveReviewFixture } from '../../../packages/tool-registry/test/candidate-save-review.fixture.ts';

test('final-review browser transport sends only exact references and choice, validates all document bytes and refuses authority injection', async () => {
  const f = await candidateSaveReviewFixture(); let response: unknown = f.output, calls = 0;
  const client = createCandidateSaveReviewClient('https://steer.test', async (url, init) => {
    calls++; assert.equal(url, 'https://steer.test/v1/tools/intent.candidate.save.review');
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.cache, 'no-store');
    assert.deepEqual(JSON.parse(String(init?.body)), f.input); assert.doesNotMatch(String(init?.body), /Human-edited Exam|Current corrected Brief/);
    return Response.json(response);
  });
  try {
    assert.deepEqual(await client.review(f.input, f.content.documents), f.output);
    await assert.rejects(client.review(f.input, { ...f.content.documents, exam: 'New edit' }));
    response = { ...f.output, saveConfirmed: true }; await assert.rejects(client.review(f.input, f.content.documents));
    client.close(); const before = calls; await assert.rejects(client.review(f.input, f.content.documents)); assert.equal(calls, before);
  } finally { client.close(); }
});
test('closing a deferred final review suppresses the late result without another request', async () => {
  const f = await candidateSaveReviewFixture(); let release: (() => void) | undefined;
  const client = createCandidateSaveReviewClient('https://steer.test', async () => new Promise(resolve => { release = () => resolve(Response.json(f.output)); }));
  const pending = assert.rejects(client.review(f.input, f.content.documents));
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  client.close(); release(); await pending;
});
