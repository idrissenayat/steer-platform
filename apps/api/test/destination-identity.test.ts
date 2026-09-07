import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createGitHubReader } from '@steer/adapters/github';
import { createIdentityService } from '../src/identity-service.ts';
import { createMemorySessionHarness } from './session-harness.ts';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { createDestinationController, type DestinationState } from '../../web/app/brief-destination-client.ts';

const origin = 'https://steer.example', authorizationPath = 'access/authorization.json';
const configuration = { issuer: 'https://id.example/realm', jwksUri: 'https://id.example/jwks',
  authorizationEndpoint: 'https://id.example/auth', tokenEndpoint: 'https://id.example/token',
  redirectUri: `${origin}/auth/callback`, clientId: 'steer-web',
  clientSecret: 'synthetic-test-secret-not-a-real-credential', audience: 'steer-api' };

async function composed(t: TestContext) {
  const source = fixture(t), sessions = createMemorySessionHarness(), keys = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(keys.publicKey), kid: 'synthetic', alg: 'RS256' };
  const grant = { issuer: configuration.issuer, subject: 'synthetic-human', organizationId: binding.organizationId,
    type: 'human', hats: ['product-lead'], toolGrants: ['session.context', 'intent.brief.destination'], active: true,
    validAfter: new Date(now.getTime() - 1000).toISOString(), expiresAt: new Date(now.getTime() + 180000).toISOString() };
  const publish = (records: unknown[] = [grant]) => source.add([{ path: authorizationPath,
    content: JSON.stringify({ version: 'steer-authorization/v1', organizationId: binding.organizationId, records }) }]);
  publish(); let closed = false, closes = 0, nonce = '', destinationReads = 0;
  let beforeHead = async () => {};
  const permissions: unknown[] = [];
  const reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', now: () => now,
    fetch: async (url, init) => {
      if (String(url).endsWith('/access_tokens')) permissions.push(JSON.parse(String(init?.body)));
      return source.transport(url, init);
    } });
  const scope = { organizationId: binding.organizationId, repository: `github:${binding.repositoryId}`,
    branch: binding.branch, paths: ['items/0150-demo/BRIEF.md'] };
  const service = createIdentityService(configuration, { reader, authorizationPath, now: () => now,
    sessions: { binding: { issuer: configuration.issuer, clientId: configuration.clientId, redirectUri: configuration.redirectUri },
      store: { ...sessions.store, readSession: async (key) => { if (closed) throw new Error('Synthetic store closed'); return sessions.store.readSession(key); } },
      shutdown: async () => { closed = true; closes++; } },
    services: { briefDestination: { scope, readHead: async () => { destinationReads++; await beforeHead(); return reader.readHead(); } } },
    fetch: async (url) => {
      if (String(url) === configuration.jwksUri) return Response.json({ keys: [jwk] });
      assert.equal(String(url), configuration.tokenEndpoint);
      const common = { iss: configuration.issuer, sub: grant.subject, iat: now.getTime() / 1000, exp: now.getTime() / 1000 + 180 };
      const sign = (claims: Record<string, unknown>) => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'synthetic' }).sign(keys.privateKey);
      return Response.json({ token_type: 'Bearer', access_token: await sign({ ...common, aud: configuration.audience,
        azp: configuration.clientId, typ: 'Bearer', steer_org: grant.organizationId, steer_kind: 'human', steer_hats: grant.hats }),
        id_token: await sign({ ...common, aud: configuration.clientId, nonce }) });
    },
  });
  const request = (path: string, init?: RequestInit) => service.fetch(new Request(new URL(path, origin), init));
  const start = await request('/auth/login', { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin' } });
  assert.equal(start.status, 303);
  const authorization = new URL(start.headers.get('location')!); nonce = authorization.searchParams.get('nonce')!;
  const callback = new URL(configuration.redirectUri);
  callback.search = new URLSearchParams({ code: 'synthetic-code', state: authorization.searchParams.get('state')!, iss: configuration.issuer }).toString();
  const result = await request(callback.href, { headers: { cookie: start.headers.getSetCookie()[0]!.split(';')[0]!,
    'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' } });
  assert.equal(result.status, 303);
  const cookie = result.headers.getSetCookie().find(value => value.startsWith('__Host-steer-session='))!.split(';')[0]!;
  const tool = (input: unknown = { organizationId: grant.organizationId }, headers: Record<string, string> = {}) =>
    request('/v1/tools/intent.brief.destination', { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', cookie,
      'content-type': 'application/json', ...headers }, body: JSON.stringify(input) });
  const states: DestinationState[] = [];
  const controller = createDestinationController({ organizationId: grant.organizationId }, grant.expiresAt, origin, state => states.push(state), {
    now: () => now.getTime(), schedule: () => () => {},
    fetch: async (url, init) => {
      assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.cache, 'no-store');
      const headers = new Headers(init?.headers); headers.set('origin', origin); headers.set('sec-fetch-site', 'same-origin'); headers.set('cookie', cookie);
      return service.fetch(new Request(url, { ...init, headers }));
    },
  });
  return { source, scope, service, grant, publish, tool, request, controller, states, permissions,
    beforeHead: (callback: () => Promise<void>) => { beforeHead = callback; },
    stats: () => ({ closed, closes, destinationReads }), close: async () => { controller.close(); await service.shutdown(); } };
}

