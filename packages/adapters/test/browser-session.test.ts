import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createBrowserSessionBroker, BrowserSessionError, type BrowserSessionStore,
  type LoginTransaction, type BrowserSession } from '../src/identity/browser-session.ts';

const keys = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(keys.publicKey), kid: 'test', alg: 'RS256' };
const config = { issuer: 'https://id.example/realms/test', jwksUri: 'https://id.example/jwks',
  authorizationEndpoint: 'https://id.example/auth', tokenEndpoint: 'https://id.example/token',
  redirectUri: 'https://steer.example/auth/callback', clientId: 'steer-web',
  clientSecret: 'synthetic-secret-at-least-32-characters', audience: 'steer-api' };
const cookie = (header: string) => header.split(';')[0]!;
async function fixture() {
  let time = Date.parse('2026-09-05T03:00:00Z');
  const transactions = new Map<string, LoginTransaction>(); const sessions = new Map<string, BrowserSession>();
  const store: BrowserSessionStore = {
    insertTransaction: async (key, value) => { if (transactions.has(key)) return false; transactions.set(key, value); return true; },
    consumeTransaction: async (key) => { const value = transactions.get(key); transactions.delete(key); return value; },
    insertSession: async (key, value) => { if (sessions.has(key)) return false; sessions.set(key, value); return true; },
    readSession: async (key) => sessions.get(key), deleteSession: async (key) => { sessions.delete(key); },
  };
  let grant = { issuer: config.issuer, subject: 'human-1', organizationId: 'org-a', type: 'human',
    hats: ['product-lead'], toolGrants: ['session.context'], active: true,
    validAfter: new Date(time - 1000).toISOString(), expiresAt: new Date(time + 180000).toISOString() };
  let nonce = ''; let exchanges = 0; let lookupCount = 0;
  let lastBody = new URLSearchParams(); let lastOptions: RequestInit = {};
  let idChanges: Record<string, unknown> = {}; let accessChanges: Record<string, unknown> = {};
  let responseOverride: Response | undefined; let lastAccess = '';
  const token = (claims: Record<string, unknown>) => new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(keys.privateKey);
  const dependencies = { store, now: () => new Date(time), resolveAuthorization: async () => { lookupCount++; return grant; },
    fetch: (async (input, options) => {
      const url = String(input);
      if (url === config.jwksUri) return Response.json({ keys: [jwk] });
      assert.equal(url, config.tokenEndpoint); exchanges++;
      lastOptions = options ?? {}; lastBody = new URLSearchParams(String(options?.body));
      if (responseOverride) return responseOverride;
      const epoch = Math.floor(time / 1000);
      const common = { iss: config.issuer, sub: 'human-1', iat: epoch, exp: epoch + 180 };
      lastAccess = await token({ ...common, aud: config.audience, azp: config.clientId, typ: 'Bearer',
        steer_org: 'org-a', steer_kind: 'human', steer_hats: ['product-lead'], ...accessChanges });
      const id = await token({ ...common, aud: config.clientId, nonce,
        at_hash: createHash('sha256').update(lastAccess).digest().subarray(0, 16).toString('base64url'), ...idChanges });
      return Response.json({ access_token: lastAccess, id_token: id, token_type: 'Bearer', refresh_token: 'must-not-be-retained' });
    }) as typeof fetch };
  const broker = createBrowserSessionBroker(config, dependencies);
  const begin = async () => {
    const login = await broker.begin('https://steer.example'); const auth = new URL(login.authorizationUrl);
    nonce = auth.searchParams.get('nonce')!;
    const callback = new URL(config.redirectUri);
    callback.search = new URLSearchParams({ code: 'synthetic-code', state: auth.searchParams.get('state')!, iss: config.issuer }).toString();
    return { ...login, auth, callback, browserCookie: cookie(login.setCookie) };
  };
  const login = async () => { const start = await begin(); const result = await broker.complete(start.callback.href, start.browserCookie);
    return { ...start, result, sessionCookie: cookie(result.setCookies[1]!) }; };
  return { broker, store, dependencies, transactions, sessions, begin, login,
    stats: () => ({ exchanges, lookupCount, lastBody, lastOptions, lastAccess }),
    advance: (milliseconds: number) => { time += milliseconds; },
    grant: (patch: Partial<typeof grant>) => { grant = { ...grant, ...patch }; },
    id: (patch: Record<string, unknown>) => { idChanges = patch; },
    access: (patch: Record<string, unknown>) => { accessChanges = patch; },
    response: (response: Response) => { responseOverride = response; } };
}

