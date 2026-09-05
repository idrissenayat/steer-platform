import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { createOidcAuthenticator, type AuthorizationRecord } from '../src/identity/oidc.ts';

const time = new Date('2026-09-04T12:00:00Z');
const seconds = time.getTime() / 1000;
const config = {
  issuer: 'https://identity.example/realms/steer', jwksUri: 'https://identity.example/realms/steer/protocol/openid-connect/certs',
  audience: 'steer-api', clientIds: ['steer-web'], maxTokenAgeSeconds: 300,
};
const keys = await generateKeyPair('RS256');
const unknownKeys = await generateKeyPair('RS256');
const publicKey = { ...await exportJWK(keys.publicKey), kid: 'key-1', alg: 'RS256', use: 'sig' };
const jwksFetch: typeof fetch = async (url, options) => {
  assert.equal(String(url), config.jwksUri);
  assert.equal(options?.redirect, 'error');
  return Response.json({ keys: [publicKey] });
};
const claims: JWTPayload = {
  iss: config.issuer, sub: 'human-1', aud: config.audience, iat: seconds, exp: seconds + 120,
  azp: 'steer-web', typ: 'Bearer', steer_org: 'org-a', steer_kind: 'human', steer_hats: ['product-lead'],
};
const grant: AuthorizationRecord = {
  issuer: config.issuer, subject: 'human-1', organizationId: 'org-a', type: 'human',
  hats: ['product-lead'], toolGrants: ['session.context'], active: true,
  expiresAt: new Date(time.getTime() + 60000).toISOString(), validAfter: new Date(time.getTime() - 60000).toISOString(),
};
const sign = (payload: JWTPayload = claims, key = keys.privateKey, kid = 'key-1') =>
  new SignJWT(payload).setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid }).sign(key);
const request = (token: string) => new Request('https://api.example/v1/tools/session.context', {
  headers: { authorization: `Bearer ${token}` },
});
const create = (record: unknown = grant) => createOidcAuthenticator(config, {
  now: () => time, fetch: jwksFetch,
  resolveAuthorization: async (lookup) => {
    assert.deepEqual(lookup, { issuer: config.issuer, subject: 'human-1', organizationId: 'org-a' });
    return record;
  },
});

test('verified token is normalized only after current issuer/subject/organization grants resolve', async () => {
  const result = await create()(request(await sign()));
  assert.deepEqual(result, {
    subject: 'human-1', organizationId: 'org-a', type: 'human', hats: ['product-lead'],
    toolGrants: ['session.context'], expiresAt: grant.expiresAt,
  });
});