test('cookie login plus Git-backed current grants delivers native Git heads to the actual destination display controller', async (t) => {
  const f = await composed(t);
  try {
    assert.equal(f.states.length, 0); assert.equal(f.stats().destinationReads, 0);
    for (let round = 0; round < 2; round++) {
      if (round) f.source.add([{ path: 'synthetic.txt', content: 'A new native commit, not a projection update.' }]);
      await f.controller.load();
      assert.deepEqual(f.states.at(-1), { kind: 'observed', destination: { ...f.scope, kind: 'brief-destination-observation',
        observedHead: f.source.head(), observedAt: now.toISOString(), writeAuthorized: false, gateVerified: false } });
    }
    assert.deepEqual(f.permissions, [{ repository_ids: [binding.repositoryId], permissions: { contents: 'read' } }]);
    assert.equal(f.source.mutations(), 0); assert.equal(f.source.approvals(), 0);
    assert.equal((await f.request('/health/ready')).status, 503);
  } finally { await f.close(); }
});

test('current Git revocation during destination I/O clears prior display details instead of returning an observed head', async (t) => {
  const f = await composed(t);
  try {
    await f.controller.load(); assert.equal(f.states.at(-1)?.kind, 'observed');
    f.beforeHead(async () => { f.publish([{ ...f.grant, active: false }]); });
    await f.controller.load(); assert.deepEqual(f.states.at(-1), { kind: 'unavailable' });
    const reads = f.stats().destinationReads; await f.controller.load();
    assert.equal(f.stats().destinationReads, reads); assert.equal(f.states.at(-1)?.kind, 'unavailable');
  } finally { await f.close(); }
});

test('cookie destination requests deny scope injection, forged roles, missing grants and cross-origin calls before destination reads', async (t) => {
  const f = await composed(t);
  try {
    assert.equal((await f.tool({ organizationId: 'other' })).status, 403);
    assert.equal((await f.tool({ organizationId: f.grant.organizationId, branch: 'main' })).status, 422);
    assert.equal((await f.tool(undefined, { origin: 'https://foreign.invalid' })).status, 401);
    f.publish([{ ...f.grant, toolGrants: ['session.context'] }]);
    const response = await f.tool(undefined, { 'x-role': 'org-admin', 'x-steer-tool-grants': 'intent.brief.destination' });
    assert.equal(response.status, 403); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(f.stats().destinationReads, 0);
  } finally { await f.close(); }
});

for (const outcome of ['success', 'revoked', 'source-failure'] as const) test(`browser-only destination shutdown drains ${outcome} before closing session resources`, async (t) => {
  const f = await composed(t); let release!: () => void, entered!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }), admitted = new Promise<void>(resolve => { entered = resolve; });
  f.beforeHead(async () => {
    entered(); await pending;
    if (outcome === 'revoked') f.publish([{ ...f.grant, active: false }]);
    if (outcome === 'source-failure') throw new Error('Synthetic private source failure');
  });
  const request = f.tool(); await admitted;
  const stop = f.service.shutdown();
  try {
    await Promise.resolve(); await Promise.resolve();
    assert.equal(f.stats().closed, false, 'destination still needs its session store for post-read authorization');
    assert.equal(f.service.status().state, 'draining'); assert.equal(f.service.status().activeRequests, 1);
    assert.equal((await f.tool()).status, 503);
    release(); const response = await request;
    assert.equal(response.status, outcome === 'success' ? 200 : outcome === 'revoked' ? 401 : 500);
    assert.ok(!(await response.text()).includes('Synthetic private')); await stop;
    assert.equal(f.stats().closes, 1); assert.equal(f.service.status().state, 'stopped');
  } finally { release(); await request; await stop; await f.close(); }
});
