import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeTool } from '@steer/tool-registry';
import { createApi } from '../src/app.ts';

const now = new Date('2026-09-04T12:00:00Z');
const principal = {
  subject: 'human-1', organizationId: 'org-a', type: 'human',
  hats: ['product-lead'], toolGrants: ['session.context'], expiresAt: '2026-09-04T12:01:00Z',
};
const app = createApi({ authenticate: async () => principal, now: () => now });
const call = (body: string, path = 'session.context', headers: Record<string, string> = {}) =>
  app.request(`/v1/tools/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });

test('HTTP and internal registry return the same organization-scoped result', async () => {
  const input = { organizationId: 'org-a' };
  const response = await call(JSON.stringify(input));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), invokeTool('session.context', input, { principal, now }));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('default server does not trust tokens or caller role/tenant headers', async () => {
  const response = await createApi().request('/v1/tools/session.context', {
    method: 'POST', headers: { authorization: 'Bearer fake', 'x-organization-id': 'org-a', 'x-role': 'org-admin' },
    body: JSON.stringify({ organizationId: 'org-a' }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
});

test('HTTP rejects cross-tenant input, role injection and unknown tools', async () => {
  const crossTenant = await call('{"organizationId":"org-b"}');
  assert.equal(crossTenant.status, 403);
  const injected = await call('{"organizationId":"org-a","hats":["org-admin"]}');
  assert.equal(injected.status, 422);
  assert.equal((await call('{}', 'constructor')).status, 404);
});

test('HTTP enforces identity expiry and tool grants at the same boundary as internal calls', async () => {
  for (const [identity, expected] of [
    [{ ...principal, expiresAt: now.toISOString() }, 401],
    [{ ...principal, toolGrants: [] }, 403],
  ] as const) {
    const response = await createApi({ authenticate: async () => identity, now: () => now }).request('/v1/tools/session.context', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"organizationId":"org-a"}',
    });
    assert.equal(response.status, expected);
  }
});

test('HTTP rejects malformed JSON, invalid UTF-8 and non-JSON requests safely', async () => {
  const malformed = await call('{private-input');
  assert.equal(malformed.status, 400);
  assert.ok(!(await malformed.text()).includes('private-input'));
  assert.equal((await call('{}', 'session.context', { 'Content-Type': 'text/plain' })).status, 415);
  const invalidUtf8 = await app.request('/v1/tools/session.context', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: new Uint8Array([0xff]),
  });
  assert.equal(invalidUtf8.status, 400);
});

test('actual body bytes are limited even when Content-Length lies', async () => {
  const oversized = await call(JSON.stringify({ organizationId: 'x'.repeat(17 * 1024) }), 'session.context', { 'Content-Length': '2' });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('adapter failures do not reveal exception messages, tokens or artifact content', async () => {
  const failed = createApi({ authenticate: async () => { throw new Error('private-token'); } });
  const response = await failed.request('/v1/tools/session.context', { method: 'POST' });
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('private-token'));
});

test('service health distinguishes running process from incomplete provider integration', async () => {
  const live = await app.request('/health/live');
  assert.equal(live.status, 200);
  const ready = await app.request('/health/ready');
  assert.equal(ready.status, 503);
  assert.deepEqual((await ready.json()).missing, ['oidc', 'projections']);
  const schema = await app.request('/openapi.json');
  assert.equal(schema.status, 200);
  assert.ok((await schema.json()).paths['/v1/tools/session.context']);
  assert.equal((await app.request('/missing')).status, 404);
});
