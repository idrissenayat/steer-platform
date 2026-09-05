import { z } from 'zod';
import { createAppJwtSigner, createGitHubReader } from '@steer/adapters/github';
import { createPostgresBrowserSessionStore } from '@steer/data/browser-session';
import { createRuntimePool } from '@steer/data/runtime-pool';
import { createIdentityService } from './identity-service.ts';
import { createIdentityGateway } from './identity-gateway.ts';
import { startLocalIdentityListener } from './identity-listener.ts';

const text = z.string().min(1);
const profileSchema = z.strictObject({
  version: z.literal('steer-identity-runtime/v1'),
  browser: z.strictObject({ issuer: text, jwksUri: text, authorizationEndpoint: text,
    tokenEndpoint: text, redirectUri: text, clientId: text, audience: text }),
  github: z.strictObject({ appId: text, authorizationPath: text,
    binding: z.strictObject({ organizationId: text, installationId: z.number(), repositoryId: z.number(),
      owner: text, repository: text, branch: text }) }),
  database: z.strictObject({ host: text, port: z.number(), database: text,
    transport: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('tls'), ca: text }),
      z.strictObject({ kind: z.literal('isolated-loopback-test') })]) }),
  sessionKeyId: text,
});
const secretsSchema = z.strictObject({ browserClientSecret: text, githubPrivateKeyPem: text,
  databasePassword: text, sessionKeys: z.record(z.string(), z.instanceof(Uint8Array)) });

const localProfileSchema = z.strictObject({ version: z.literal('steer-local-identity/v1'), identity: profileSchema, rendererOrigin: text });
const localSecretsSchema = z.strictObject({ identity: secretsSchema, tls: z.strictObject({ key: text, cert: text }) });

/** Explicit opt-in local listener; not wired into default CLI or an environment/secret loader. */
export async function startLocalIdentityRuntime(rawProfile: unknown, rawSecrets: unknown,
  transports: { identity?: typeof fetch; github?: typeof fetch; renderer?: typeof fetch } = {}) {
  let runtime: Awaited<ReturnType<typeof createIdentityRuntime>> | undefined;
  try {
    const profile = localProfileSchema.parse(rawProfile); const secrets = localSecretsSchema.parse(rawSecrets);
    const publicOrigin = new URL(profile.identity.browser.redirectUri).origin;
    runtime = await createIdentityRuntime(profile.identity, secrets.identity, transports);
    const gateway = createIdentityGateway({ publicOrigin, rendererOrigin: profile.rendererOrigin, issuer: profile.identity.browser.issuer },
      { identity: runtime, ...(transports.renderer ? { fetch: transports.renderer } : {}) });
    const listener = await startLocalIdentityListener({ publicOrigin, tls: secrets.tls }, { fetch: gateway.fetch, shutdown: runtime.shutdown });
    const ownedRuntime = runtime;
    return { shutdown: listener.shutdown, status: () => ({ listener: listener.status(), identity: ownedRuntime.status() }) };
  } catch {
    try { if (runtime) await runtime.shutdown(); }
    catch { throw new Error('Local identity runtime cleanup could not be confirmed.'); }
    throw new Error('Local identity runtime could not be initialized.');
  }
}

/** Actual composition root. Explicit values only; never reads environment, files or remote secrets. */
export async function createIdentityRuntime(rawProfile: unknown, rawSecrets: unknown,
  transports: { identity?: typeof fetch; github?: typeof fetch } = {}) {
  let pool: ReturnType<typeof createRuntimePool> | undefined;
  try {
    const profile = profileSchema.parse(rawProfile); const secrets = secretsSchema.parse(rawSecrets);
    const reader = createGitHubReader(profile.github.binding, {
      appJwt: createAppJwtSigner(profile.github.appId, secrets.githubPrivateKeyPem),
      ...(transports.github ? { fetch: transports.github } : {}),
    });
    pool = createRuntimePool({ ...profile.database, user: 'steer_auth_runtime', password: secrets.databasePassword });
    const binding = { issuer: profile.browser.issuer, clientId: profile.browser.clientId, redirectUri: profile.browser.redirectUri };
    const store = createPostgresBrowserSessionStore(pool, { binding,
      keyring: { currentKeyId: profile.sessionKeyId, keys: secrets.sessionKeys } });
    const ownedPool = pool;
    const service = createIdentityService({ ...profile.browser, clientSecret: secrets.browserClientSecret }, {
      reader, authorizationPath: profile.github.authorizationPath,
      sessions: { binding, store, shutdown: () => ownedPool.shutdown() },
      ...(transports.identity ? { fetch: transports.identity } : {}),
    });
    return { fetch: service.fetch, shutdown: service.shutdown,
      status: () => ({ ...service.status(), database: ownedPool.status() }) };
  } catch {
    // Startup creates no listener. Dispose any allocated lazy pool before rejecting.
    try { if (pool) await pool.shutdown(); }
    catch { throw new Error('Identity runtime cleanup could not be confirmed.'); }
    throw new Error('Identity runtime configuration could not be initialized.');
  }
}
