import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createOidcApi } from '../src/identity.ts';

test('cryptographic OIDC verification feeds the real API boundary, with current revocation and tenancy enforced', async () => {
  const issuer = 'https://identity.example/realms/steer';
  const now = new Date('2026-09-04T12:00:00Z');
  const epoch = now.getTime() / 1000;
  const keys = await generateKeyPair('RS256');
  const publicKey = { ...await exportJWK(keys.publicKey), kid: 'test', alg: 'RS256' };
  let active = true;
  const app = createOidcApi({ issuer, jwksUri: `${issuer}/protocol/openid-connect/certs`, audience: 'steer-api', clientIds: ['steer-web'] }, {
    now: () => now,
    fetch: async () => Response.json({ keys: [publicKey] }),
    resolveAuthorization: async () => ({
      issuer, subject: 'human-1', organizationId: 'org-a', type: 'human',
      hats: ['product-lead'], toolGrants: ['session.context'], active,
      validAfter: new Date(now.getTime() - 60000).toISOString(),
      expiresAt: new Date(now.getTime() + 60000).toISOString(),
    }),
  });
  const token = await new SignJWT({
    typ: 'Bearer', azp: 'steer-web', steer_org: 'org-a', steer_kind: 'human', steer_hats: ['product-lead'],
  }).setProtectedHeader({ alg: 'RS256', kid: 'test', typ: 'JWT' }).setSubject('human-1')
    .setIssuer(issuer).setAudience('steer-api').setIssuedAt(epoch).setExpirationTime(epoch + 120).sign(keys.privateKey);
  const call = (organizationId: string, bearer = token) => app.request('/v1/tools/session.context', {
    method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json', 'x-role': 'org-admin' },
    body: JSON.stringify({ organizationId }),
  });
  const allowed = await call('org-a');
  assert.equal(allowed.status, 200);
  assert.deepEqual((await allowed.json()).hats, ['product-lead']);
  assert.equal((await call('org-b')).status, 403);
  assert.equal((await call('org-a', 'fake')).status, 401);
  active = false;
  assert.equal((await call('org-a')).status, 401);
  assert.equal((await app.request('/health/ready')).status, 503);
});
