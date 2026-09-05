import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { BrowserSessionStore, LoginTransaction, BrowserSession } from '@steer/adapters/browser-session';
import { createBrowserApi } from '../src/browser.ts';
import { createApi } from '../src/app.ts';

const origin = 'https://steer.example';
const configuration = { issuer: 'https://id.example/realm', jwksUri: 'https://id.example/jwks',
  authorizationEndpoint: 'https://id.example/auth', tokenEndpoint: 'https://id.example/token',
  redirectUri: `${origin}/auth/callback`, clientId: 'steer-web',
  clientSecret: 'synthetic-test-secret-not-a-real-credential', audience: 'steer-api' };
const keys = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(keys.publicKey), kid: 'synthetic', alg: 'RS256' };
const pair = (value: string) => value.split(';')[0]!;
const mutation = { origin, 'sec-fetch-site': 'same-origin' };
function fixture() {
  const transactions = new Map<string, LoginTransaction>(); const sessions = new Map<string, BrowserSession>();
  let active = true; let time = Date.parse('2026-09-05T03:32:00Z');
  let nonce = ''; let exchanges = 0; let access = ''; let failExchange = false; let failDelete = false;
  const store: BrowserSessionStore = {
    insertTransaction: async (key, value) => { if (transactions.has(key)) return false; transactions.set(key, value); return true; },
    consumeTransaction: async (key) => { const value = transactions.get(key); transactions.delete(key); return value; },
    insertSession: async (key, value) => { if (sessions.has(key)) return false; sessions.set(key, value); return true; },
    readSession: async (key) => sessions.get(key),
    deleteSession: async (key) => { if (failDelete) throw new Error('secret-storage-exception'); sessions.delete(key); },
  };
  const app = createBrowserApi(configuration, { store, now: () => new Date(time),
    resolveAuthorization: async () => ({ issuer: configuration.issuer, subject: 'human-1', organizationId: 'org-a',
      type: 'human', hats: ['product-lead'], toolGrants: ['session.context'], active,
      validAfter: new Date(time - 1000).toISOString(), expiresAt: new Date(time + 180000).toISOString() }),
    fetch: async (input) => {
      if (String(input) === configuration.jwksUri) return Response.json({ keys: [jwk] });
      assert.equal(String(input), configuration.tokenEndpoint); exchanges++;
      if (failExchange) throw new Error('secret-provider-exception');
      const common = { iss: configuration.issuer, sub: 'human-1', iat: time / 1000, exp: time / 1000 + 180 };
      const sign = (claims: Record<string, unknown>) => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'synthetic' }).sign(keys.privateKey);
      access = await sign({ ...common, aud: configuration.audience, typ: 'Bearer', azp: configuration.clientId,
        steer_org: 'org-a', steer_kind: 'human', steer_hats: ['product-lead'] });
      return Response.json({ access_token: access, id_token: await sign({ ...common, aud: configuration.clientId, nonce }), token_type: 'Bearer' });
    },
  });
  const request = (path: string, init?: RequestInit) => app.request(new URL(path, origin).href, init);
  const begin = async () => {
    const response = await request('/auth/login', { method: 'POST', headers: mutation });
    assert.equal(response.status, 303);
    const auth = new URL(response.headers.get('location')!); nonce = auth.searchParams.get('nonce')!;
    const callback = new URL(configuration.redirectUri);
    callback.search = new URLSearchParams({ code: 'synthetic-code', state: auth.searchParams.get('state')!, iss: configuration.issuer }).toString();
    return { response, auth, callback, loginCookie: pair(response.headers.getSetCookie()[0]!) };
  };
  const login = async () => {
    const started = await begin(); const response = await request(started.callback.href,
      { headers: { cookie: started.loginCookie, 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' } });
    assert.equal(response.status, 303);
    return { ...started, response, sessionCookie: pair(response.headers.getSetCookie().find((value) => value.startsWith('__Host-steer-session='))!) };
  };
  const tool = (cookie: string, overrides: Record<string, string> = {}, organizationId = 'org-a') => request('/v1/tools/session.context', {
    method: 'POST', headers: { ...mutation, cookie, 'content-type': 'application/json', ...overrides }, body: JSON.stringify({ organizationId }),
  });
  return { request, begin, login, tool, transactions, sessions, store,
    stats: () => ({ exchanges, access }), revoke: () => { active = false; }, expire: () => { time += 180000; },
    failExchange: () => { failExchange = true; }, failDelete: () => { failDelete = true; } };
}

function secure(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('content-security-policy')!, /default-src 'none'/);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
}

test('HTTP login/callback/tool/logout keeps tokens server-side and sets separate secure cookies', async () => {
  const f = fixture(); const login = await f.login(); secure(login.response);
  assert.equal(login.auth.origin, 'https://id.example'); assert.equal(login.auth.pathname, '/auth');
  assert.equal(login.auth.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(login.auth.searchParams.has('code_verifier'), false);
  assert.equal(login.response.headers.get('location'), `${origin}/`);
  const cookies = login.response.headers.getSetCookie(); assert.equal(cookies.length, 2);
  for (const cookie of cookies) { assert.match(cookie, /; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=/); assert.ok(!cookie.includes('Domain=')); }
  assert.match(cookies[0]!, /^__Host-steer-login=;/);
  const result = await f.tool(login.sessionCookie); secure(result); assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).hats, ['product-lead']);
  assert.equal((await f.tool(login.sessionCookie, {}, 'org-b')).status, 403);
  assert.ok(!JSON.stringify([...login.response.headers]).includes(f.stats().access));
  assert.ok(!(await login.response.text()).includes('synthetic-code'));
  const rejectedLogout = await f.request('/auth/logout', { method: 'POST', headers: { origin: 'https://evil.example', cookie: login.sessionCookie } });
  assert.equal(rejectedLogout.status, 403); assert.equal(f.sessions.size, 1);
  assert.equal((await f.tool(login.sessionCookie)).status, 200);
  const logout = await f.request('/auth/logout', { method: 'POST', headers: { ...mutation, cookie: login.sessionCookie } });
  secure(logout); assert.equal(logout.status, 303); assert.equal(logout.headers.get('location'), `${origin}/`);
  assert.equal(logout.headers.getSetCookie().length, 2); assert.equal(f.sessions.size, 0);
  assert.equal((await f.tool(login.sessionCookie)).status, 401);
});

