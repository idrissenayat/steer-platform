import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import { fixture, binding as fixtureBinding } from '../../../packages/adapters/test/github-brief-fixture.ts';

export interface DisposableRecordedIdentity {
  issuer: string; organizationId: string; subject: string; clientId: string;
  fetch: typeof fetch; issueBearer(): Promise<string>;
}

/** Native Git and signed JWTs. Issuer is synthetic unless explicitly supplied by a disposable test. */
export async function recordedRuntimeFixture(t: { after(run: () => void): void }, options?: {
  source?: ReturnType<typeof fixture>; selection: { itemId: string; idempotencyKey: string };
  actor?: { subject: string; toolGrants: string[]; authorizationPath: string; type?: 'agent' | 'human' };
  identity?: DisposableRecordedIdentity;
  organizationId?: string;
}) {
  const source = options?.source ?? fixture(t), keys = await generateKeyPair('RS256'), app = await generateKeyPair('RS256', { extractable: true });
  const provider = options?.identity, binding = { ...fixtureBinding, organizationId: provider?.organizationId ?? options?.organizationId ?? fixtureBinding.organizationId };
  const issuer = provider?.issuer ?? 'https://recorded.identity.invalid', jwksUri = provider ? `${issuer}/protocol/openid-connect/certs` : `${issuer}/jwks`, epoch = Math.floor(Date.now() / 1000);
  const grant = { issuer, subject: provider?.subject ?? options?.actor?.subject ?? 'synthetic-recorded-dispatcher', organizationId: binding.organizationId, type: options?.actor?.type ?? 'agent', hats: [] as string[],
    toolGrants: options?.actor?.toolGrants ?? ['workflow.recorded-brief.start', 'workflow.recorded-brief.status'], active: true,
    validAfter: new Date((epoch - 30) * 1000).toISOString(), expiresAt: new Date((epoch + 180) * 1000).toISOString() };
  const authorizationPath = options?.actor?.authorizationPath ?? 'access/dispatch.json';
  const publish = (value = grant) => source.add([{ path: authorizationPath,
    content: JSON.stringify({ version: 'steer-authorization/v1', organizationId: binding.organizationId, records: [value] }) }]);
  publish();
  const jwk = { ...await exportJWK(keys.publicKey), kid: 'synthetic-recorded', alg: 'RS256' };
  const issueBearer = async () => {
    if (provider) return provider.issueBearer();
    const issued = Math.floor(Date.now() / 1000);
    return new SignJWT({ typ: 'Bearer', azp: 'steer-web', steer_org: grant.organizationId, steer_kind: grant.type, steer_hats: [] })
      .setProtectedHeader({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' }).setSubject(grant.subject).setIssuer(issuer).setAudience('steer-api')
      .setIssuedAt(issued).setExpirationTime(issued + 180).sign(keys.privateKey);
  };
  const token = await issueBearer();
  const selection = options?.selection ?? { itemId: 'items/0176-recorded', idempotencyKey: '17600000-0000-4000-8000-000000000001' };
  const input = { organizationId: grant.organizationId, repository: `github:${binding.repositoryId}`, ...selection };
  const target = { scope: { organizationId: input.organizationId, repository: input.repository, itemId: input.itemId }, idempotencyKey: input.idempotencyKey };
  const workflowId = `steer-recorded-brief/v1/${[input.organizationId, input.repository, input.itemId].map(encodeURIComponent).join('/')}/${selection.idempotencyKey}`;
  const profile = { version: 'steer-identity-runtime/v1', browser: { issuer, jwksUri,
    authorizationEndpoint: provider ? `${issuer}/protocol/openid-connect/auth` : `${issuer}/auth`,
    tokenEndpoint: provider ? `${issuer}/protocol/openid-connect/token` : `${issuer}/token`,
    redirectUri: 'https://steer.example/auth/callback', clientId: provider?.clientId ?? 'steer-web', audience: 'steer-api' },
    github: { appId: '1', authorizationPath, binding }, database: { host: '127.0.0.1', port: 5432, database: 'unused_synthetic', transport: { kind: 'isolated-loopback-test' } },
    sessionKeyId: 'synthetic', recordedScheduling: selection };
  const secrets = { browserClientSecret: 'synthetic-unused-secret', databasePassword: 'synthetic-unused-password',
    githubPrivateKeyPem: await exportPKCS8(app.privateKey), sessionKeys: { synthetic: randomBytes(32) } };
  let jwks = 0, assertions = 0;
  const ports = { identity: (async (url, init) => { assert.equal(String(url), jwksUri); jwks++; return provider ? provider.fetch(url, init) : Response.json({ keys: [jwk] }); }) as typeof fetch,
    github: (async (url, init) => {
      const headers = new Headers(init?.headers);
      if (String(url).endsWith('/access_tokens')) {
        await jwtVerify(headers.get('authorization')!.replace(/^Bearer /, ''), app.publicKey, { algorithms: ['RS256'], issuer: '1' }); assertions++;
        assert.deepEqual(JSON.parse(String(init?.body)), { repository_ids: [binding.repositoryId], permissions: { contents: 'read' } });
        headers.set('authorization', 'Bearer synthetic-app-jwt');
      }
      const response = await source.transport(url, { ...init, headers });
      // Only this current-time OIDC reader sees fresh installation-token metadata.
      // A shared source's fixed-clock writer transport and fault hooks stay intact.
      return String(url).endsWith('/access_tokens')
        ? Response.json({ ...await response.json(), expires_at: new Date(Date.now() + 3600000).toISOString() }) : response;
    }) as typeof fetch };
  const request = (name: 'start' | 'status' | 'recover' | 'recovery.status', body: unknown = input, bearer = token) => new Request(`https://steer.example/v1/tools/workflow.recorded-brief.${name}`, {
    method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { source, grant, publish, profile, secrets, ports, input, target, workflowId, request, token, issueBearer, counts: () => ({ jwks, assertions }) };
}
