import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createIntentScopeReader } from '../app/intent-scope-reader.ts';
const scope = { organizationId: 'org', repository: 'github:1' }, intent = 'Patients book appointments online';
const output = { ...scope, kind: 'intent-overlap-candidates', method: 'lexical-candidates/v1',
  sourceDigest: createHash('sha256').update(JSON.stringify(intent)).digest('hex'), catalogFingerprint: 'a'.repeat(64), reviewFingerprint: 'b'.repeat(64),
  coverage: { scope: 'configured-projections-only', catalogCount: 0, inspectedIntents: 0, inspectedDocuments: 0, candidateCount: 0,
    resultsTruncated: false, scanLimited: false, gaps: [] }, candidates: [], semanticReviewComplete: false, authoritativeClearance: false };
test('scope reader calls only authenticated read endpoint and checks the exact original text fingerprint', async () => {
  let calls = 0;
  const reader = createIntentScopeReader(scope, 'https://steer.example', async (url, init) => {
    calls++; assert.equal(url, 'https://steer.example/v1/tools/intent.overlap.check');
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.redirect, 'error');
    assert.deepEqual(JSON.parse(String(init?.body)), { ...scope, intent }); return Response.json(output);
  });
  assert.deepEqual(await reader.check(intent), output); assert.equal(calls, 1);
  reader.close(); await assert.rejects(reader.check(intent)); assert.equal(calls, 1);
});
test('foreign, stale, malformed and counterfeit clearance responses are rejected', async () => {
  for (const change of [{ organizationId: 'other' }, { repository: 'github:other' }, { sourceDigest: 'c'.repeat(64) }, { semanticReviewComplete: true }, { authoritativeClearance: true }]) {
    const reader = createIntentScopeReader(scope, 'https://steer.example', async () => Response.json({ ...output, ...change }));
    await assert.rejects(reader.check(intent));
  }
});
test('closing an outstanding search suppresses delayed output and errors never become empty results', async () => {
  let release!: (value: Response) => void; const reply = new Promise<Response>(resolve => { release = resolve; });
  let started!: () => void; const start = new Promise<void>(resolve => { started = resolve; });
  const reader = createIntentScopeReader(scope, 'https://steer.example', async () => { started(); return reply; });
  const pending = reader.check(intent); const failed = assert.rejects(pending);
  await start; reader.close(); release(Response.json(output)); await failed;
  await assert.rejects(createIntentScopeReader(scope, 'https://steer.example', async () => Response.json({ error: 'private' }, { status: 503 })).check(intent));
});
