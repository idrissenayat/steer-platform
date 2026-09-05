import { z } from 'zod';
import { createAppJwtSigner, createGitHubReader, artifactSelectionSchema } from '@steer/adapters/github';
import { createPostgresBrowserSessionStore } from '@steer/data/browser-session';
import { createRuntimePool } from '@steer/data/runtime-pool';
import { createIdentityService } from './identity-service.ts';
import { createIdentityGateway } from './identity-gateway.ts';
import { startLocalIdentityListener } from './identity-listener.ts';
import { secretReferenceSchema, type SecretProvider } from '@steer/adapters/secrets';
import { artifactProjectionInputSchema, reconciliationScopeSchema, type ReconciliationScheduler } from '@steer/tool-registry';
import { createArtifactProjectionReader } from '@steer/data/artifact-reader';
import { createProjectionJob } from '@steer/adapters/projection-job';
import { ingestVerifiedArtifact, projectionKey } from '@steer/data/ingestion';
import { readProjection } from '@steer/data';

const text = z.string().min(1);
const databaseSchema = z.strictObject({ host: text, port: z.number(), database: text,
  transport: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('tls'), ca: text }),
    z.strictObject({ kind: z.literal('isolated-loopback-test') })]) });
export interface ManagedRuntimeScheduler { readonly scheduler: ReconciliationScheduler; shutdown(): Promise<void> }
export interface IdentityRuntimeDependencies {
  identity?: typeof fetch; github?: typeof fetch;
  /** Explicit factory transfers ownership on success; it must clean any allocation if it rejects. */
  createScheduler?: () => Promise<ManagedRuntimeScheduler>;
}
const schedulingSchema = z.strictObject({ itemId: reconciliationScopeSchema.shape.itemId,
  maxRounds: z.number().int().min(1).max(100), minIntervalMs: z.number().int().min(1000).max(86400000) });
const profileSchema = z.strictObject({
  version: z.literal('steer-identity-runtime/v1'),
  browser: z.strictObject({ issuer: text, jwksUri: text, authorizationEndpoint: text,
    tokenEndpoint: text, redirectUri: text, clientId: text, audience: text }),
  github: z.strictObject({ appId: text, authorizationPath: text,
    binding: z.strictObject({ organizationId: text, installationId: z.number(), repositoryId: z.number(),
      owner: text, repository: text, branch: text }) }),
  database: databaseSchema,
  readModel: z.strictObject({ database: databaseSchema, paths: z.array(artifactProjectionInputSchema.shape.path).min(1).max(1000) }).optional(),
  mcp: z.strictObject({ clientIds: z.array(z.string().min(1).max(200)).min(1).max(100).refine((ids) => new Set(ids).size === ids.length) }).optional(),
  scheduling: schedulingSchema.optional(),
  sessionKeyId: text,
});
const secretsSchema = z.strictObject({ browserClientSecret: text, githubPrivateKeyPem: text,
  databasePassword: text, sessionKeys: z.record(z.string(), z.instanceof(Uint8Array)), readModelDatabasePassword: text.optional() });

const projectionProfileSchema = z.strictObject({ version: z.literal('steer-projection-runtime/v1'),
  github: profileSchema.shape.github.omit({ authorizationPath: true }), database: databaseSchema,
  paths: z.array(artifactProjectionInputSchema.shape.path).min(1).max(100).optional(), selection: artifactSelectionSchema.optional(),
}).refine((value) => Boolean(value.paths) !== Boolean(value.selection));
const projectionSecretsSchema = z.strictObject({ githubPrivateKeyPem: text, databasePassword: text });

