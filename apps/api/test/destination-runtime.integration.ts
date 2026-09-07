import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import { createPostgresSessionHarness } from './postgres-session-harness.ts';
import { fixture, binding as github } from '../../../packages/adapters/test/github-brief-fixture.ts';

// Explicit opt-in integration. Uses only the existing pinned PostgreSQL image,
// a disposable database, generated keys and native temporary Git. Not browser QA.
test('actual destination runtime preserves encrypted login/session across reconstruction and rechecks native Git grants', async t => {
  const origin = 'https://steer.example';
  const configuration = { issuer: 'https://id.example/realm', jwksUri: 'https://id.example/jwks',
    authorizationEndpoint: 'https://id.example/auth', tokenEndpoint: 'https://id.example/token',
    redirectUri: `${origin}/auth/callback`, clientId: 'steer-web', audience: 'steer-api',
    clientSecret: 'synthetic-runtime-secret-not-a-real-credential' };
  const source = fixture(t), keys = await generateKeyPair('RS256'), appKeys = await generateKeyPair('RS256', { extractable: true });
  const jwk = { ...await exportJWK(keys.publicKey), kid: 'synthetic', alg: 'RS256' };
  const appPem = await exportPKCS8(appKeys.privateKey);
  const grant = { issuer: configuration.issuer, subject: 'synthetic-human', organizationId: github.organizationId,
    type: 'human', hats: ['product-lead'], toolGrants: ['session.context', 'intent.brief.destination'], active: true,
    validAfter: new Date(0).toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString() };
  const publish = (records: unknown[] = [grant]) => source.add([{ path: 'access/authorization.json',
    content: JSON.stringify({ version: 'steer-authorization/v1', organizationId: github.organizationId, records }) }]);
  publish();
  source.override((url, _init, result) => url.pathname.endsWith('/access_tokens')
    ? { ...(result as object), expires_at: new Date(Date.now() + 3600000).toISOString() } : result);
  let nonce = '', exchanges = 0, appAssertions = 0;
  const transport = {
    identity: (async (url) => {
      if (String(url) === configuration.jwksUri) return Response.json({ keys: [jwk] });
      assert.equal(String(url), configuration.tokenEndpoint); exchanges++;
      const epoch = Math.floor(Date.now() / 1000);
      const common = { iss: configuration.issuer, sub: grant.subject, iat: epoch, exp: epoch + 180 };
      const sign = (claims: Record<string, unknown>) => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'synthetic' }).sign(keys.privateKey);
      return Response.json({ token_type: 'Bearer', access_token: await sign({ ...common, aud: configuration.audience,
        azp: configuration.clientId, typ: 'Bearer', steer_org: grant.organizationId, steer_kind: 'human', steer_hats: grant.hats }),
        id_token: await sign({ ...common, aud: configuration.clientId, nonce }) });
    }) as typeof fetch,
    github: (async (url, init) => {
      const headers = new Headers(init?.headers);
      if (String(url).endsWith('/access_tokens')) {
        const jwt = headers.get('authorization')?.replace(/^Bearer /, ''); assert.ok(jwt);
        await jwtVerify(jwt, appKeys.publicKey, { algorithms: ['RS256'], issuer: '1' }); appAssertions++;
        assert.deepEqual(JSON.parse(String(init?.body)), { repository_ids: [github.repositoryId], permissions: { contents: 'read' } });
        // Adapt only the verified synthetic App assertion to the existing fixture
        // sentinel; production signing and GitHub token-scope validation run intact.
        headers.set('authorization', 'Bearer synthetic-app-jwt');
      }
      return source.transport(url, { ...init, headers });
    }) as typeof fetch,
  };
  const storage = await createPostgresSessionHarness({ issuer: configuration.issuer, clientId: configuration.clientId, redirectUri: configuration.redirectUri });
  const paths = ['items/0151-demo/BRIEF.md'];
  const create = () => storage.createDestinationRuntime(configuration, github, paths, appPem, transport);
  let runtime: Awaited<ReturnType<typeof create>> | undefined;
  try {
    runtime = await create();
    assert.equal(runtime.status().database.connections, 0); assert.equal(exchanges, 0); assert.equal(appAssertions, 0);
    const request = (path: string, init?: RequestInit) => runtime!.fetch(new Request(new URL(path, origin), init));
    const start = await request('/auth/login', { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin' } });
    assert.equal(start.status, 303); const auth = new URL(start.headers.get('location')!); nonce = auth.searchParams.get('nonce')!;
    const loginCookie = start.headers.getSetCookie()[0]!.split(';')[0]!;
    const callback = new URL(configuration.redirectUri);
    callback.search = new URLSearchParams({ code: 'synthetic-code', state: auth.searchParams.get('state')!, iss: configuration.issuer }).toString();
    assert.deepEqual(await storage.counts(), { transactions: 1, sessions: 0 });
    await runtime.shutdown(); assert.equal(runtime.status().database.closed, true);
    runtime = await create();
    const complete = await request(callback.href, { headers: { cookie: loginCookie, 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' } });
    assert.equal(complete.status, 303); assert.equal(exchanges, 1);
    const cookie = complete.headers.getSetCookie().find(value => value.startsWith('__Host-steer-session='))!.split(';')[0]!;
    assert.deepEqual(await storage.counts(), { transactions: 0, sessions: 1 });
    await storage.verifyCiphertext!();
    assert.equal((await request(callback.href, { headers: { cookie: loginCookie } })).status, 400); assert.equal(exchanges, 1);
    const input = { organizationId: grant.organizationId };
    const call = (body: unknown = input, overrides: Record<string, string> = {}) => request('/v1/tools/intent.brief.destination', {
      method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', cookie, 'content-type': 'application/json', ...overrides }, body: JSON.stringify(body) });
    for (let round = 0; round < 2; round++) {
      if (round) {
        await runtime.shutdown(); assert.equal(runtime.status().database.closed, true);
        source.add([{ path: 'synthetic.txt', content: 'Reconstructed runtime reads the new Git head.' }]);
        runtime = await create();
      }
      const response = await call(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const result = await response.json();
      assert.equal(result.observedHead, source.head()); assert.deepEqual(result.paths, paths);
      assert.equal(result.repository, `github:${github.repositoryId}`); assert.equal(result.branch, github.branch);
      assert.equal(result.writeAuthorized, false); assert.equal(result.gateVerified, false);
      assert.ok(!JSON.stringify(result).includes('access_token'));
    }
    assert.equal((await call({ ...input, branch: 'main' })).status, 422);
    assert.equal((await call({ organizationId: 'other' })).status, 403);
    assert.equal((await call(input, { origin: 'https://foreign.invalid' })).status, 401);
    publish([{ ...grant, toolGrants: ['session.context'] }]); assert.equal((await call()).status, 403);
    publish(); assert.equal((await call()).status, 200);
    publish([{ ...grant, active: false }]); assert.equal((await call()).status, 401);
    const logout = await request('/auth/logout', { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', cookie } });
    assert.equal(logout.status, 303); assert.deepEqual(await storage.counts(), { transactions: 0, sessions: 0 });
    await runtime.shutdown(); runtime = await create(); assert.equal((await call()).status, 401);
    assert.equal((await request('/health/ready')).status, 503); assert.ok(appAssertions >= 2);
    assert.equal(source.mutations(), 0); assert.equal(source.approvals(), 0);
  } finally { try { await runtime?.shutdown(); } finally { await storage.close(); } }
});
