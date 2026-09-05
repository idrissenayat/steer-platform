import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { decodeJwt } from 'jose';
import type { AuthorizationRecord } from '@steer/adapters/identity';
import { createBrowserApi } from '../src/browser.ts';
import { createMemorySessionHarness, type SessionTestHarness } from './session-harness.ts';

/** HTTP form driver, not browser cookie-policy or visual evidence. All inputs are synthetic. */
export async function testKeycloakHumanFlow(deps: { issuer: string; clientSecret: string; subject: string;
  username: string; password: string; fetch: typeof fetch;
  createSessions?: (binding: { issuer: string; clientId: string; redirectUri: string }) => Promise<SessionTestHarness>;
  check: (label: string, run: () => Promise<void>) => Promise<void> }) {
  const { issuer, check } = deps; const origin = 'https://steer.test';
  const configuration = { issuer, jwksUri: `${issuer}/protocol/openid-connect/certs`,
    authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`, tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
    redirectUri: `${origin}/auth/callback`, clientId: 'steer-test-web', clientSecret: deps.clientSecret, audience: 'steer-api' };
  const storage = deps.createSessions ? await deps.createSessions({ issuer, clientId: configuration.clientId, redirectUri: configuration.redirectUri }) : createMemorySessionHarness();
  const store = storage.store;
  let grant: AuthorizationRecord = { issuer, subject: deps.subject, organizationId: 'synthetic-org', type: 'human',
    hats: ['product-lead'], toolGrants: ['session.context'], active: true,
    validAfter: new Date(0).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
  let exchanges = 0;
  let expectedNonce = '';
  let tokenChecks: Record<string, boolean | number> = {};
  const dependencies = { store, resolveAuthorization: async () => grant,
    fetch: (async (input, options) => {
      const response = await deps.fetch(input, options);
      if (String(input) === configuration.tokenEndpoint) {
        exchanges++;
        tokenChecks = { status: response.status };
        if (response.ok) {
          const tokens = await response.clone().json();
          const access = decodeJwt(tokens.access_token); const id = decodeJwt(tokens.id_token);
          // Deliberately allowlist booleans/lifetimes, never token/claim values.
          tokenChecks = { status: response.status, bearerType: tokens.token_type === 'Bearer',
            idSeconds: Number(id.exp) - Number(id.iat), accessSeconds: Number(access.exp) - Number(access.iat),
            nonce: id.nonce === expectedNonce, subject: id.sub === deps.subject && access.sub === deps.subject,
            idSubject: id.sub === deps.subject, accessSubject: access.sub === deps.subject,
            issuer: id.iss === issuer && access.iss === issuer, idAudience: id.aud === configuration.clientId,
            accessAudience: access.aud === configuration.audience,
            accessProfile: access.typ === 'Bearer' && access.azp === configuration.clientId && access.steer_kind === 'human',
            hatsArray: Array.isArray(access.steer_hats) };
        }
      }
      return response;
    }) as typeof fetch };
  let app = createBrowserApi(configuration, dependencies);
  const originalApp = app;
  const request = (path: string, init?: RequestInit) => app.request(new URL(path, origin).href, init);
  const begin = async (target = app) => {
    const result = await target.request(`${origin}/auth/login`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin' } });
    assert.equal(result.status, 303);
    const auth = new URL(result.headers.get('location')!);
    expectedNonce = auth.searchParams.get('nonce')!;
    assert.equal(auth.origin, new URL(issuer).origin); assert.equal(auth.pathname, new URL(configuration.authorizationEndpoint).pathname);
    return { auth, loginCookie: result.headers.getSetCookie()[0]!.split(';')[0]! };
  };
  const providerLogin = async (auth: URL, wrongFirst = false) => {
    // Provider cookies never leave the pinned issuer. No redirect is automatically followed.
    const jar = new Map<string, string>();
    const provider = async (url: URL, options: RequestInit = {}) => {
      assert.equal(url.origin, new URL(issuer).origin);
      assert.ok(url.pathname.startsWith(`${new URL(issuer).pathname}/`));
      const response = await deps.fetch(url, { ...options, redirect: 'manual',
        headers: { ...Object.fromEntries(new Headers(options.headers)), cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') } });
      for (const value of response.headers.getSetCookie()) {
        const first = value.split(';')[0]!; const separator = first.indexOf('='); assert.ok(separator > 0);
        const name = first.slice(0, separator); const content = first.slice(separator + 1);
        if (/;\s*Max-Age=0(?:;|$)/i.test(value)) jar.delete(name); else jar.set(name, content);
      }
      return response;
    };
    const action = async (response: Response) => {
      assert.equal(response.status, 200);
      const html = await response.text();
      const form = html.match(/<form\b[^>]*\bid="kc-form-login"[^>]*>/)?.[0];
      assert.ok(form, 'Expected the pinned Keycloak password form');
      const raw = form.match(/\baction="([^"]+)"/)?.[1]; assert.ok(raw);
      const url = new URL(raw.replaceAll('&amp;', '&'));
      assert.equal(url.origin, new URL(issuer).origin);
      assert.equal(url.pathname, `${new URL(issuer).pathname}/login-actions/authenticate`);
      return url;
    };
    let formAction = await action(await provider(auth));
    const submit = (password: string) => provider(formAction, { method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: new URL(issuer).origin },
      body: new URLSearchParams({ username: deps.username, password, credentialId: '' }).toString() });
    if (wrongFirst) {
      const rejected = await submit(`wrong-${randomBytes(16).toString('hex')}`);
      assert.equal(rejected.headers.get('location'), null);
      formAction = await action(rejected);
    }
    const result = await submit(deps.password); assert.equal(result.status, 302);
    const callback = new URL(result.headers.get('location')!);
    assert.equal(callback.origin, origin); assert.equal(callback.pathname, '/auth/callback');
    assert.ok(callback.searchParams.get('code')); assert.equal(callback.searchParams.get('state'), auth.searchParams.get('state'));
    assert.equal(callback.searchParams.get('iss'), issuer); assert.equal(callback.searchParams.has('access_token'), false);
    return callback;
  };
  let loginCookie = ''; let callback: URL; let sessionCookie = '';
  await check('human client enforces S256 and denies password/service-account grants', async () => {
    const start = await begin(); loginCookie = start.loginCookie;
    assert.equal(start.auth.searchParams.get('code_challenge_method'), 'S256');
    const missingPkce = new URL(start.auth); missingPkce.searchParams.delete('code_challenge'); missingPkce.searchParams.delete('code_challenge_method');
    const rejected = await deps.fetch(missingPkce, { redirect: 'manual' });
    assert.ok(rejected.status === 400 || rejected.status === 302);
    if (rejected.status === 302) {
      const errorRedirect = new URL(rejected.headers.get('location')!);
      assert.equal(errorRedirect.origin, origin); assert.equal(errorRedirect.pathname, '/auth/callback');
      assert.ok(errorRedirect.searchParams.get('error')); assert.equal(errorRedirect.searchParams.has('code'), false);
    }
    for (const grantType of ['password', 'client_credentials']) {
      const result = await deps.fetch(configuration.tokenEndpoint, { method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: grantType, client_id: configuration.clientId, client_secret: deps.clientSecret,
          username: deps.username, password: deps.password }).toString() });
      assert.ok(result.status === 400 || result.status === 401);
      assert.equal((await result.json()).error, 'unauthorized_client');
    }
    // This synthetic login was deliberately abandoned before a code was issued.
    await storage.abandonTransactions();
  });
  await check('actual Keycloak password form rejects a wrong password and issues a browser-bound human code', async () => {
    const start = await begin(); loginCookie = start.loginCookie;
    callback = await providerLogin(start.auth, true);
  });
  await check('real code/PKCE/ID-access-token exchange reaches the shared human tool boundary', async () => {
    if (storage.kind === 'postgres') app = createBrowserApi(configuration, { ...dependencies, store: storage.freshStore() });
    const exchangesBefore = exchanges;
    const options = { headers: { cookie: loginCookie, 'sec-fetch-site': 'cross-site' } };
    const attempts = storage.kind === 'postgres'
      ? await Promise.all([request(callback!.href, options), originalApp.request(callback!.href, options)])
      : [await request(callback!.href, options)];
    if (storage.kind === 'postgres') {
      assert.deepEqual(attempts.map((response) => response.status).sort(), [303, 400]);
      assert.equal(exchanges - exchangesBefore, 1);
    }
    const result = attempts.find((response) => response.status === 303) ?? attempts[0]!;
    if (result.status !== 303) console.log('Human flow validation flags (no credentials):', JSON.stringify(tokenChecks));
    assert.equal(result.status, 303); assert.equal(result.headers.get('location'), `${origin}/`);
    assert.equal(tokenChecks.subject, true); assert.equal(tokenChecks.nonce, true);
    assert.equal(result.headers.get('cache-control'), 'no-store'); assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(result.headers.getSetCookie().length, 2);
    sessionCookie = result.headers.getSetCookie().find((value) => value.startsWith('__Host-steer-session='))!.split(';')[0]!;
    assert.deepEqual(await storage.counts(), { transactions: 0, sessions: 1 });
    const session = await storage.firstSession(); assert.ok(session); assert.equal(session.subject, deps.subject);
    assert.ok(!JSON.stringify([...result.headers]).includes(session.accessToken));
    const context = await request('/v1/tools/session.context', { method: 'POST', headers: {
      origin, cookie: sessionCookie, 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: 'synthetic-org' }) });
    assert.equal(context.status, 200);
    const principal = await context.json(); assert.equal(principal.subject, deps.subject); assert.deepEqual(principal.hats, ['product-lead']);
  });
  const call = (organizationId = 'synthetic-org') => request('/v1/tools/session.context', { method: 'POST',
    headers: { origin, cookie: sessionCookie, 'content-type': 'application/json' }, body: JSON.stringify({ organizationId }) });
  if (storage.kind === 'postgres') await check('encrypted provider session survives app/store reconstruction and wrong-key instances deny', async () => {
    assert.ok(storage.verifyCiphertext && storage.wrongKeyStore);
    await storage.verifyCiphertext();
    app = createBrowserApi(configuration, { ...dependencies, store: storage.wrongKeyStore() });
    assert.equal((await call()).status, 401);
    app = createBrowserApi(configuration, { ...dependencies, store: storage.freshStore() });
    assert.equal((await call()).status, 200);
  });
  await check('real-provider session rejects callback replay, tenant mismatch and current grant revocation', async () => {
    const before = exchanges;
    assert.equal((await request(callback!.href, { headers: { cookie: loginCookie } })).status, 400);
    assert.equal(exchanges, before); assert.equal((await call('another-org')).status, 403);
    grant = { ...grant, active: false }; assert.equal((await call()).status, 401);
    grant = { ...grant, active: true }; assert.equal((await call()).status, 200);
  });
  await check('local logout revokes the real-provider server session without claiming provider logout', async () => {
    const result = await request('/auth/logout', { method: 'POST', headers: { origin, cookie: sessionCookie } });
    assert.equal(result.status, 303); assert.equal(result.headers.getSetCookie().length, 2);
    assert.equal((await storage.counts()).sessions, 0); assert.equal((await call()).status, 401);
    const original = await originalApp.request(`${origin}/v1/tools/session.context`, { method: 'POST',
      headers: { origin, cookie: sessionCookie, 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: 'synthetic-org' }) });
    assert.equal(original.status, 401);
  });
  await check('Keycloak denies a corrupted PKCE verifier and a wrong confidential client secret', async () => {
    const start = await begin(); const code = await providerLogin(start.auth);
    await storage.corruptVerifier();
    assert.equal((await request(code.href, { headers: { cookie: start.loginCookie } })).status, 400);
    assert.equal(tokenChecks.status, 400);
    assert.deepEqual(await storage.counts(), { transactions: 0, sessions: 0 });
    const wrongClient = createBrowserApi({ ...configuration, clientSecret: randomBytes(32).toString('hex') }, dependencies);
    const other = await begin(wrongClient); const otherCode = await providerLogin(other.auth);
    const failed = await wrongClient.request(otherCode.href, { headers: { cookie: other.loginCookie } });
    assert.equal(failed.status, 400); assert.equal((await storage.counts()).sessions, 0);
    assert.equal(tokenChecks.status, 401);
    assert.equal(await failed.text(), JSON.stringify({ error: { code: 'SIGN_IN_FAILED', message: 'The sign-in operation could not be completed.' } }));
  });
}
