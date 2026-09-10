/** Explicit, owner-invoked local operations. Never imported by the default API. */
import { readFileSync, writeFileSync, mkdirSync, lstatSync, chmodSync, existsSync } from 'node:fs';
import { createHash, randomBytes, randomUUID, X509Certificate } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { makeRealm, makeGrant, makeProfile, composeConfiguration, postgresHba } from './local-workspace-config.mjs';
import { assertLocalMigrationBoundary } from './local-migration-boundary.mjs';
import { inspectLocalRecordsApproval, localD1Decision } from './local-records-approval.mjs';
import { inspectLocalRecordsInventory } from './local-records-inventory.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = join(homedir(), '.config/steer/local-workspace');
const runtimeKey = join(homedir(), '.config/steer/runtime-github/private-key.pem');
const uid = process.getuid();
const action = process.argv[2];
process.umask(0o077);
function privateRead(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== uid || (stat.mode & 0o077)) throw new Error('Unsafe private file permissions.');
  return readFileSync(path, 'utf8');
}
function privateDirectory(path) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== uid || (stat.mode & 0o077)) throw new Error('Unsafe private directory permissions.');
}
function save(name, value) { writeFileSync(join(directory, name), value, { mode: 0o600, flag: 'wx' }); }
function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'], ...options });
  // Provider output can contain credentials. Keep failure reporting content-free.
  if (result.status !== 0) throw new Error(`${program} operation failed; private state retained for recovery.`);
  return result.stdout.trim();
}
function compose(...args) { return command('docker', ['compose', '-p', 'steer-local-workspace', '-f', join(directory, 'compose.json'), ...args]); }
const newSecret = () => randomBytes(32).toString('hex');
function createBrowserCertificate() {
  // New private directory: never overwrite a previous or partially created key.
  const target = join(directory, 'browser-tls');
  mkdirSync(target, { mode: 0o700 }); privateDirectory(target);
  command('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-noenc', '-days', '30', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost', '-addext', 'basicConstraints=critical,CA:FALSE',
    '-addext', 'keyUsage=critical,digitalSignature,keyEncipherment', '-addext', 'extendedKeyUsage=serverAuth',
    '-keyout', join(target, 'server.key'), '-out', join(target, 'server.crt')]);
  chmodSync(join(target, 'server.key'), 0o600); chmodSync(join(target, 'server.crt'), 0o600);
  const cert = new X509Certificate(privateRead(join(target, 'server.crt')));
  if (cert.ca || cert.subjectAltName !== 'DNS:localhost' || !cert.verify(cert.publicKey)) throw new Error('Invalid browser certificate.');
  console.log(JSON.stringify({ browserCertificateSha256: cert.fingerprint256, names: cert.subjectAltName, certificateAuthority: cert.ca, expires: cert.validTo }));
}
async function startSingleUser() {
  privateDirectory(directory);
  const browserCertificate = privateRead(join(directory, 'browser-tls/server.crt'));
  const browserCert = new X509Certificate(browserCertificate);
  if (browserCert.ca || browserCert.subjectAltName !== 'DNS:localhost' || Date.parse(browserCert.validTo) <= Date.now()) throw new Error('Invalid browser certificate scope or expiry.');
  const { startSingleUserWorkspace } = await import('../src/single-user-workspace.ts');
  const next = createRequire(new URL('../../web/package.json', import.meta.url)).resolve('next/dist/bin/next');
  const renderer = spawn(process.execPath, [next, 'start', '-H', '127.0.0.1', '-p', '3100'], {
    cwd: resolve(root, 'apps/web'), env: { PATH: process.env.PATH, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  let runtime; let stopping = false;
  const shutdown = async () => { if (stopping) return; stopping = true; renderer.kill('SIGTERM'); await runtime?.shutdown(); };
  renderer.once('error', () => { void shutdown().finally(() => { process.exitCode = 1; }); });
  renderer.once('exit', () => { if (!stopping) void shutdown().finally(() => { process.exitCode = 1; }); });
  try {
    await new Promise((accept, reject) => { const timer = setTimeout(accept, 1500); renderer.once('exit', () => { clearTimeout(timer); reject(new Error('Renderer startup failed.')); }); });
    runtime = await startSingleUserWorkspace({ key: privateRead(join(directory, 'browser-tls/server.key')), cert: browserCertificate });
    process.once('SIGINT', () => { void shutdown(); }); process.once('SIGTERM', () => { void shutdown(); });
    console.log('STEER is open at https://localhost:8443/. Authentication and Keycloak are disabled. No connected model or GitHub saving.');
  } catch { await shutdown(); throw new Error('Local workspace startup failed.'); }
}

async function main() {
  if (!uid || Number(process.versions.node.split('.')[0]) < 24) throw new Error('Use Node 24+ as the non-root workspace owner.');
  if (!['init', 'prepare-browser-tls', 'configure', 'up', 'migrate', 'verify', 'verify-github', 'start', 'status', 'records-status', 'records-inventory', 'stop-services'].includes(action)) throw new Error('Usage: local-workspace.mjs init|prepare-browser-tls|configure|up|migrate|verify|verify-github|start|status|records-status|records-inventory|stop-services');
  if (action === 'start') { await startSingleUser(); return; }
  if (action === 'records-status') {
    const read = path => readFileSync(resolve(root, path));
    const decision = inspectLocalRecordsApproval(JSON.parse(read('operating/local-mac/records-d1-approval.json')),
      JSON.parse(read('kit/policy/intent-records.json')), read(localD1Decision.path));
    console.log(JSON.stringify(decision)); return;
  }
  if (action === 'migrate') assertLocalMigrationBoundary(JSON.parse(readFileSync(resolve(root, 'packages/data/migrations/meta/_journal.json'), 'utf8')));
  if (action === 'init') {
    // Refuse overwrite, including a partially completed initialization.
    if (existsSync(directory)) throw new Error('Private workspace already exists; initialization will not overwrite it.');
    privateRead(runtimeKey);
    mkdirSync(directory, { mode: 0o700 }); privateDirectory(directory);
    const secrets = { subject: randomUUID(), databaseAdmin: newSecret(), keycloakDatabase: newSecret(),
      authDatabase: newSecret(), appDatabase: newSecret(), projectorDatabase: newSecret(),
      client: newSecret(), admin: newSecret(), temporaryPassword: newSecret(), sessionKey: randomBytes(32).toString('base64'),
      createdAt: new Date().toISOString() };
    save('secrets.json', JSON.stringify(secrets, null, 2));
    command('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-noenc', '-days', '30', '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,DNS:postgres',
      '-addext', 'basicConstraints=critical,CA:FALSE', '-addext', 'keyUsage=critical,digitalSignature,keyEncipherment',
      '-addext', 'extendedKeyUsage=serverAuth', '-keyout', join(directory, 'tls.key'), '-out', join(directory, 'tls.crt')]);
    chmodSync(join(directory, 'tls.key'), 0o600); chmodSync(join(directory, 'tls.crt'), 0o600);
    createBrowserCertificate();
    save('postgres.env', `POSTGRES_PASSWORD=${secrets.databaseAdmin}\nPOSTGRES_DB=steer\n`);
    save('pg_hba.conf', postgresHba);
    save('keycloak.env', `KC_DB_PASSWORD=${secrets.keycloakDatabase}\nKC_BOOTSTRAP_ADMIN_USERNAME=local-recovery-admin\nKC_BOOTSTRAP_ADMIN_PASSWORD=${secrets.admin}\n`);
    mkdirSync(join(directory, 'import'), { mode: 0o700 });
    save('import/steer-local-realm.json', JSON.stringify(makeRealm(secrets), null, 2));
    save('compose.json', JSON.stringify(composeConfiguration(directory, uid), null, 2));
    save('profile.json', JSON.stringify(makeProfile(privateRead(join(directory, 'tls.crt'))), null, 2));
    save('authorization.proposed.json', JSON.stringify(makeGrant(secrets), null, 2) + '\n');
    save('FIRST-LOGIN.txt', `STEER local workspace: https://localhost:8443/\nUsername: idrissenayat\nTemporary password: ${secrets.temporaryPassword}\n\nSet your own password when Keycloak asks. This value then stops working.\nDo not send this file or its contents to chat or Git.\nTLS trust must be configured first; never bypass a certificate warning.\n`);
    console.log('Private bootstrap created. No service started, system trust changed or GitHub write enabled.');
    return;
  }
  privateDirectory(directory);
  const secrets = JSON.parse(privateRead(join(directory, 'secrets.json')));
  const certificate = privateRead(join(directory, 'tls.crt'));
  if (action === 'records-inventory') {
    const { default: pg } = await import('pg');
    const journal = JSON.parse(readFileSync(resolve(root, 'packages/data/migrations/meta/_journal.json'), 'utf8'));
    const known = journal.entries.map(entry => {
      if (!/^[0-9]{4}_[a-z0-9_]+$/.test(entry.tag)) throw new Error('Invalid migration name.');
      return { tag: entry.tag, hash: createHash('sha256').update(readFileSync(resolve(root, `packages/data/migrations/${entry.tag}.sql`))).digest('hex') };
    });
    const client = new pg.Client({ host: 'localhost', port: 55432, database: 'steer', user: 'postgres', password: secrets.databaseAdmin,
      ssl: { ca: certificate, rejectUnauthorized: true }, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
    try {
      await client.connect();
      const result = await inspectLocalRecordsInventory(client, known, JSON.parse(privateRead(join(directory, 'profile.json'))));
      console.log(JSON.stringify(result, null, 2));
    } finally { await client.end(); }
    return;
  }
  if (action === 'prepare-browser-tls') {
    createBrowserCertificate();
    console.log('New localhost-only browser leaf created. Database certificate, identity, data and system trust unchanged.'); return;
  }
  if (action === 'configure') {
    privateRead(join(directory, 'compose.json'));
    if (!existsSync(join(directory, 'pg_hba.conf'))) save('pg_hba.conf', postgresHba);
    // Mechanical regeneration of this command's owned deployment descriptor, never credentials.
    writeFileSync(join(directory, 'compose.json'), JSON.stringify(composeConfiguration(directory, uid), null, 2), { mode: 0o600 });
    console.log('Owned deployment descriptor refreshed; credentials, identity, certificates and data unchanged.'); return;
  }
  if (action === 'status') {
    const cert = new X509Certificate(certificate);
    const browserCert = new X509Certificate(privateRead(join(directory, 'browser-tls/server.crt')));
    console.log(JSON.stringify({ databaseCertificateSha256: cert.fingerprint256, databaseCertificateExpires: cert.validTo,
      browserCertificateSha256: browserCert.fingerprint256, browserCertificateExpires: browserCert.validTo,
      containers: compose('ps', '--all', '--format', 'json').split('\n').filter(Boolean).flatMap(line => JSON.parse(line)), liveSaving: 'disabled' }, null, 2)); return;
  }
  if (action === 'stop-services') { compose('stop'); console.log('Owned containers stopped. All persistent volumes and private files retained.'); return; }
  if (action === 'up') {
    compose('up', '-d', '--pull', 'never', 'postgres');
    console.log('Owned PostgreSQL started. The application starts separately without authentication.'); return;
  }
  if (action === 'verify-github') {
    const assert = (await import('node:assert/strict')).default;
    const { createAppJwtSigner, createGitHubReader } = await import('@steer/adapters/github');
    const { createGitAuthorizationResolver } = await import('@steer/adapters/authorization');
    const profile = JSON.parse(privateRead(join(directory, 'profile.json'))).identity;
    const appJwt = createAppJwtSigner(profile.github.appId, privateRead(runtimeKey));
    for (const path of ['/app', `/app/installations/${profile.github.binding.installationId}`]) {
      const response = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${await appJwt()}`,
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(10000), redirect: 'error' });
      assert.equal(response.status, 200);
      const record = await response.json(); assert.deepEqual(record.permissions, { contents: 'read', metadata: 'read' });
      if (path !== '/app') assert.equal(record.suspended_at, null);
    }
    const reader = createGitHubReader(profile.github.binding, { appJwt });
    const resolver = createGitAuthorizationResolver(reader, profile.github.authorizationPath);
    const expected = makeGrant(secrets).records[0];
    assert.deepEqual(await resolver({ issuer: expected.issuer, subject: expected.subject, organizationId: expected.organizationId }), expected);
    assert.equal(await resolver({ issuer: expected.issuer, subject: 'unconfigured-subject', organizationId: expected.organizationId }), null);
    console.log(JSON.stringify({ realGitMembershipVerified: true, unknownSubjectDenied: true, appAndInstallationContents: 'read', revision: await reader.readHead() })); return;
  }
  if (action === 'migrate') {
    const { default: pg } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const pool = new pg.Pool({ host: 'localhost', port: 55432, database: 'steer', user: 'postgres', password: secrets.databaseAdmin,
      ssl: { ca: certificate, rejectUnauthorized: true }, max: 1, connectionTimeoutMillis: 3000 });
    try {
      const roles = { steer_app: secrets.appDatabase, steer_projector: secrets.projectorDatabase,
        steer_auth_runtime: secrets.authDatabase, steer_keycloak: secrets.keycloakDatabase };
      for (const [role, password] of Object.entries(roles)) {
        if (!/^[a-f0-9]{64}$/.test(password)) throw new Error('Invalid private credential format.');
        if (!(await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount) {
          await pool.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
        }
      }
      if (!(await pool.query("SELECT 1 FROM pg_database WHERE datname = 'steer_keycloak'")).rowCount) await pool.query('CREATE DATABASE steer_keycloak OWNER steer_keycloak');
      await pool.query('REVOKE ALL ON DATABASE steer FROM PUBLIC');
      await pool.query('GRANT CONNECT ON DATABASE steer TO steer_app, steer_projector, steer_auth_runtime');
      await pool.query('REVOKE ALL ON DATABASE steer_keycloak FROM PUBLIC');
      await pool.query('GRANT CONNECT ON DATABASE steer_keycloak TO steer_keycloak');
      await migrate(drizzle(pool), { migrationsFolder: resolve(root, 'packages/data/migrations') });
      const result = await pool.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations');
      if (result.rows[0].count !== 7) throw new Error('Unexpected migration count.');
      console.log('All seven canonical migrations applied over verified TLS; separate least-privilege roles provisioned. No model budget was activated.');
    } finally { await pool.end(); }
    console.log('Database migration complete. No authentication service started.'); return;
  }
  if (action === 'verify') {
    const response = await fetch('https://localhost:8443/health/ready', { signal: AbortSignal.timeout(5000), redirect: 'error' });
    const status = await response.json();
    if (response.status !== 200 || status.authentication !== 'none') throw new Error('Single-user workspace not ready.');
    const page = await fetch('https://localhost:8443/', { signal: AbortSignal.timeout(5000), redirect: 'error' });
    const html = await page.text();
    if (page.status !== 200 || !html.includes('Your workspace.') || html.includes('action="/auth/login"')) throw new Error('Workspace did not open directly.');
    console.log(JSON.stringify(status)); return;
  }
}
main().catch(() => { console.error('Local workspace operation failed; no secrets printed. Existing private state is retained.'); process.exitCode = 1; });
