/** Deployment data builders: no I/O and no authority inferred from process state. */
export const organizationId = 'steer-local-idrissenayat';
export const issuer = 'https://localhost:8444/realms/steer-local';
const hats = ['org-admin', 'product-lead', 'product-designer'];
export const postgresHba = 'local all all trust\nhostnossl all all all reject\nhostssl all all all scram-sha-256\n';
const claim = (name, value, type = 'String') => ({ name, protocol: 'openid-connect', protocolMapper: 'oidc-hardcoded-claim-mapper',
  config: { 'claim.name': name, 'claim.value': value, 'jsonType.label': type, 'access.token.claim': 'true', 'id.token.claim': 'false', 'userinfo.token.claim': 'false' } });
export function makeRealm(secrets) {
  return { realm: 'steer-local', enabled: true, sslRequired: 'all', registrationAllowed: false,
    resetPasswordAllowed: false, bruteForceProtected: true, accessTokenLifespan: 180,
    passwordPolicy: 'length(14)',
    clients: [{ clientId: 'steer-local-web', enabled: true, protocol: 'openid-connect', publicClient: false, secret: secrets.client,
      serviceAccountsEnabled: false, standardFlowEnabled: true, implicitFlowEnabled: false, directAccessGrantsEnabled: false,
      fullScopeAllowed: false, defaultClientScopes: [], optionalClientScopes: [],
      redirectUris: ['https://localhost:8443/auth/callback'], webOrigins: ['https://localhost:8443'],
      attributes: { 'pkce.code.challenge.method': 'S256' },
      // These claims are only candidates. The runtime intersects them with exact-subject, current Git grants.
      protocolMappers: [{ name: 'steer-subject', protocol: 'openid-connect', protocolMapper: 'oidc-sub-mapper', config: { 'access.token.claim': 'true' } },
        claim('steer_org', organizationId), claim('steer_kind', 'human'), claim('steer_hats', JSON.stringify(hats), 'JSON'),
        { name: 'steer-audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
          config: { 'included.custom.audience': 'steer-api', 'access.token.claim': 'true', 'id.token.claim': 'false' } }] }],
    users: [{ id: secrets.subject, username: 'idrissenayat', enabled: true, firstName: 'Idriss', lastName: 'Enayat',
      emailVerified: false, requiredActions: ['UPDATE_PASSWORD'], credentials: [{ type: 'password', value: secrets.temporaryPassword, temporary: true }] }],
  };
}
export function makeGrant(secrets) {
  return { version: 'steer-authorization/v1', organizationId, records: [{ issuer, subject: secrets.subject, organizationId,
    type: 'human', hats, toolGrants: ['session.context', 'intent.brief.preview', 'intent.brief.save.status'], active: true,
    validAfter: secrets.createdAt, expiresAt: new Date(Date.parse(secrets.createdAt) + 30 * 86400000).toISOString() }] };
}
export function makeProfile(ca) {
  return { version: 'steer-local-identity/v1', rendererOrigin: 'http://127.0.0.1:3100', identity: {
    version: 'steer-identity-runtime/v1', browser: { issuer, jwksUri: `${issuer}/protocol/openid-connect/certs`,
      authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`, tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
      redirectUri: 'https://localhost:8443/auth/callback', clientId: 'steer-local-web', audience: 'steer-api' },
    github: { appId: '4836171', authorizationPath: 'operating/local-mac/authorization.json', binding: {
      organizationId, installationId: 159172046, repositoryId: 1349965471, owner: 'idrissenayat', repository: 'steer-platform', branch: 'codex/phase-1-foundation' } },
    database: { host: 'localhost', port: 55432, database: 'steer', transport: { kind: 'tls', ca } }, sessionKeyId: 'local-v1' } };
}
export function composeConfiguration(directory, uid) {
  const labels = { 'steer.local-workspace': 'identity-v1' };
  return { services: {
    postgres: { image: 'postgres:16@sha256:21f6013073bc6b92830a2129570e2f5ec42a6c734b5a985a41e83aa58f54c3c1',
      labels, restart: 'unless-stopped', ports: ['127.0.0.1:55432:5432'], env_file: [`${directory}/postgres.env`],
      volumes: ['database:/var/lib/postgresql/data', `${directory}/tls.key:/steer-key:ro`, `${directory}/tls.crt:/steer-cert:ro`, `${directory}/pg_hba.conf:/steer-hba:ro`],
      tmpfs: ['/run/steer-tls:mode=0700'],
      entrypoint: ['/bin/bash', '-ec', 'cp /steer-key /run/steer-tls/server.key; cp /steer-cert /run/steer-tls/server.crt; cp /steer-hba /run/steer-tls/pg_hba.conf; chown -R postgres:postgres /run/steer-tls; chmod 600 /run/steer-tls/server.key; exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/run/steer-tls/server.crt -c ssl_key_file=/run/steer-tls/server.key -c hba_file=/run/steer-tls/pg_hba.conf'],
      networks: ['identity', 'loopback'] },
    keycloak: { image: 'quay.io/keycloak/keycloak:26.7.3@sha256:ff4257d0d64efbe99ed1ddfaf07765cc3c36dc7518bf8324d41961327f441c54',
      labels, restart: 'unless-stopped', user: `${uid}:0`, mem_limit: '1g', ports: ['127.0.0.1:8444:8443'],
      env_file: [`${directory}/keycloak.env`], environment: { KC_DB: 'postgres', KC_DB_URL: 'jdbc:postgresql://postgres:5432/steer_keycloak?sslmode=verify-full&sslrootcert=/steer-local/tls.crt',
        KC_DB_USERNAME: 'steer_keycloak', KC_HOSTNAME: 'https://localhost:8444', KC_HTTP_ENABLED: 'false',
        KC_HTTPS_CERTIFICATE_FILE: '/steer-local/browser.crt', KC_HTTPS_CERTIFICATE_KEY_FILE: '/steer-local/browser.key' },
      volumes: [`${directory}/browser-tls/server.key:/steer-local/browser.key:ro`, `${directory}/browser-tls/server.crt:/steer-local/browser.crt:ro`, `${directory}/tls.crt:/steer-local/tls.crt:ro`, `${directory}/import:/opt/keycloak/data/import:ro`],
      command: ['start', '--import-realm'], networks: ['identity', 'loopback'] },
  }, volumes: { database: { labels } }, networks: { identity: { internal: true, labels }, loopback: { labels } } };
}
