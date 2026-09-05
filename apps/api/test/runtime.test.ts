import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { createIdentityRuntime, createProjectionRuntime, startLocalIdentityRuntime, startLocalIdentityFromSecretProvider } from '../src/runtime.ts';
import { createLocalTlsHarness, reserveLocalPort, localHttpsRequest } from './local-tls-harness.ts';
import { createEncryptedFileSecretProvider } from '@steer/adapters/secrets';
import { createSecretFixture } from '../../../packages/adapters/test/secret-fixture.ts';

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
    { ...profile, mcp: { clientIds: [] } }, { ...profile, mcp: { clientIds: ['agent', 'agent'] } },
    { ...profile, mcp: { clientIds: ['agent'], extra: true } },
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
      identity: { ...profile, mcp: { clientIds: ['agent'] }, browser: { ...profile.browser, redirectUri: `${origin}/auth/callback` } } },
    { identity: secrets, tls: { key: tls.key, cert: tls.cert } }, { identity: deny, github: deny,
      renderer: async () => new Response('<h1>Synthetic renderer</h1>', { headers: { 'content-type': 'text/html' } }) });
    try {
      assert.equal((await localHttpsRequest(origin, tls.cert)).status, 200);
      assert.equal((await localHttpsRequest(origin, tls.cert, '/health/ready')).status, 503);
      assert.equal((await localHttpsRequest(origin, tls.cert, '/mcp', { method: 'POST' })).status, 401);
      assert.equal(local.status().identity.mcp?.stopping, false);
      assert.equal((await localHttpsRequest(origin, tls.cert, '/v1/tools/session.context', { method: 'POST' })).status, 401);
      assert.equal(local.status().identity.database.connections, 0); assert.equal(calls, 0);
    } finally { await local.shutdown(); }
    assert.equal(local.status().listener.state, 'stopped'); assert.equal(local.status().identity.state, 'stopped');
    assert.equal(local.status().identity.database.closed, true);
    await assert.rejects(startLocalIdentityRuntime({ version: 'steer-local-identity/v1', rendererOrigin: 'http://outside.example:3000', identity: profile },
      { identity: secrets, tls: { key: tls.key, cert: tls.cert } }), /^Error: Local identity runtime could not be initialized\.$/);
  } finally { await tls.close(); }
});

test('encrypted secret provider starts real local runtime and clears temporary plaintext without provider access', async () => {
  const tls = await createLocalTlsHarness(); const origin = `https://localhost:${await reserveLocalPort()}`;
  const bundle = { version: 'steer-local-identity-secrets/v1', identity: { ...secrets, sessionKeys: { synthetic: secrets.sessionKeys.synthetic.toString('base64') } }, tls: { key: tls.key, cert: tls.cert } };
  const fixture = await createSecretFixture(new TextEncoder().encode(JSON.stringify(bundle)));
  let plaintext: Uint8Array | undefined; let calls = 0;
  const deny: typeof fetch = async () => { calls++; throw new Error('Synthetic providers forbidden'); };
  try {
    const provider = await createEncryptedFileSecretProvider(fixture, fixture.keyProvider);
    const local = await startLocalIdentityFromSecretProvider({ version: 'steer-local-identity/v1', rendererOrigin: 'http://127.0.0.1:49001',
      identity: { ...profile, browser: { ...profile.browser, redirectUri: `${origin}/auth/callback` } } }, fixture.reference,
    { read: async (reference) => { plaintext = await provider.read(reference); return plaintext; } },
    { identity: deny, github: deny, renderer: async () => new Response('synthetic', { headers: { 'content-type': 'text/html' } }) });
    try {
      assert.ok(plaintext?.every((byte) => byte === 0)); assert.ok(fixture.returnedKeys.every((key) => key.every((byte) => byte === 0)));
      assert.equal((await localHttpsRequest(origin, tls.cert)).status, 200);
      assert.equal((await localHttpsRequest(origin, tls.cert, '/health/ready')).status, 503);
      assert.equal(calls, 0); assert.equal(local.status().identity.database.connections, 0);
    } finally { await local.shutdown(); }
    assert.equal(local.status().listener.state, 'stopped'); assert.equal(local.status().identity.database.closed, true);
  } finally { await fixture.close(); await tls.close(); }
});

test('secret-backed startup rejects invalid reference, encoding and credential bundles without leaking values', async () => {
  const localProfile = { version: 'steer-local-identity/v1', rendererOrigin: 'http://127.0.0.1:49001', identity: profile };
  const reference = { name: 'identity-runtime', revision: 'r1', sha256: 'a'.repeat(64) }; let reads = 0;
  await assert.rejects(startLocalIdentityFromSecretProvider(localProfile, { ...reference, name: '../outside' }, { read: async () => { reads++; return new Uint8Array(); } }),
    /^Error: Secret-backed local identity runtime could not be initialized\.$/); assert.equal(reads, 0);
  for (const plaintext of [new Uint8Array(32769), new Uint8Array([0xff]), new TextEncoder().encode('secret-not-json'),
    new TextEncoder().encode(JSON.stringify({ version: 'unexpected', private: 'secret' }))]) {
    await assert.rejects(startLocalIdentityFromSecretProvider(localProfile, reference, { read: async () => plaintext }),
      /^Error: Secret-backed local identity runtime could not be initialized\.$/);
    assert.ok(plaintext.every((byte) => byte === 0));
  }
});

