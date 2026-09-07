import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRealm, makeGrant, makeProfile, composeConfiguration, postgresHba } from '../apps/api/ops/local-workspace-config.mjs';

const secret = { subject: 'actual-provider-subject', client: 'private-client-secret', temporaryPassword: 'private-password', createdAt: '2026-09-07T12:00:00.000Z' };
test('real local account is password-change gated, without fabricated email or machine flows', () => {
  const realm = makeRealm(secret), client = realm.clients[0], user = realm.users[0];
  assert.equal(realm.registrationAllowed, false); assert.equal(realm.sslRequired, 'all');
  assert.equal(user.username, 'idrissenayat'); assert.equal(user.email, undefined); assert.equal(user.emailVerified, false);
  assert.equal(user.credentials[0].temporary, true); assert.deepEqual(user.requiredActions, ['UPDATE_PASSWORD']);
  for (const field of ['publicClient', 'serviceAccountsEnabled', 'implicitFlowEnabled', 'directAccessGrantsEnabled', 'fullScopeAllowed']) assert.equal(client[field], false);
  assert.deepEqual(client.redirectUris, ['https://localhost:8443/auth/callback']);
  assert.equal(client.attributes['pkce.code.challenge.method'], 'S256'); assert.ok(realm.accessTokenLifespan <= 300);
});
test('bootstrap grants only session and local authoring, expires, and carries no credentials', () => {
  const grant = makeGrant(secret), record = grant.records[0];
  assert.deepEqual(record.hats, ['org-admin', 'product-lead', 'product-designer']);
  assert.deepEqual(record.toolGrants, ['session.context', 'intent.brief.preview', 'intent.brief.save.status']);
  assert.equal(record.subject, secret.subject); assert.equal(record.expiresAt, '2026-10-07T12:00:00.000Z');
  assert.ok(!JSON.stringify(grant).includes(secret.client)); assert.ok(!JSON.stringify(grant).includes(secret.temporaryPassword));
});
test('runtime uses real TLS and Git binding with held-write path absent', () => {
  const profile = makeProfile('local certificate');
  assert.equal(profile.identity.database.transport.kind, 'tls');
  assert.equal(profile.identity.github.binding.repositoryId, 1349965471);
  assert.equal(profile.identity.github.appId, '4836171');
  for (const field of ['heldBrief', 'briefDestination', 'readModel', 'scheduling', 'recordedScheduling', 'recordedRecovery']) assert.equal(profile.identity[field], undefined);
});
test('owned compose is digest-pinned, persistent, loopback only, and production-mode Keycloak', () => {
  const config = composeConfiguration('/private/example', 501);
  for (const service of Object.values(config.services)) {
    assert.match(service.image, /@sha256:[a-f0-9]{64}$/); assert.ok(service.ports.every(port => port.startsWith('127.0.0.1:')));
    assert.equal(service.labels['steer.local-workspace'], 'identity-v1');
  }
  assert.ok(config.services.postgres.volumes.includes('database:/var/lib/postgresql/data'));
  assert.deepEqual(config.services.keycloak.command, ['start', '--import-realm']);
  assert.match(config.services.keycloak.environment.KC_DB_URL, /sslmode=verify-full/);
  assert.equal(config.services.keycloak.environment.KC_HTTP_ENABLED, 'false');
  assert.equal(config.services.keycloak.environment.KC_HTTPS_CERTIFICATE_FILE, '/steer-local/browser.crt');
  assert.ok(config.services.keycloak.volumes.includes('/private/example/browser-tls/server.crt:/steer-local/browser.crt:ro'));
  assert.ok(config.services.keycloak.volumes.includes('/private/example/tls.crt:/steer-local/tls.crt:ro'));
  assert.ok(!config.services.keycloak.volumes.some(mount => mount.includes('/tls.key:')));
  assert.equal(config.networks.identity.internal, true);
  assert.match(postgresHba, /hostnossl all all all reject/);
  assert.match(postgresHba, /hostssl all all all scram-sha-256/);
});
