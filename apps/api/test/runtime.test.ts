import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { createIdentityRuntime, startLocalIdentityRuntime } from '../src/runtime.ts';
import { createLocalTlsHarness, reserveLocalPort, localHttpsRequest } from './local-tls-harness.ts';

const profile = { version: 'steer-identity-runtime/v1',
  browser: { issuer: 'https://id.example/realm', jwksUri: 'https://id.example/jwks',
    authorizationEndpoint: 'https://id.example/auth', tokenEndpoint: 'https://id.example/token',
    redirectUri: 'https://steer.example/auth/callback', clientId: 'steer-web', audience: 'steer-api' },
  github: { appId: '1', authorizationPath: 'access/authorization.json', binding: {
    organizationId: 'synthetic', installationId: 1, repositoryId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' } },
  database: { host: '127.0.0.1', port: 5432, database: 'synthetic', transport: { kind: 'isolated-loopback-test' } },
  sessionKeyId: 'synthetic',
};
const secrets = { browserClientSecret: 'synthetic-not-a-real-client-secret', databasePassword: 'synthetic-not-a-real-password',
  githubPrivateKeyPem: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  sessionKeys: { synthetic: randomBytes(32) } };

test('runtime constructs real components lazily without provider access, implicit login or readiness approval', async () => {
  let requests = 0;
  const transport: typeof fetch = async () => { requests++; throw new Error('must-not-contact-provider'); };
  const runtime = await createIdentityRuntime(profile, secrets, { identity: transport, github: transport });
  try {
    assert.equal(runtime.status().state, 'running'); assert.equal(runtime.status().database.connections, 0);
    assert.equal((await runtime.fetch(new Request('https://steer.example/health/ready'))).status, 503);
    assert.equal((await runtime.fetch(new Request('https://steer.example/v1/tools/session.context', { method: 'POST' }))).status, 401);
    assert.equal(requests, 0); assert.equal(runtime.status().database.connections, 0);
    assert.ok(!JSON.stringify(runtime.status()).includes(secrets.databasePassword));
  } finally { await runtime.shutdown(); }
  assert.equal(runtime.status().state, 'stopped'); assert.equal(runtime.status().database.closed, true);
});

test('runtime strictly rejects malformed profiles, secret injection and downstream configuration with generic errors', async () => {
  for (const invalid of [{}, { ...profile, version: 'other' }, { ...profile, extra: secrets.databasePassword },
    { ...profile, browser: { ...profile.browser, clientSecret: secrets.browserClientSecret } },
    { ...profile, browser: { ...profile.browser, tokenEndpoint: 'https://foreign.example/token' } },
    { ...profile, github: { ...profile.github, authorizationPath: '../membership' } },
    { ...profile, database: { ...profile.database, user: 'postgres' } },
    { ...profile, database: { ...profile.database, host: 'remote.example' } }, { ...profile, sessionKeyId: 'missing' }]) {
    await assert.rejects(createIdentityRuntime(invalid, secrets), /^Error: Identity runtime configuration could not be initialized\.$/);
  }
  for (const invalid of [{ ...secrets, sessionKeys: { synthetic: randomBytes(4) } },
    { ...secrets, githubPrivateKeyPem: 'secret-invalid-key' }, { ...secrets, browserClientSecret: 'short' }, { ...secrets, extra: true }]) {
    await assert.rejects(createIdentityRuntime(profile, invalid), /^Error: Identity runtime configuration could not be initialized\.$/);
  }
});

test('explicit local bootstrap serves isolated HTTPS gateway with real lazy runtime and coordinated cleanup', async () => {
  const tls = await createLocalTlsHarness(); const origin = `https://localhost:${await reserveLocalPort()}`;
  let calls = 0;
  const deny: typeof fetch = async () => { calls++; throw new Error('Provider access forbidden'); };
  try {
    const local = await startLocalIdentityRuntime({ version: 'steer-local-identity/v1', rendererOrigin: 'http://127.0.0.1:49001',
      identity: { ...profile, browser: { ...profile.browser, redirectUri: `${origin}/auth/callback` } } },
    { identity: secrets, tls: { key: tls.key, cert: tls.cert } }, { identity: deny, github: deny,
      renderer: async () => new Response('<h1>Synthetic renderer</h1>', { headers: { 'content-type': 'text/html' } }) });
    try {
      assert.equal((await localHttpsRequest(origin, tls.cert)).status, 200);
      assert.equal((await localHttpsRequest(origin, tls.cert, '/health/ready')).status, 503);
      assert.equal((await localHttpsRequest(origin, tls.cert, '/v1/tools/session.context', { method: 'POST' })).status, 401);
      assert.equal(local.status().identity.database.connections, 0); assert.equal(calls, 0);
    } finally { await local.shutdown(); }
    assert.equal(local.status().listener.state, 'stopped'); assert.equal(local.status().identity.state, 'stopped');
    assert.equal(local.status().identity.database.closed, true);
    await assert.rejects(startLocalIdentityRuntime({ version: 'steer-local-identity/v1', rendererOrigin: 'http://outside.example:3000', identity: profile },
      { identity: secrets, tls: { key: tls.key, cert: tls.cert } }), /^Error: Local identity runtime could not be initialized\.$/);
  } finally { await tls.close(); }
});
