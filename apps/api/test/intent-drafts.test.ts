import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createApi } from '../src/app.ts';

const principal = { organizationId: 'org', subject: 'human', type: 'human', hats: [],
  toolGrants: ['intent.draft.create', 'intent.draft.append', 'intent.draft.read'], expiresAt: new Date(Date.now() + 60000).toISOString() };
const input = { organizationId: 'org', productId: 'product', repository: 'github:52', draftId: randomUUID(), mutationId: randomUUID(),
  expectedRevision: 0, expectedDigest: null, content: { originalText: 'Exact intent', clarificationTurns: [],
    documents: { brief: 'text '.repeat(4000), spec: 'Spec', exam: 'NOT RUN' } } };
const request = (name: string, body = JSON.stringify(input)) => new Request(`https://steer.example/v1/tools/${name}`,
  { method: 'POST', headers: { 'content-type': 'application/json' }, body });

test('only draft append accepts document-sized bodies and remains unavailable without the explicit records service', async () => {
  const app = createApi({ authenticate: async () => principal });
  assert.ok(Buffer.byteLength(JSON.stringify(input)) > 16384);
  assert.equal((await app.fetch(request('intent.draft.append'))).status, 503);
  assert.equal((await app.fetch(request('intent.agent.develop'))).status, 413);
  assert.equal((await app.fetch(request('intent.draft.read'))).status, 413);
  const oversized = await app.fetch(request('intent.draft.append', 'x'.repeat(262145)));
  assert.equal(oversized.status, 413); assert.match(await oversized.text(), /256 KiB/);
});
test('draft HTTP authentication precedes body admission and denies caller identity or retention controls', async () => {
  assert.equal((await createApi().fetch(request('intent.draft.append', 'x'.repeat(262145)))).status, 401);
  const app = createApi({ authenticate: async () => principal });
  for (const extra of [{ subject: 'other' }, { recordsPolicyDigest: 'a'.repeat(64) }, { gateSigned: true }])
    assert.equal((await app.fetch(request('intent.draft.append', JSON.stringify({ ...input, ...extra })))).status, 422);
  assert.equal((await app.fetch(request('intent.draft.read', JSON.stringify({ organizationId: 'org', productId: 'product', repository: 'github:52', draftId: input.draftId, revision: 'latest' })))).status, 503);
});
