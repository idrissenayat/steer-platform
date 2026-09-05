import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ArtifactReader } from '@steer/adapters/github';
import type { BrowserSessionStore } from '@steer/adapters/browser-session';
import { createIdentityService } from '../src/identity-service.ts';

const origin = 'https://steer.example';
const configuration = { issuer: 'https://id.example/realm', jwksUri: 'https://id.example/jwks',
  authorizationEndpoint: 'https://id.example/auth', tokenEndpoint: 'https://id.example/token',
  redirectUri: `${origin}/auth/callback`, clientId: 'steer-web',
  clientSecret: 'synthetic-test-secret-not-a-real-credential', audience: 'steer-api' };
const binding = { issuer: configuration.issuer, clientId: configuration.clientId, redirectUri: configuration.redirectUri };
const reader: ArtifactReader = {
  binding: { organizationId: 'synthetic', installationId: 1, repositoryId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' },
  readHead: async () => { throw new Error('must-not-access-source'); }, readArtifact: async () => { throw new Error('must-not-access-source'); },
};
const store: BrowserSessionStore = { insertTransaction: async () => false, consumeTransaction: async () => undefined,
  insertSession: async () => false, readSession: async () => undefined, deleteSession: async () => {} };
const dependencies = { reader, authorizationPath: 'access/authorization.json', sessions: { binding, store, shutdown: async () => {} } };

test('identity service refuses mismatched resource bindings before lifecycle dispatch', () => {
  for (const change of [{ issuer: 'https://other.example' }, { clientId: 'other' }, { redirectUri: 'https://other.example/auth/callback' }]) {
    assert.throws(() => createIdentityService(configuration, { ...dependencies,
      sessions: { ...dependencies.sessions, binding: { ...binding, ...change } } }), /Invalid identity service resource binding/);
  }
});

test('running service remains unready; stopping denies requests and shares actual shutdown completion', async () => {
  let finish: () => void = () => {}; let calls = 0;
  const service = createIdentityService(configuration, { ...dependencies, sessions: { ...dependencies.sessions,
    shutdown: () => { calls++; return new Promise<void>((resolve) => { finish = resolve; }); } } });
  assert.equal((await service.fetch(new Request(`${origin}/health/ready`))).status, 503);
  const stop = service.shutdown(); assert.equal(stop, service.shutdown());
  await Promise.resolve(); assert.equal(calls, 1); assert.deepEqual(service.status(), { state: 'draining', activeRequests: 0 });
  const rejected = await service.fetch(new Request(`${origin}/auth/login`, { method: 'POST', headers: { origin } }));
  assert.equal(rejected.status, 503); assert.equal(rejected.headers.get('cache-control'), 'no-store');
  assert.equal(rejected.headers.getSetCookie().length, 0);
  finish(); await stop; assert.deepEqual(service.status(), { state: 'stopped', activeRequests: 0 });
  assert.equal((await service.fetch(new Request(`${origin}/health/live`))).status, 503);
});

test('finished resource cleanup alone cannot report stopped while an admitted request is still active', async () => {
  let finishBody: (value: boolean) => void = () => {}; let entered: () => void = () => {};
  const requestEntered = new Promise<void>((resolve) => { entered = resolve; });
  const service = createIdentityService(configuration, { ...dependencies, sessions: { ...dependencies.sessions,
    store: { ...store, insertTransaction: async () => { entered(); return new Promise<boolean>((resolve) => { finishBody = resolve; }); } } } });
  const request = service.fetch(new Request(`${origin}/auth/login`, { method: 'POST', headers: { origin } }));
  await requestEntered;
  let stopped = false; const stop = service.shutdown(); void stop.then(() => { stopped = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(stopped, false); assert.deepEqual(service.status(), { state: 'draining', activeRequests: 1 });
  finishBody(false); assert.equal((await request).status, 400); await stop;
  assert.deepEqual(service.status(), { state: 'stopped', activeRequests: 0 });
});

test('resource shutdown failures stay failed/closed, sanitized and are not retried', async () => {
  let calls = 0;
  const service = createIdentityService(configuration, { ...dependencies, sessions: { ...dependencies.sessions,
    shutdown: async () => { calls++; throw new Error('private-resource-details'); } } });
  const stop = service.shutdown(); await assert.rejects(stop, /^Error: Identity service shutdown failed\.$/);
  assert.equal(service.shutdown(), stop); assert.equal(calls, 1);
  assert.deepEqual(service.status(), { state: 'failed', activeRequests: 0 });
  assert.equal((await service.fetch(new Request(`${origin}/health/live`))).status, 503);
});

test('MCP mounting requires explicit nonempty unique client bindings and never uses browser cookies', async () => {
  for (const clientIds of [[], ['agent', 'agent'], [''], ['a'.repeat(201)]]) {
    assert.throws(() => createIdentityService(configuration, { ...dependencies, mcp: { clientIds } }), /Invalid MCP client binding/);
  }
  let calls = 0;
  for (const enabled of [false, true]) {
    const service = createIdentityService(configuration, { ...dependencies,
      ...(enabled ? { mcp: { clientIds: ['agent'] } } : {}), fetch: async () => { calls++; throw new Error('Forbidden provider'); } });
    try {
      assert.equal((await service.fetch(new Request(`${origin}/mcp`, { method: 'POST' }))).status, enabled ? 401 : 404);
      if (enabled) assert.equal((await service.fetch(new Request(`${origin}/mcp`, {
        method: 'POST', headers: { cookie: '__Host-steer-session=synthetic', authorization: 'Bearer synthetic' },
      }))).status, 403);
      assert.equal(calls, 0);
    } finally { await service.shutdown(); }
  }
});

test('combined service drains both admissions before closing shared resources', async () => {
  let finish: (value: boolean) => void = () => {}; let entered: () => void = () => {}; let closed = 0;
  const admitted = new Promise<void>((resolve) => { entered = resolve; });
  const service = createIdentityService(configuration, { ...dependencies, mcp: { clientIds: ['agent'] },
    sessions: { ...dependencies.sessions, shutdown: async () => { closed++; }, store: { ...store,
      insertTransaction: async () => { entered(); return new Promise<boolean>((resolve) => { finish = resolve; }); },
    } } });
  const request = service.fetch(new Request(`${origin}/auth/login`, { method: 'POST', headers: { origin } }));
  await admitted; const stop = service.shutdown(); assert.equal(stop, service.shutdown());
  await Promise.resolve(); await Promise.resolve(); assert.equal(closed, 0);
  assert.equal(service.status().mcp?.stopping, true);
  assert.equal((await service.fetch(new Request(`${origin}/mcp`, { method: 'POST' }))).status, 503);
  finish(false); await request; await stop; assert.equal(closed, 1);
  assert.deepEqual(service.status(), { state: 'stopped', activeRequests: 0, mcp: { stopping: true, active: 0, cleanupFailed: false } });
});