test('auth mutations require exact Origin and reject cross-site or sibling-site Fetch Metadata', async () => {
  const f = fixture();
  for (const path of ['/auth/login', '/auth/logout']) {
    for (const headers of [{}, { origin: 'null' }, { origin: 'https://evil.example' },
      { origin: `${origin}.evil.example` }, { origin, 'sec-fetch-site': 'cross-site' },
      { origin, 'sec-fetch-site': 'same-site' }, { origin, 'sec-fetch-site': 'none' }]) {
      const result = await f.request(path, { method: 'POST', headers: headers as Record<string, string> });
      assert.equal(result.status, 403); secure(result); assert.equal(result.headers.getSetCookie().length, 0);
    }
  }
  assert.equal(f.transactions.size, 0); assert.equal(f.sessions.size, 0);
  assert.equal((await f.request('/auth/login', { method: 'POST', headers: { origin } })).status, 303);
});

test('wrong methods including implicit HEAD never create, consume or delete state', async () => {
  const f = fixture(); const start = await f.begin();
  for (const path of ['/auth/login', '/auth/logout', start.callback.href]) {
    for (const method of path === start.callback.href ? ['POST', 'HEAD', 'OPTIONS'] : ['GET', 'HEAD', 'OPTIONS', 'PUT']) {
      const result = await f.request(path, { method, headers: { ...mutation, cookie: start.loginCookie } });
      assert.equal(result.status, 405); assert.equal(result.headers.getSetCookie().length, 0);
      assert.equal(result.headers.get('allow'), path === start.callback.href ? 'GET' : 'POST'); secure(result);
    }
  }
  assert.equal(f.transactions.size, 1); assert.equal(f.stats().exchanges, 0);
});

test('canonical origin, query and actual body checks cannot be bypassed by forwarding or Content-Length', async () => {
  const f = fixture();
  for (const target of ['http://steer.example/auth/login', 'https://evil.example/auth/login']) {
    assert.equal((await f.request(target, { method: 'POST', headers: { ...mutation, 'x-forwarded-host': 'steer.example', 'x-forwarded-proto': 'https' } })).status, 403);
  }
  for (const path of ['/auth/login', '/auth/logout']) {
    const query = await f.request(`${path}?returnTo=https://evil.example`, { method: 'POST', headers: mutation });
    assert.equal(query.status, 403); assert.equal(query.headers.get('location'), null);
    const body = await f.request(path, { method: 'POST', headers: { ...mutation, 'content-length': '0' }, body: 'nonempty' });
    assert.equal(body.status, 400); assert.equal(body.headers.getSetCookie().length, 0);
  }
  assert.equal(f.transactions.size, 0);
});