/** Explicit one-shot job composition; no HTTP dispatch, timer, automatic retry or agent impersonation. */
export async function createProjectionRuntime(rawProfile: unknown, rawSecrets: unknown, dependencies: {
  authenticate: () => Promise<unknown>; github?: typeof fetch;
}) {
  let pool: ReturnType<typeof createRuntimePool> | undefined;
  try {
    const profile = projectionProfileSchema.parse(rawProfile); const secrets = projectionSecretsSchema.parse(rawSecrets);
    if (profile.paths && new Set(profile.paths).size !== profile.paths.length) throw new Error();
    const reader = createGitHubReader(profile.github.binding, { appJwt: createAppJwtSigner(profile.github.appId, secrets.githubPrivateKeyPem),
      ...(dependencies.github ? { fetch: dependencies.github } : {}) });
    const ownedPool = createRuntimePool({ ...profile.database, user: 'steer_projector', password: secrets.databasePassword }); pool = ownedPool;
    const job = createProjectionJob(reader, profile.selection ? { selection: profile.selection } : { paths: profile.paths }, {
      authenticate: dependencies.authenticate, shutdownResources: () => ownedPool.shutdown(), sink: (current) => ({
        currentRevision: async (repository, path) => (await readProjection(ownedPool, await current(), projectionKey(repository, path)))?.sourceRevision ?? null,
        ingest: async (snapshot, expected) => ingestVerifiedArtifact(ownedPool, await current(), snapshot, expected),
      }),
    });
    return { runOnce: job.runOnce, shutdown: job.shutdown, status: () => ({ ...job.status(), database: ownedPool.status() }) };
  } catch {
    try { if (pool) await pool.shutdown(); }
    catch { throw new Error('Projection runtime cleanup could not be confirmed.'); }
    throw new Error('Projection runtime configuration could not be initialized.');
  }
}

const localProfileSchema = z.strictObject({ version: z.literal('steer-local-identity/v1'), identity: profileSchema, rendererOrigin: text });
const localSecretsSchema = z.strictObject({ identity: secretsSchema, tls: z.strictObject({ key: text, cert: text }) });
const encodedSecretsSchema = z.strictObject({ version: z.literal('steer-local-identity-secrets/v1'),
  identity: secretsSchema.extend({ sessionKeys: z.record(z.string(), z.string().regex(/^[A-Za-z0-9+/]{43}=$/)).refine((value) => Object.keys(value).length >= 1 && Object.keys(value).length <= 4) }),
  tls: z.strictObject({ key: text, cert: text }) });

/** Explicit secret-provider input; no provider discovery, environment loading or real binding by default. */
export async function startLocalIdentityFromSecretProvider(rawProfile: unknown, rawReference: unknown, provider: SecretProvider,
  transports: IdentityRuntimeDependencies & { renderer?: typeof fetch } = {}) {
  let plaintext: Uint8Array | undefined;
  const decodedKeys: Uint8Array[] = [];
  try {
    const profile = localProfileSchema.parse(rawProfile); const reference = secretReferenceSchema.parse(rawReference);
    plaintext = await provider.read(reference);
    if (!(plaintext instanceof Uint8Array) || !plaintext.byteLength || plaintext.byteLength > 32768) throw new Error();
    const bundle = encodedSecretsSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)));
    const sessionKeys = Object.fromEntries(Object.entries(bundle.identity.sessionKeys).map(([id, encoded]) => {
      const decoded = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      if (decoded.length !== 32 || btoa(String.fromCharCode(...decoded)) !== encoded) { decoded.fill(0); throw new Error(); }
      decodedKeys.push(decoded); return [id, decoded];
    }));
    return await startLocalIdentityRuntime(profile, { identity: { ...bundle.identity, sessionKeys }, tls: bundle.tls }, transports);
  } catch { throw new Error('Secret-backed local identity runtime could not be initialized.'); }
  finally { if (plaintext instanceof Uint8Array) plaintext.fill(0); for (const key of decodedKeys) key.fill(0); }
}

