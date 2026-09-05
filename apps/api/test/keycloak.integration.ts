import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request as httpsRequest } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { createOidcAuthenticator, type AuthorizationRecord } from '@steer/adapters/identity';
import { createOidcApi } from '../src/identity.ts';
import { testKeycloakHumanFlow } from './keycloak-human.integration.ts';
import { createPostgresSessionHarness } from './postgres-session-harness.ts';
import { createBrowserAuthHarness } from './browser-auth-harness.ts';
import { testMcpKeycloak } from './mcp-keycloak.integration.ts';

// Deliberately separate from normal tests: requires Docker and OpenSSL, never real credentials.
const image = 'quay.io/keycloak/keycloak@sha256:ff4257d0d64efbe99ed1ddfaf07765cc3c36dc7518bf8324d41961327f441c54';
const exec = promisify(execFile);
const browserMode = process.argv.slice(2).includes('--browser');
const durable = browserMode || process.argv.slice(2).includes('--durable');
assert.ok(process.argv.slice(2).every((argument) => ['--durable', '--browser'].includes(argument)), 'Unknown integration argument');
const docker = async (...args: string[]) => (await exec('docker', args, { timeout: 30000 })).stdout.trim();
const name = `steer-0013-${randomUUID()}`;
const temporary = await mkdtemp(join(tmpdir(), 'steer-0013-'));
const clientSecret = randomBytes(32).toString('hex');
const subject = randomUUID();
const humanSubject = randomUUID();
const humanPassword = randomBytes(32).toString('hex');
const humanClientSecret = randomBytes(32).toString('hex');
let containerId: string | undefined;
let closeSessions: (() => Promise<void>) | undefined;
let browserHarness: Awaited<ReturnType<typeof createBrowserAuthHarness>> | undefined;
let passed = 0;
let stage = 'disposable service initialization';
const check = async (label: string, run: () => Promise<void>) => { stage = label; await run(); passed++; console.log(`PASS ${label}`); };

