import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApi } from '../src/app.ts';
import { intentAgentFixture } from '../../../tests/fixtures/intent-agent.ts';
const fixture = await intentAgentFixture(), { now, principal, input } = fixture;
const request = () => new Request('https://steer.example/v1/tools/intent.agent.develop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });

test('real HTTP tool dispatch uses revalidated identity and injected agent service', async () => {
  let checks = 0; let calls = 0;
  const app = createApi({ now: () => now, authenticate: async () => { checks++; return principal; }, services: {
    ...fixture.context.services,
    intentAgent: { organizationId: 'org', develop: async (source, subject, revalidate) => {
      calls++; await revalidate(); assert.deepEqual(source, input); assert.equal(subject, 'human');
      return { kind: 'intent-agent-candidate', organizationId: 'org', subject, sourceDigest: 'a'.repeat(64), configurationRevision: 'test', message: 'Who books?', questions: ['Who books?'], documents: null, saved: false, gateSigned: false, executionAuthorized: false };
    } },
  } });
  const response = await app.fetch(request()); assert.equal(response.status, 200);
  assert.equal((await response.json()).saved, false); assert.equal(calls, 1); assert.ok(checks >= 3);
});
test('HTTP authentication, explicit grant and absent provider remain closed', async () => {
  assert.equal((await createApi().fetch(request())).status, 401);
  assert.equal((await createApi({ now: () => now, authenticate: async () => ({ ...principal, toolGrants: ['intent.brief.preview'] }) }).fetch(request())).status, 403);
  assert.equal((await createApi({ now: () => now, authenticate: async () => principal }).fetch(request())).status, 503);
});

test('HTTP stale-scope conflict is actionable and consumes no agent call', async () => {
  let calls = 0;
  const app = createApi({ now: () => now, authenticate: async () => principal, services: { ...fixture.context.services,
    intentAgent: { organizationId: 'org', develop: async () => { calls++; throw new Error('Must not call'); } } } });
  const response = await app.fetch(new Request('https://steer.example/v1/tools/intent.agent.develop', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input,
      disposition: { ...input.disposition, catalogFingerprint: '0'.repeat(64) } }) }));
  assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'SCOPE_REVIEW_CHANGED'); assert.equal(calls, 0);
});