/** Explicit opt-in local listener; not wired into default CLI or an environment/secret loader. */
export async function startLocalIdentityRuntime(rawProfile: unknown, rawSecrets: unknown,
  transports: IdentityRuntimeDependencies & { renderer?: typeof fetch } = {}) {
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
  transports: IdentityRuntimeDependencies = {}) {
  const pools: ReturnType<typeof createRuntimePool>[] = [];
  let managedScheduler: ManagedRuntimeScheduler | undefined;
  let stopOwned: Promise<void> | undefined;
  const shutdownPools = async () => {
    return stopOwned ??= (async () => {
      const results = await Promise.allSettled([
        ...pools.map((pool) => pool.shutdown()),
        ...(managedScheduler ? [Promise.resolve().then(() => managedScheduler!.shutdown())] : []),
      ]);
      if (results.some((result) => result.status === 'rejected')) throw new Error('Identity runtime resource shutdown failed.');
    })();
  };
  try {
    const profile = profileSchema.parse(rawProfile); const secrets = secretsSchema.parse(rawSecrets);
    if (Boolean(profile.readModel) !== Boolean(secrets.readModelDatabasePassword)) throw new Error('Incomplete read-model binding.');
    if (Boolean(profile.scheduling) !== Boolean(transports.createScheduler)) throw new Error('Incomplete scheduler binding.');
    const reader = createGitHubReader(profile.github.binding, {
      appJwt: createAppJwtSigner(profile.github.appId, secrets.githubPrivateKeyPem),
      ...(transports.github ? { fetch: transports.github } : {}),
    });
    const pool = createRuntimePool({ ...profile.database, user: 'steer_auth_runtime', password: secrets.databasePassword }); pools.push(pool);
    let readPool: ReturnType<typeof createRuntimePool> | undefined;
    if (profile.readModel) { readPool = createRuntimePool({ ...profile.readModel.database, user: 'steer_app', password: secrets.readModelDatabasePassword! }); pools.push(readPool); }
    const artifactProjection = readPool && profile.readModel ? createArtifactProjectionReader(readPool, {
      organizationId: profile.github.binding.organizationId, repository: `github:${profile.github.binding.repositoryId}`, paths: profile.readModel.paths,
    }) : undefined;
    const binding = { issuer: profile.browser.issuer, clientId: profile.browser.clientId, redirectUri: profile.browser.redirectUri };
    const store = createPostgresBrowserSessionStore(pool, { binding,
      keyring: { currentKeyId: profile.sessionKeyId, keys: secrets.sessionKeys } });
    if (profile.scheduling && transports.createScheduler) {
      managedScheduler = await transports.createScheduler();
      const scheduler = managedScheduler.scheduler;
      if (typeof managedScheduler.shutdown !== 'function' || !scheduler || typeof scheduler.start !== 'function' || typeof scheduler.inspect !== 'function' ||
        scheduler.scope.organizationId !== profile.github.binding.organizationId || scheduler.scope.repository !== `github:${profile.github.binding.repositoryId}` ||
        scheduler.scope.itemId !== profile.scheduling.itemId || scheduler.limits.maxRounds !== profile.scheduling.maxRounds ||
        scheduler.limits.minIntervalMs !== profile.scheduling.minIntervalMs) throw new Error('Mismatched scheduler binding.');
    }
    const ownedPool = pool;
    const service = createIdentityService({ ...profile.browser, clientSecret: secrets.browserClientSecret }, {
      reader, authorizationPath: profile.github.authorizationPath,
      sessions: { binding, store, shutdown: shutdownPools },
      ...(profile.mcp ? { mcp: profile.mcp } : {}),
      ...((artifactProjection || managedScheduler) ? { services: {
        ...(artifactProjection ? { artifactProjection } : {}), ...(managedScheduler ? { reconciliationScheduler: managedScheduler.scheduler } : {}),
      } } : {}),
      ...(transports.identity ? { fetch: transports.identity } : {}),
    });
    return { fetch: service.fetch, shutdown: service.shutdown,
      status: () => ({ ...service.status(), database: ownedPool.status(), ...(readPool ? { readModel: readPool.status() } : {}) }) };
  } catch {
    // Startup creates no listener. Dispose any allocated lazy pool before rejecting.
    try { await shutdownPools(); }
    catch { throw new Error('Identity runtime cleanup could not be confirmed.'); }
    throw new Error('Identity runtime configuration could not be initialized.');
  }
}