test('callback replay, missing browser binding and injected provider errors fail without reflecting secrets', async () => {
  const f = fixture(); const login = await f.login();
  const replay = await f.request(login.callback.href, { headers: { cookie: login.loginCookie } });
  assert.equal(replay.status, 400); assert.equal(f.stats().exchanges, 1); secure(replay);
  assert.match(replay.headers.getSetCookie()[0]!, /^__Host-steer-login=;/);
  assert.equal((await f.tool(login.sessionCookie)).status, 200);
  const unbound = await f.begin();
  assert.equal((await f.request(unbound.callback.href)).status, 400); assert.equal(f.stats().exchanges, 1);
  const injected = await f.request('/auth/callback?error=access_denied&error_description=secret-provider-exception&returnTo=https://evil.example');
  assert.equal(injected.status, 400); assert.equal(injected.headers.get('location'), null);
  assert.equal(await injected.text(), JSON.stringify({ error: { code: 'SIGN_IN_FAILED', message: 'The sign-in operation could not be completed.' } }));
});

test('cookie tool calls enforce CSRF, reject duplicates/mixed credentials and recheck current revocation', async () => {
  const f = fixture(); const login = await f.login();
  for (const headers of [{ origin: '' }, { origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'same-site' }, { authorization: `Bearer ${f.stats().access}` }]) {
    assert.equal((await f.tool(login.sessionCookie, headers)).status, 401);
  }
  assert.equal((await f.tool(`${login.sessionCookie}; ${login.sessionCookie}`)).status, 401);
  const bearer = await f.request('/v1/tools/session.context', { method: 'POST', headers: {
    authorization: `Bearer ${f.stats().access}`, 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: 'org-a' }) });
  assert.equal(bearer.status, 200);
  f.revoke(); assert.equal((await f.tool(login.sessionCookie)).status, 401);
});

test('expired sessions and provider/storage exceptions fail closed without secret-bearing errors', async () => {
  const f = fixture(); const start = await f.begin(); f.failExchange();
  const failed = await f.request(start.callback.href, { headers: { cookie: start.loginCookie } });
  assert.equal(failed.status, 400); assert.ok(!(await failed.text()).includes('secret-provider-exception')); secure(failed);
  const g = fixture(); const login = await g.login(); g.failDelete();
  const logout = await g.request('/auth/logout', { method: 'POST', headers: { ...mutation, cookie: login.sessionCookie } });
  assert.equal(logout.status, 400); assert.equal(logout.headers.getSetCookie().length, 0);
  assert.ok(!(await logout.text()).includes('secret-storage-exception')); assert.equal(g.sessions.size, 1);
  g.expire(); assert.equal((await g.tool(login.sessionCookie)).status, 401);
});

test('default API does not expose auth routes; composed readiness still does not claim real integration', async () => {
  const plain = createApi();
  for (const path of ['/auth/login', '/auth/callback', '/auth/logout']) assert.equal((await plain.request(path, { method: 'POST' })).status, 404);
  const f = fixture(); assert.equal((await f.request('/health/ready')).status, 503);
  const unknown = await f.request('/auth/not-a-route?secret=do-not-reflect');
  assert.equal(unknown.status, 404); secure(unknown); assert.ok(!(await unknown.text()).includes('do-not-reflect'));
});

test('browser OpenAPI adds cookie/route contracts without changing shared tool schemas or default API', async () => {
  const base = await (await createApi().request('/openapi.json')).json();
  const f = fixture(); const response = await f.request('/openapi.json'); secure(response);
  const browser = await response.json();
  assert.equal(base.paths['/auth/login'], undefined);
  assert.equal(base.components.securitySchemes.browserSession, undefined);
  assert.equal(browser.components.securitySchemes.browserSession.name, '__Host-steer-session');
  for (const path of ['/auth/login', '/auth/logout']) assert.equal(browser.paths[path].post.parameters[0].name, 'Origin');
  assert.deepEqual(browser.paths['/auth/callback'].get.security, [{ loginBinding: [] }]);
  const tool = '/v1/tools/session.context';
  assert.deepEqual(browser.paths[tool].post.requestBody, base.paths[tool].post.requestBody);
  assert.deepEqual(browser.paths[tool].post.security, [{ bearerAuth: [] }, { browserSession: [] }]);
  assert.ok(!JSON.stringify(browser).includes(configuration.clientSecret));
});