test('signature, key, issuer, audience, client and access-token kind are enforced', async () => {
  const authenticate = create();
  for (const change of [
    { iss: 'https://other.example' }, { aud: 'other-api' }, { azp: 'other-client' },
    { typ: 'ID' }, { steer_kind: 'admin' }, { steer_hats: ['super-admin'] }, { sub: ' human-1' },
  ]) assert.equal(await authenticate(request(await sign({ ...claims, ...change }))), null);
  assert.equal(await authenticate(request(await sign(claims, unknownKeys.privateKey))), null);
  assert.equal(await authenticate(request(await sign(claims, keys.privateKey, 'unknown-key'))), null);
  const unsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.`;
  assert.equal(await authenticate(request(unsigned)), null);
  const hmac = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(new Uint8Array(32));
  assert.equal(await authenticate(request(hmac)), null);
});

test('required claims, strict lifetime, expiry, not-before and future issued-at fail closed', async () => {
  const authenticate = create();
  for (const name of ['iss', 'sub', 'aud', 'iat', 'exp', 'azp', 'typ', 'steer_org', 'steer_kind', 'steer_hats']) {
    const payload = { ...claims }; delete payload[name];
    assert.equal(await authenticate(request(await sign(payload))), null, name);
  }
  for (const change of [
    { exp: seconds }, { exp: seconds - 1 }, { iat: seconds + 1 }, { nbf: seconds + 1 },
    { exp: seconds + 301 }, { iat: seconds - 301, exp: seconds + 1 }, { exp: seconds + 0.5 },
  ]) assert.equal(await authenticate(request(await sign({ ...claims, ...change }))), null);
});

test('missing, invalid, disabled, transplanted and stale authorization records deny', async () => {
  const token = request(await sign());
  for (const record of [null, {}, { ...grant, active: false }, { ...grant, subject: 'human-2' },
    { ...grant, issuer: 'https://other.example' }, { ...grant, organizationId: 'org-b' },
    { ...grant, type: 'agent' }, { ...grant, expiresAt: time.toISOString() },
    { ...grant, validAfter: new Date(time.getTime() + 1).toISOString() },
  ]) assert.equal(await create(record)(token), null);
});

test('authorization is refreshed on every request, including revocation after a successful request', async () => {
  let calls = 0;
  const authenticate = createOidcAuthenticator(config, {
    now: () => time, fetch: jwksFetch,
    resolveAuthorization: async () => ({ ...grant, active: ++calls === 1 }),
  });
  const token = request(await sign());
  assert.ok(await authenticate(token));
  assert.equal(await authenticate(token), null);
  assert.equal(calls, 2);
});

test('token grants and stale token hats cannot expand current authorization or expiry', async () => {
  const token = await sign({ ...claims, steer_hats: ['product-lead', 'product-designer'], toolGrants: ['delete.everything'] });
  const result = await create()(request(token));
  assert.deepEqual(result?.hats, ['product-lead']);
  assert.deepEqual(result?.toolGrants, ['session.context']);
  const tokenLimited = await create({ ...grant, expiresAt: new Date(time.getTime() + 600000).toISOString() })(request(token));
  assert.equal(tokenLimited?.expiresAt, new Date((seconds + 120) * 1000).toISOString());
  const removedHat = await create({ ...grant, hats: [] })(request(token));
  assert.deepEqual(removedHat?.hats, []);
});

test('agent identities are exact-kind bound and cannot claim human hats', async () => {
  const agentGrant = { ...grant, type: 'agent', hats: [] };
  const agentToken = { ...claims, steer_kind: 'agent', steer_hats: [] };
  assert.equal((await create(agentGrant)(request(await sign(agentToken))))?.type, 'agent');
  assert.equal(await create(agentGrant)(request(await sign({ ...agentToken, steer_hats: ['product-lead'] }))), null);
  assert.equal(await create({ ...agentGrant, hats: ['product-lead'] })(request(await sign(agentToken))), null);
});

test('invalid configuration and malformed/oversized headers never invoke a provider', async () => {
  for (const change of [{ issuer: 'http://identity.example' }, { jwksUri: 'https://user:password@identity.example/certs' },
    { jwksUri: 'https://identity.example/certs#fragment' }, { clientIds: [] }, { audience: '' }, { maxTokenAgeSeconds: 0 },
  ]) assert.throws(() => createOidcAuthenticator({ ...config, ...change }, { resolveAuthorization: async () => grant }), /Invalid OIDC configuration/);
  let calls = 0;
  const authenticate = createOidcAuthenticator(config, { fetch: async () => { calls++; throw new Error('must-not-fetch'); }, resolveAuthorization: async () => grant });
  for (const header of ['', 'Basic abc', 'Bearer abc', 'Bearer a.b.c extra', `Bearer ${'a'.repeat(17000)}.b.c`]) {
    assert.equal(await authenticate(new Request('https://api.example', { headers: { authorization: header } })), null);
  }
  assert.equal(calls, 0);
});

test('configured JWKS is cached and network or grant failures deny without exception content', async () => {
  let calls = 0;
  const authenticate = createOidcAuthenticator(config, {
    now: () => time, fetch: async (...args) => { calls++; return jwksFetch(...args); }, resolveAuthorization: async () => grant,
  });
  const token = request(await sign());
  assert.ok(await authenticate(token)); assert.ok(await authenticate(token)); assert.equal(calls, 1);
  const networkFailure = createOidcAuthenticator(config, {
    now: () => time, fetch: async () => { throw new Error('private-provider-value'); }, resolveAuthorization: async () => grant,
  });
  assert.equal(await networkFailure(token), null);
  const grantFailure = createOidcAuthenticator(config, {
    now: () => time, fetch: jwksFetch, resolveAuthorization: async () => { throw new Error('private-record-value'); },
  });
  assert.equal(await grantFailure(token), null);
});

test('identity cannot expire during authorization lookup or survive an invalid clock', async () => {
  let calls = 0;
  const authenticate = createOidcAuthenticator(config, {
    now: () => new Date(time.getTime() + (calls++ ? 120000 : 0)), fetch: jwksFetch, resolveAuthorization: async () => grant,
  });
  assert.equal(await authenticate(request(await sign())), null);
  const invalidClock = createOidcAuthenticator(config, { now: () => new Date('invalid'), fetch: jwksFetch, resolveAuthorization: async () => grant });
  assert.equal(await invalidClock(request(await sign())), null);
});
