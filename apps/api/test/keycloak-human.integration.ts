import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { decodeJwt } from 'jose';
import type { AuthorizationRecord } from '@steer/adapters/identity';
import type { BrowserSessionStore, BrowserSession, LoginTransaction } from '@steer/adapters/browser-session';
import { createBrowserApi } from '../src/browser.ts';

/** HTTP form driver, not browser cookie-policy or visual evidence. All inputs are synthetic. */
export async function testKeycloakHumanFlow(deps: { issuer: string; clientSecret: string; subject: string;
  username: string; password: string; fetch: typeof fetch;
  check: (label: string, run: () => Promise<void>) => Promise<void> }) {
  const { issuer, check } = deps; const origin = 'https://steer.test';
  const configuration = { issuer, jwksUri: `${issuer}/protocol/openid-connect/certs`,
    authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`, tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
    redirectUri: `${origin}/auth/callback`, clientId: 'steer-test-web', clientSecret: deps.clientSecret, audience: 'steer-api' };
  const transactions = new Map<string, LoginTransaction>(); const sessions = new Map<string, BrowserSession>();
  const store: BrowserSessionStore = {
    insertTransaction: async (key, value) => { if (transactions.has(key)) return false; transactions.set(key, value); return true; },
    consumeTransaction: async (key) => { const value = transactions.get(key); transactions.delete(key); return value; },
    insertSession: async (key, value) => { if (sessions.has(key)) return false; sessions.set(key, value); return true; },
    readSession: async (key) => sessions.get(key), deleteSession: async (key) => { sessions.delete(key); },
  };
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
  const app = createBrowserApi(configuration, dependencies);
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
    transactions.clear();
  });
  await check('actual Keycloak password form rejects a wrong password and issues a browser-bound human code', async () => {
    const start = await begin(); loginCookie = start.loginCookie;
    callback = await providerLogin(start.auth, true);
  });
  await check('real code/PKCE/ID-access-token exchange reaches the shared human tool boundary', async () => {
    const result = await request(callback!.href, { headers: { cookie: loginCookie, 'sec-fetch-site': 'cross-site' } });
    if (result.status !== 303) console.log('Human flow validation flags (no credentials):', JSON.stringify(tokenChecks));
    assert.equal(result.status, 303); assert.equal(result.headers.get('location'), `${origin}/`);
    assert.equal(tokenChecks.subject, true); assert.equal(tokenChecks.nonce, true);
    assert.equal(result.headers.get('cache-control'), 'no-store'); assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(result.headers.getSetCookie().length, 2);
    sessionCookie = result.headers.getSetCookie().find((value) => value.startsWith('__Host-steer-session='))!.split(';')[0]!;
    assert.equal(transactions.size, 0); assert.equal(sessions.size, 1);
    assert.equal([...sessions.values()][0]!.subject, deps.subject);
    assert.ok(!JSON.stringify([...result.headers]).includes([...sessions.values()][0]!.accessToken));
    const context = await request('/v1/tools/session.context', { method: 'POST', headers: {
      origin, cookie: sessionCookie, 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: 'synthetic-org' }) });
    assert.equal(context.status, 200);
    const principal = await context.json(); assert.equal(principal.subject, deps.subject); assert.deepEqual(principal.hats, ['product-lead']);
  });
  const call = (organizationId = 'synthetic-org') => request('/v1/tools/session.context', { method: 'POST',
    headers: { origin, cookie: sessionCookie, 'content-type': 'application/json' }, body: JSON.stringify({ organizationId }) });
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
    assert.equal(sessions.size, 0); assert.equal((await call()).status, 401);
  });
  await check('Keycloak denies a corrupted PKCE verifier and a wrong confidential client secret', async () => {
    const start = await begin(); const code = await providerLogin(start.auth);
    for (const value of transactions.values()) value.verifier = randomBytes(32).toString('base64url');
    assert.equal((await request(code.href, { headers: { cookie: start.loginCookie } })).status, 400);
    assert.equal(tokenChecks.status, 400);
    assert.equal(transactions.size, 0); assert.equal(sessions.size, 0);
    const wrongClient = createBrowserApi({ ...configuration, clientSecret: randomBytes(32).toString('hex') }, dependencies);
    const other = await begin(wrongClient); const otherCode = await providerLogin(other.auth);
    const failed = await wrongClient.request(otherCode.href, { headers: { cookie: other.loginCookie } });
    assert.equal(failed.status, 400); assert.equal(sessions.size, 0);
    assert.equal(tokenChecks.status, 401);
    assert.equal(await failed.text(), JSON.stringify({ error: { code: 'SIGN_IN_FAILED', message: 'The sign-in operation could not be completed.' } }));
  });
}