try {
  await chmod(temporary, 0o700);
  const realmFolder = join(temporary, 'import');
  await mkdir(realmFolder, { mode: 0o700 });
  await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', join(temporary, 'tls.key'), '-out', join(temporary, 'tls.crt')], { timeout: 30000 });
  await chmod(join(temporary, 'tls.key'), 0o600);
  const certificate = await readFile(join(temporary, 'tls.crt'));
  if (browserMode) browserHarness = await createBrowserAuthHarness({ key: await readFile(join(temporary, 'tls.key')), certificate, temporary });
  const browserOrigin = browserHarness?.origin ?? 'https://steer.test';
  const claim = (key: string, value: string, type = 'String') => ({
    name: key, protocol: 'openid-connect', protocolMapper: 'oidc-hardcoded-claim-mapper',
    config: { 'claim.name': key, 'claim.value': value, 'jsonType.label': type,
      'access.token.claim': 'true', 'id.token.claim': 'false', 'userinfo.token.claim': 'false' },
  });
  await writeFile(join(realmFolder, 'steer-test-realm.json'), JSON.stringify({
    realm: 'steer-test', enabled: true, sslRequired: 'all', registrationAllowed: false,
    resetPasswordAllowed: false, accessTokenLifespan: 180,
    clients: [{ clientId: 'steer-test-agent', enabled: true, protocol: 'openid-connect',
      publicClient: false, secret: clientSecret, serviceAccountsEnabled: true,
      standardFlowEnabled: false, implicitFlowEnabled: false, directAccessGrantsEnabled: false,
      fullScopeAllowed: false, defaultClientScopes: [], optionalClientScopes: [],
      protocolMappers: [claim('steer_org', 'synthetic-org'), claim('steer_kind', 'agent'),
        claim('steer_hats', '[]', 'JSON'), {
          name: 'steer-audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
          config: { 'included.custom.audience': 'steer-api', 'access.token.claim': 'true', 'id.token.claim': 'false' },
        }],
    }, { clientId: 'steer-test-web', enabled: true, protocol: 'openid-connect',
      publicClient: false, secret: humanClientSecret, serviceAccountsEnabled: false,
      standardFlowEnabled: true, implicitFlowEnabled: false, directAccessGrantsEnabled: false,
      consentRequired: false, fullScopeAllowed: false, defaultClientScopes: [], optionalClientScopes: [],
      redirectUris: [`${browserOrigin}/auth/callback`], webOrigins: [browserOrigin],
      attributes: { 'pkce.code.challenge.method': 'S256' },
      protocolMappers: [{
        // Minimal scopes omit Keycloak's default "basic" scope: bind sub explicitly.
        name: 'steer-subject', protocol: 'openid-connect', protocolMapper: 'oidc-sub-mapper',
        config: { 'access.token.claim': 'true', 'introspection.token.claim': 'false' },
      }, claim('steer_org', 'synthetic-org'), claim('steer_kind', 'human'),
        claim('steer_hats', '["product-lead"]', 'JSON'), {
          name: 'steer-audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
          config: { 'included.custom.audience': 'steer-api', 'access.token.claim': 'true', 'id.token.claim': 'false' },
        }],
    }],
    users: [{ id: subject, username: 'service-account-steer-test-agent', enabled: true,
      serviceAccountClientId: 'steer-test-agent' },
      { id: humanSubject, username: 'synthetic-human', enabled: true, email: 'synthetic@example.invalid',
        emailVerified: true, firstName: 'Synthetic', lastName: 'Tester', requiredActions: [],
        credentials: [{ type: 'password', value: humanPassword, temporary: false }] }],
  }), { mode: 0o600 });
  // Match the host owner for 0600 read-only bind mounts; group 0 is the image's writable group.
  const uid = process.getuid?.();
  assert.ok(uid && uid > 0, 'Run this local harness as a non-root Unix user');
  containerId = await docker('run', '--detach', '--rm', '--pull=never', '--name', name,
    '--label', 'steer.integration=0013', '--user', `${uid}:0`, '--memory', '1g',
    '--tmpfs', '/opt/keycloak/data:rw,mode=1777',
    '--mount', `type=bind,src=${temporary},dst=/steer-test,readonly`,
    '--mount', `type=bind,src=${realmFolder},dst=/opt/keycloak/data/import,readonly`,
    '-p', '127.0.0.1::8443', image, 'start-dev', '--import-realm', '--http-enabled=false',
    '--hostname-strict=false', '--https-certificate-file=/steer-test/tls.crt',
    '--https-certificate-key-file=/steer-test/tls.key');
  assert.match(containerId, /^[a-f0-9]{64}$/);
  const mapping = await docker('port', containerId, '8443/tcp');
  assert.match(mapping, /^127\.0\.0\.1:\d+$/);
  const origin = `https://${mapping}`;
  const issuer = `${origin}/realms/steer-test`;
  // Trust just this run's certificate, just for this origin. Never disable TLS validation.
  const scopedFetch: typeof fetch = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== origin || url.username || url.password) throw new Error('Unexpected test origin');
    if (options.body !== undefined && typeof options.body !== 'string') throw new Error('Unexpected test body');
    return new Promise<Response>((resolve, reject) => {
      const req = httpsRequest(url, { method: options.method ?? 'GET', ca: certificate,
        headers: Object.fromEntries(new Headers(options.headers)), signal: AbortSignal.timeout(5000) }, (res) => {
        const chunks: Buffer[] = []; let bytes = 0;
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2 * 1024 * 1024) res.destroy(new Error('Test response too large'));
          else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => {
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers)) if (value !== undefined) {
            for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
          }
          resolve(new Response(new Uint8Array(Buffer.concat(chunks)), { status: res.statusCode ?? 500, headers }));
        });
      });
      req.on('error', reject);
      req.end(options.body);
    });
  };
  let ready = false;
  for (let attempt = 0; attempt < 75; attempt++) {
    try { ready = (await scopedFetch(`${issuer}/.well-known/openid-configuration`)).ok; } catch { /* bounded startup wait */ }
    if (ready) break;
    await delay(500);
  }
  assert.ok(ready, 'Disposable Keycloak did not become ready');
  await check('HTTPS discovery pins issuer and JWKS to the disposable service', async () => {
    const discovery = await (await scopedFetch(`${issuer}/.well-known/openid-configuration`)).json();
    assert.equal(discovery.issuer, issuer);
    assert.equal(discovery.jwks_uri, `${issuer}/protocol/openid-connect/certs`);
    await assert.rejects(fetch(`${issuer}/.well-known/openid-configuration`));
    await assert.rejects(scopedFetch('https://example.com/'));
  });
  const response = await scopedFetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'steer-test-agent', client_secret: clientSecret }).toString(),
  });
  assert.ok(response.ok, 'Keycloak service token request failed');
  const issued = await response.json();
  assert.ok(typeof issued.access_token === 'string', 'Missing service token');
  const bearer: string = issued.access_token;
  const config = { issuer, jwksUri: `${issuer}/protocol/openid-connect/certs`, audience: 'steer-api', clientIds: ['steer-test-agent'] };
  let grant: AuthorizationRecord = {
    issuer, subject, organizationId: 'synthetic-org', type: 'agent', hats: [], toolGrants: ['session.context'],
    active: true, validAfter: new Date(0).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString(),
  };
  const dependencies = { fetch: scopedFetch, resolveAuthorization: async () => grant };
  const authenticate = createOidcAuthenticator(config, dependencies);
  const request = () => new Request('https://api.test/', { headers: { authorization: `Bearer ${bearer}` } });
  await check('actual Keycloak RS256 token authenticates as an agent with no human hats', async () => {
    const principal = await authenticate(request());
    assert.ok(principal && principal.subject === subject && principal.type === 'agent');
    assert.deepEqual(principal.hats, []);
    assert.deepEqual(principal.toolGrants, ['session.context']);
  });
  await check('wrong audience and unapproved client fail closed against real JWKS', async () => {
    assert.equal(await createOidcAuthenticator({ ...config, audience: 'another-api' }, dependencies)(request()), null);
    assert.equal(await createOidcAuthenticator({ ...config, clientIds: ['another-client'] }, dependencies)(request()), null);
  });
  await check('fresh grant revocation rejects an otherwise unexpired provider token', async () => {
    grant = { ...grant, active: false };
    assert.equal(await authenticate(request()), null);
    grant = { ...grant, active: true };
  });
  await check('tenant mismatch and agent human-hat assignment both deny', async () => {
    grant = { ...grant, organizationId: 'another-org' };
    assert.equal(await authenticate(request()), null);
    grant = { ...grant, organizationId: 'synthetic-org', hats: ['product-lead'] };
    assert.equal(await authenticate(request()), null);
    grant = { ...grant, hats: [] };
  });
  const api = createOidcApi(config, dependencies);
  const call = (organizationId: string) => api.request('/v1/tools/session.context', {
    method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json', 'x-role': 'org-admin' },
    body: JSON.stringify({ organizationId }),
  });
  await check('provider token reaches the shared API and tenant boundary', async () => {
    assert.equal((await call('synthetic-org')).status, 200);
    assert.equal((await call('another-org')).status, 403);
    grant = { ...grant, toolGrants: [] };
    assert.equal((await call('synthetic-org')).status, 403);
    grant = { ...grant, active: false };
    assert.equal((await call('synthetic-org')).status, 401);
    assert.equal((await api.request('/health/ready')).status, 503);
  });
  await testMcpKeycloak({ configuration: config, bearer, grant: { ...grant, active: true, toolGrants: ['session.context'] },
    providerFetch: scopedFetch, temporary, key: await readFile(join(temporary, 'tls.key'), 'utf8'), cert: certificate.toString(), check });
  const humanDependencies = { issuer, clientSecret: humanClientSecret, subject: humanSubject,
    username: 'synthetic-human', password: humanPassword, fetch: scopedFetch, check };
  const createSessions = async (binding: { issuer: string; clientId: string; redirectUri: string }) => {
    stage = 'disposable encrypted authentication database initialization';
    const storage = await createPostgresSessionHarness(binding); closeSessions = storage.close; return storage;
  };
  if (browserHarness) await browserHarness.run({ ...humanDependencies, createSessions,
    agent: { bearer, clientId: 'steer-test-agent', grant: { ...grant, active: true, toolGrants: ['session.context', 'projection.artifact.read', 'projection.changes.read'] } } });
  else await testKeycloakHumanFlow({ ...humanDependencies, ...(durable ? { createSessions } : {}) });
  console.log(`Keycloak integration: ${passed} checks passed; server 26.7.3; no real user or provider credentials used.`);
} catch {
  // Do not echo token responses, realm secrets or child-process arguments on failure.
  console.error(`Keycloak integration failed at ${stage}. Credentials and response payloads are intentionally omitted.`);
  process.exitCode = 1;
} finally {
  try {
    if (browserHarness) { await browserHarness.close(); console.log('Closed only this run\'s isolated Chromium and HTTPS test servers.'); }
  } finally {
    try {
      if (closeSessions) await closeSessions();
    } finally {
      if (containerId && /^[a-f0-9]{64}$/.test(containerId)) {
        assert.equal(await docker('inspect', '--format', '{{index .Config.Labels "steer.integration"}}', containerId), '0013');
        await docker('stop', '--time', '5', containerId);
      }
      // temporary is the exact mkdtemp result owned solely by this harness invocation.
      await rm(temporary, { recursive: true, force: true });
      console.log('Removed only this run\'s synthetic Keycloak container, data and generated TLS/test credentials.');
    }
  }
}
