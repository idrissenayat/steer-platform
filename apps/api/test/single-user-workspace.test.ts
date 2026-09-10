import assert from 'node:assert/strict';
import test from 'node:test';
import { createSingleUserApi, localWorkspace } from '../src/single-user-workspace.ts';
import { createIdentityGateway } from '../src/identity-gateway.ts';

const origin = 'https://localhost:8443';
const draft = { title: 'Test intent', problem: 'A problem', outcome: 'An outcome', users: [], systems: [], constraints: [], openQuestions: [], successMeasure: '' };
const request = (path: string, input: unknown = { organizationId: localWorkspace.organizationId, draft }, extra: Record<string, string> = {}) => new Request(origin + path, {
  method: 'POST', headers: { origin, 'content-type': 'application/json', ...extra }, body: JSON.stringify(input),
});

test('single-user API needs no cookies or tokens and never invents an authenticated author', async () => {
  const api = createSingleUserApi(origin);
  const response = await api.fetch(request('/v1/tools/intent.brief.preview'));
  assert.equal(response.status, 200); assert.equal(response.headers.get('set-cookie'), null);
  const result = await response.json();
  assert.equal(result.subject, 'local-owner'); assert.equal(result.saved, false); assert.equal(result.executionAuthorized, false);
  assert.match(result.markdown, /Local workspace user/); assert.doesNotMatch(result.markdown, /Authenticated subject/);
  const health = await (await api.fetch(new Request(origin + '/health/ready'))).json();
  assert.equal(health.authentication, 'none'); assert.equal(health.intentWorkflow, 'not-configured');
});

test('local API rejects cross-origin requests and different workspaces; disconnected effects stay unavailable', async () => {
  const api = createSingleUserApi(origin);
  for (const extra of [{ origin: 'https://other.example' }, { origin: '' }, { 'sec-fetch-site': 'cross-site' }])
    assert.equal((await api.fetch(request('/v1/tools/intent.brief.preview', undefined, extra))).status, 403);
  assert.equal((await api.fetch(request('/v1/tools/intent.brief.preview', { organizationId: 'another-org', draft }))).status, 403);
  for (const path of ['/v1/tools/intent.draft.append', '/v1/tools/intent.agent.develop', '/v1/tools/intent.candidate.save.confirm'])
    assert.equal((await api.fetch(request(path))).status, 503);
  for (const path of ['/auth/login', '/auth/logout', '/auth/session', '/auth/callback'])
    assert.equal((await api.fetch(request(path))).status, 404);
  for (const invalid of ['https://remote.example', 'http://localhost:8443', 'https://localhost:8443/path'])
    assert.throws(() => createSingleUserApi(invalid));
});

test('auth-free gateway ignores old and forged sessions and never dispatches authentication routes', async () => {
  let apiCalls = 0, renders = 0;
  const config = { publicOrigin: origin, rendererOrigin: 'http://127.0.0.1:3100', authentication: 'none' as const };
  const dependencies = { identity: { fetch: async () => { apiCalls++; return new Response('api'); } },
    fetch: async (_input: unknown, init?: RequestInit) => {
      renders++; const headers = new Headers(init?.headers);
      for (const name of ['cookie', 'authorization', 'x-steer-session-view', 'x-steer-repository-view']) assert.equal(headers.get(name), null);
      return new Response('<h1>Your workspace.</h1>', { headers: { 'content-type': 'text/html' } });
    } };
  const gateway = createIdentityGateway(config, dependencies);
  for (const headers of [{}, { cookie: '__Host-steer-session=stale', authorization: 'Bearer stale', 'x-steer-session-view': 'forged' }])
    assert.equal((await gateway.fetch(new Request(origin, { headers }))).status, 200);
  for (const path of ['/auth/login', '/auth/logout', '/auth/session', '/auth/callback?code=old'])
    assert.equal((await gateway.fetch(new Request(origin + path))).status, 404);
  assert.equal(apiCalls, 0); assert.equal(renders, 2);
  assert.throws(() => createIdentityGateway({ ...config, publicOrigin: 'https://public.example' }, dependencies));
  assert.throws(() => createIdentityGateway({ ...config, issuer: 'https://identity.example' }, dependencies));
});