test('PKCE transaction is browser-bound, confidential and opaque; provider tokens stay server-side', async () => {
  const f = await fixture(); const start = await f.begin(); const transaction = [...f.transactions.values()][0]!;
  assert.equal(start.auth.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(start.auth.searchParams.get('scope'), 'openid');
  assert.equal(start.auth.searchParams.get('code_challenge'), createHash('sha256').update(transaction.verifier).digest('base64url'));
  assert.equal(start.auth.searchParams.has('code_verifier'), false);
  assert.equal(new Set([transaction.verifier, transaction.nonce, start.auth.searchParams.get('state'), start.browserCookie.split('=')[1]]).size, 4);
  assert.match(start.setCookie, /^__Host-steer-login=.*; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=300$/);
  const result = await f.broker.complete(start.callback.href, start.browserCookie);
  const stats = f.stats();
  assert.equal(stats.lastBody.get('code_verifier'), transaction.verifier);
  assert.equal(stats.lastBody.get('grant_type'), 'authorization_code');
  assert.equal(stats.lastBody.get('redirect_uri'), config.redirectUri);
  assert.equal(stats.lastBody.has('client_secret'), false);
  assert.match(new Headers(stats.lastOptions.headers).get('authorization')!, /^Basic /);
  assert.equal(stats.lastOptions.redirect, 'error');
  assert.equal(JSON.stringify(result).includes(stats.lastAccess), false);
  assert.equal(JSON.stringify([...f.sessions.values()]).includes('must-not-be-retained'), false);
  assert.equal(f.transactions.size, 0);
  assert.ok(await f.broker.authenticate(cookie(result.setCookies[1]!)));
});

test('concurrent callback replay exchanges once and cannot fix the new session identifier', async () => {
  const f = await fixture(); const start = await f.begin();
  const results = await Promise.allSettled([f.broker.complete(start.callback.href, start.browserCookie), f.broker.complete(start.callback.href, start.browserCookie)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(f.stats().exchanges, 1); assert.equal(f.sessions.size, 1);
  await assert.rejects(f.broker.complete(start.callback.href, start.browserCookie), BrowserSessionError);
});

test('wrong browser, expired state, duplicate parameters, changed callback and issuer deny before token exchange', async () => {
  for (const variant of ['browser', 'expired', 'duplicate', 'callback', 'issuer', 'error']) {
    const f = await fixture(); const start = await f.begin(); let header = start.browserCookie;
    if (variant === 'browser') header = '__Host-steer-login=' + 'a'.repeat(43);
    if (variant === 'expired') f.advance(300000);
    if (variant === 'duplicate') start.callback.searchParams.append('code', 'another');
    if (variant === 'callback') start.callback.pathname = '/unregistered';
    if (variant === 'issuer') start.callback.searchParams.set('iss', 'https://attacker.example');
    if (variant === 'error') start.callback.searchParams.set('error', 'provider-error');
    await assert.rejects(f.broker.complete(start.callback.href, header), BrowserSessionError);
    assert.equal(f.stats().exchanges, 0); assert.equal(f.sessions.size, 0);
  }
});

test('nonce, subject, audience, authorized party and access hash substitution cannot mint sessions', async () => {
  for (const patch of [{ nonce: 'wrong' }, { sub: 'another-human' }, { aud: 'another-client' },
    { azp: 'another-client' }, { aud: [config.clientId, 'another-client'] }, { at_hash: 'wrong' }]) {
    const f = await fixture(); f.id(patch); const start = await f.begin();
    await assert.rejects(f.broker.complete(start.callback.href, start.browserCookie), BrowserSessionError);
    assert.equal(f.sessions.size, 0);
  }
});

test('an agent or revoked/mismatched access identity never becomes a browser human', async () => {
  for (const variant of ['agent', 'revoked', 'subject', 'audience']) {
    const f = await fixture();
    if (variant === 'agent') { f.access({ steer_kind: 'agent', steer_hats: [] }); f.grant({ type: 'agent', hats: [] }); }
    if (variant === 'revoked') f.grant({ active: false });
    if (variant === 'subject') f.access({ sub: 'another-human' });
    if (variant === 'audience') f.access({ aud: 'another-api' });
    const start = await f.begin();
    await assert.rejects(f.broker.complete(start.callback.href, start.browserCookie), BrowserSessionError);
    assert.equal(f.sessions.size, 0);
  }
});

test('session grants are fresh and cannot survive revocation, tenant change or precise expiry', async () => {
  const f = await fixture(); const login = await f.login();
  assert.ok(await f.broker.authenticate(login.sessionCookie));
  f.grant({ active: false }); assert.equal(await f.broker.authenticate(login.sessionCookie), null);
  f.grant({ active: true, organizationId: 'org-b' }); assert.equal(await f.broker.authenticate(login.sessionCookie), null);
  f.grant({ organizationId: 'org-a' }); f.advance(180000);
  assert.equal(await f.broker.authenticate(login.sessionCookie), null);
});

test('same-origin logout deletes session and rejects replay; duplicate cookies fail closed', async () => {
  const f = await fixture(); const login = await f.login();
  assert.equal(await f.broker.authenticate(`${login.sessionCookie}; ${login.sessionCookie}`), null);
  await assert.rejects(f.broker.logout(login.sessionCookie, 'https://attacker.example'), BrowserSessionError);
  assert.ok(await f.broker.authenticate(login.sessionCookie));
  const out = await f.broker.logout(login.sessionCookie, 'https://steer.example');
  assert.ok(out.setCookies.every((header) => header.endsWith('Max-Age=0')));
  assert.equal(await f.broker.authenticate(login.sessionCookie), null);
});

test('origin/configuration and storage failures deny without provider calls or exception content', async () => {
  const f = await fixture();
  await assert.rejects(f.broker.begin(null), BrowserSessionError);
  await assert.rejects(f.broker.begin('https://attacker.example'), BrowserSessionError);
  assert.throws(() => createBrowserSessionBroker({ ...config, tokenEndpoint: 'https://attacker.example/token' }, f.dependencies), BrowserSessionError);
  assert.throws(() => createBrowserSessionBroker({ ...config, redirectUri: 'http://steer.example/callback' }, f.dependencies), BrowserSessionError);
  f.store.insertTransaction = async () => { throw new Error('sensitive backend error'); };
  await assert.rejects(f.broker.begin('https://steer.example'), { message: 'The sign-in operation could not be completed.' });
  assert.equal(f.stats().exchanges, 0);
});

test('actual token response bytes are bounded and no provider error body reaches the caller', async () => {
  for (const response of [new Response('x'.repeat(65537)), new Response('sensitive provider failure', { status: 500 }),
    Response.json({ access_token: 'not-a-jwt', id_token: 'not-a-jwt', token_type: 'Bearer' })]) {
    const f = await fixture(); f.response(response); const start = await f.begin();
    await assert.rejects(f.broker.complete(start.callback.href, start.browserCookie), { message: 'The sign-in operation could not be completed.' });
    assert.equal(f.sessions.size, 0);
  }
});

test('session deletion or grant expiry during async verification cannot return a usable principal', async () => {
  const f = await fixture(); const login = await f.login();
  const originalLookup = f.dependencies.resolveAuthorization;
  f.dependencies.resolveAuthorization = async () => {
    const grant = await originalLookup(); f.sessions.clear(); return grant;
  };
  assert.equal(await f.broker.authenticate(login.sessionCookie), null);
  const g = await fixture(); const second = await g.login();
  const originalRead = g.store.readSession; let reads = 0;
  g.store.readSession = async (key) => {
    const session = await originalRead(key); if (++reads === 2) g.advance(180000); return session;
  };
  assert.equal(await g.broker.authenticate(second.sessionCookie), null);
});

test('an ID token signed by an untrusted key is rejected before authorization lookup', async () => {
  const f = await fixture(); const start = await f.begin();
  const attacker = await generateKeyPair('RS256');
  const epoch = Date.parse('2026-09-05T03:00:00Z') / 1000;
  const id = await new SignJWT({ iss: config.issuer, sub: 'human-1', aud: config.clientId,
    nonce: start.auth.searchParams.get('nonce'), iat: epoch, exp: epoch + 180 })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(attacker.privateKey);
  f.response(Response.json({ access_token: 'not-used', id_token: id, token_type: 'Bearer' }));
  await assert.rejects(f.broker.complete(start.callback.href, start.browserCookie), BrowserSessionError);
  assert.equal(f.stats().lookupCount, 0); assert.equal(f.sessions.size, 0);
});