test('read-model binding requires separate explicit credential and closes both bounded runtime pools', async () => {
  const readModel = { database: profile.database, paths: ['BRIEF.md'] };
  await assert.rejects(createIdentityRuntime({ ...profile, readModel }, secrets));
  await assert.rejects(createIdentityRuntime(profile, { ...secrets, readModelDatabasePassword: 'synthetic-read-password' }));
  await assert.rejects(createIdentityRuntime({ ...profile, readModel: { ...readModel, paths: ['BRIEF.md', 'BRIEF.md'] } },
    { ...secrets, readModelDatabasePassword: 'synthetic-read-password' }));
  const runtime = await createIdentityRuntime({ ...profile, readModel }, { ...secrets, readModelDatabasePassword: 'synthetic-read-password' });
  try { assert.equal(runtime.status().readModel?.connections, 0); assert.equal(runtime.status().readModel?.closed, false); }
  finally { await runtime.shutdown(); }
  assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().readModel?.closed, true);
});

const projectionProfile = { version: 'steer-projection-runtime/v1',
  github: { appId: profile.github.appId, binding: profile.github.binding }, database: profile.database, paths: ['BRIEF.md'] };
const projectionSecrets = { githubPrivateKeyPem: secrets.githubPrivateKeyPem, databasePassword: secrets.databasePassword };
const projectionAgent = { subject: 'synthetic-projector', organizationId: 'synthetic', type: 'agent', hats: [], toolGrants: ['projection.ingest'],
  expiresAt: new Date(Date.now() + 300000).toISOString() };

test('projection runtime is lazy, explicit and rejects invalid agent authority before provider access', async () => {
  let calls = 0;
  for (const principal of [null, { ...projectionAgent, type: 'human' }, { ...projectionAgent, organizationId: 'foreign' },
    { ...projectionAgent, toolGrants: [] }, { ...projectionAgent, expiresAt: new Date(0).toISOString() }]) {
    const runtime = await createProjectionRuntime(projectionProfile, projectionSecrets, { authenticate: async () => principal,
      github: async () => { calls++; throw new Error('private-provider-detail'); } });
    assert.equal(runtime.status().database.connections, 0);
    await assert.rejects(runtime.runOnce(), /identity is not authorized/); await runtime.shutdown();
    assert.equal(runtime.status().database.closed, true);
  }
  assert.equal(calls, 0);
  await assert.rejects(createProjectionRuntime({ ...projectionProfile, paths: ['x', 'x'] }, projectionSecrets, { authenticate: async () => projectionAgent }));
});

test('projection runtime refuses overlap and shutdown waits for actual pending source work', async () => {
  let release!: () => void, entered!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; }); const started = new Promise<void>((resolve) => { entered = resolve; });
  const runtime = await createProjectionRuntime(projectionProfile, projectionSecrets, { authenticate: async () => projectionAgent,
    github: async () => { entered(); await blocked; throw new Error('private-provider-detail'); } });
  const run = runtime.runOnce(); const rejected = assert.rejects(run, (value: unknown) => value instanceof Error && !value.message.includes('private'));
  await started; await assert.rejects(runtime.runOnce(), /not accepting work/);
  let closed = false; const shutdown = runtime.shutdown().then(() => { closed = true; });
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(closed, false); assert.equal(runtime.status().active, true);
  await assert.rejects(runtime.runOnce(), /not accepting work/); release(); await rejected; await shutdown;
  assert.equal(runtime.status().active, false); assert.equal(runtime.status().database.closed, true);
});

test('projection runtime requires exactly one source selector and composes empty inventory without SQL or deletion', async () => {
  const { paths: _paths, ...base } = projectionProfile;
  const selection = { roots: ['intent'], fileNames: ['BRIEF.md'] };
  for (const value of [base, { ...projectionProfile, selection }, { ...base, selection: { roots: ['../intent'], fileNames: ['BRIEF.md'] } }]) {
    await assert.rejects(createProjectionRuntime(value, projectionSecrets, { authenticate: async () => projectionAgent }));
  }
  const revision = 'a'.repeat(40), treeSha = 'b'.repeat(40); let trees = 0;
  const runtime = await createProjectionRuntime({ ...base, selection }, projectionSecrets, { authenticate: async () => projectionAgent,
    github: async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.origin, 'https://api.github.com');
      if (url.pathname === '/app/installations/1/access_tokens') {
        assert.deepEqual(JSON.parse(String(init?.body)), { repository_ids: [1], permissions: { contents: 'read' } });
        return Response.json({ token: 'synthetic', expires_at: new Date(Date.now() + 3600000).toISOString(),
          repositories: [{ id: 1, full_name: 'synthetic/synthetic' }], permissions: { contents: 'read', metadata: 'read' } });
      }
      assert.equal(init?.method, 'GET');
      if (url.pathname.endsWith('/git/ref/heads/synthetic')) return Response.json({ ref: 'refs/heads/synthetic', object: { type: 'commit', sha: revision } });
      if (url.pathname.endsWith(`/git/commits/${revision}`)) return Response.json({ sha: revision, tree: { sha: treeSha } });
      if (url.pathname.endsWith(`/git/trees/${treeSha}`)) { trees++; return Response.json({ sha: treeSha, truncated: false, tree: [] }); }
      throw new Error('Unexpected synthetic provider request.');
    } });
  try {
    const result = await runtime.runOnce(); assert.equal(result.revision, revision); assert.equal(result.status, 'reconciled');
    assert.deepEqual(result.outcomes, []); assert.equal(trees, 1); assert.equal(runtime.status().database.connections, 0);
  } finally { await runtime.shutdown(); }
  assert.equal(runtime.status().database.closed, true);
});
