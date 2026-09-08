import { z } from 'zod';
import type { IntentAgentService } from '@steer/tool-registry/agent-contracts';
import { createIntentDevelopment, type DevelopmentPermit } from '@steer/agents';
import { createMastraDevelopmentRuntime } from '@steer/agents/mastra';
import { createRecordedMastraVerifier, type RecordedRequest, type RecordedResponse } from '@steer/agents/recorded-mastra';
import { createIntentDevelopmentReader } from '@steer/data/intent-development-reader';
import { createAppJwtSigner, createGitHubReader, artifactSelectionSchema, type ArtifactReader } from '@steer/adapters/github';
import { createPostgresBrowserSessionStore } from '@steer/data/browser-session';
import { createRuntimePool } from '@steer/data/runtime-pool';
import { createIdentityService } from './identity-service.ts';
import { createIdentityGateway } from './identity-gateway.ts';
import { startLocalIdentityListener } from './identity-listener.ts';
import { secretReferenceSchema, type SecretProvider } from '@steer/adapters/secrets';
import { artifactProjectionInputSchema, reconciliationScopeSchema, briefDestinationScopeSchema, recordedBriefSchedulingInputSchema,
  recordedBriefRecoveryInputSchema, recordedRecoveryPlanSchema,
  type ReconciliationScheduler, type RecordedBriefScheduler, type RecordedBriefRecoveryScheduler } from '@steer/tool-registry';
import { createArtifactProjectionReader } from '@steer/data/artifact-reader';
import { createProjectionChangeReader } from '@steer/data/projection-changes';
import { createProjectionSnapshotReader } from '@steer/data/projection-snapshot';
import { createProjectionJob, createRecordedBriefProjectionJob } from '@steer/adapters/projection-job';
import { ingestVerifiedArtifact, projectionKey } from '@steer/data/ingestion';
import { readProjection } from '@steer/data';
import { createHeldGitBriefWriterFactory, heldGitBriefConfigurationSchema, type HeldBriefAssessment } from '@steer/adapters/held-brief-writer';

const text = z.string().min(1);
/** Explicit uninstalled reader composition. Current profile allowlists are
 * required, but no gateway secret, model transport or dispatch capability exists. */
export function createVerifiedDevelopmentReader(pools: Parameters<typeof createIntentDevelopmentReader>[0], configuration: unknown,
  dependencies: { records: Parameters<typeof createIntentDevelopmentReader>[2]['records'];
    profiles: Parameters<typeof createRecordedMastraVerifier>[0] }) {
  const verifier = createRecordedMastraVerifier(dependencies.profiles);
  return createIntentDevelopmentReader(pools, configuration, { records: dependencies.records,
    exchange: { verify: async input => verifier.verify(input.role, input.request,
      input.requestObservation as RecordedRequest, input.responseObservation as RecordedResponse).result },
  });
}
const databaseSchema = z.strictObject({ host: text, port: z.number(), database: text,
  transport: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('tls'), ca: text }),
    z.strictObject({ kind: z.literal('isolated-loopback-test') })]) });
export interface ManagedRuntimeScheduler { readonly scheduler: ReconciliationScheduler; shutdown(): Promise<void> }
export interface ManagedRuntimeRecordedScheduler { readonly scheduler: RecordedBriefScheduler; shutdown(): Promise<void> }
export interface ManagedRuntimeRecoveryScheduler { readonly scheduler: RecordedBriefRecoveryScheduler; shutdown(): Promise<void> }
export interface IdentityRuntimeDependencies {
  /** Explicitly configured, budget-controlled agent. Absent means no model calls. */
  intentAgent?: IntentAgentService;
  /** Server-only gateway credential and approved budget ledger, never browser values. */
  modelGateway?: {
    configurationRevision: string;
    options: Parameters<typeof createMastraDevelopmentRuntime>[0];
    permit: DevelopmentPermit;
  };
  identity?: typeof fetch; github?: typeof fetch;
  /** Explicit factory transfers ownership on success; it must clean any allocation if it rejects. */
  createScheduler?: () => Promise<ManagedRuntimeScheduler>;
  /** Separate owned connection and exact recorded operation; never inferred from reconciliation. */
  createRecordedScheduler?: () => Promise<ManagedRuntimeRecordedScheduler>;
  /** Separate owned recovery connection; never inferred from ordinary dispatch or worker ownership. */
  createRecoveryScheduler?: () => Promise<ManagedRuntimeRecoveryScheduler>;
  /** Separate current agent identity, required only for an explicitly HELD source collector. */
  authenticateGateObserver?: () => Promise<unknown>;
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
  readModel: z.strictObject({ database: databaseSchema, paths: z.array(artifactProjectionInputSchema.shape.path).min(1).max(1000), changes: z.literal(true).optional() }).optional(),
  mcp: z.strictObject({ clientIds: z.array(z.string().min(1).max(200)).min(1).max(100).refine((ids) => new Set(ids).size === ids.length) }).optional(),
  scheduling: schedulingSchema.optional(),
  recordedScheduling: recordedBriefSchedulingInputSchema.pick({ itemId: true, idempotencyKey: true }).optional(),
  recordedRecovery: recordedBriefRecoveryInputSchema.pick({ itemId: true, idempotencyKey: true, failedRunId: true }).optional(),
  briefDestination: briefDestinationScopeSchema.pick({ paths: true }).optional(),
  heldBrief: heldGitBriefConfigurationSchema.optional(),
  sessionKeyId: text,
});
const secretsSchema = z.strictObject({ browserClientSecret: text, githubPrivateKeyPem: text,
  databasePassword: text, sessionKeys: z.record(z.string(), z.instanceof(Uint8Array)), readModelDatabasePassword: text.optional() });

const projectionProfileSchema = z.strictObject({ version: z.literal('steer-projection-runtime/v1'),
  github: profileSchema.shape.github.omit({ authorizationPath: true }), database: databaseSchema,
  paths: z.array(artifactProjectionInputSchema.shape.path).min(1).max(100).optional(), selection: artifactSelectionSchema.optional(),
}).refine((value) => Boolean(value.paths) !== Boolean(value.selection));
const projectionSecretsSchema = z.strictObject({ githubPrivateKeyPem: text, databasePassword: text });

const recordedProjectionProfileSchema = z.strictObject({ version: z.literal('steer-recorded-brief-projection-runtime/v1'),
  scope: briefDestinationScopeSchema, database: databaseSchema });

/** Explicit one-shot derived-data runtime. Prebound source/readback identity stays
 * caller-owned; only this runtime's projector database pool transfers ownership.
 * Construction never reads receipts, connects storage or starts a timer/job. */
export async function createRecordedBriefProjectionRuntime(rawProfile: unknown, rawSecrets: unknown, dependencies: {
  reader: ArtifactReader; authenticate: () => Promise<unknown>; readReceipt: () => Promise<unknown>;
}) {
  let pool: ReturnType<typeof createRuntimePool> | undefined;
  try {
    const profile = recordedProjectionProfileSchema.parse(rawProfile);
    const secrets = z.strictObject({ databasePassword: text }).parse(rawSecrets);
    const binding = dependencies.reader.binding;
    if (profile.scope.organizationId !== binding.organizationId || profile.scope.repository !== `github:${binding.repositoryId}` ||
        profile.scope.branch !== binding.branch) throw new Error();
    const owned = createRuntimePool({ ...profile.database, user: 'steer_projector', password: secrets.databasePassword }); pool = owned;
    const job = createRecordedBriefProjectionJob(dependencies.reader, profile.scope, {
      authenticate: dependencies.authenticate, readReceipt: dependencies.readReceipt, shutdownResources: () => owned.shutdown(),
      sink: current => ({
        currentRevision: async (repository, path) => (await readProjection(owned, await current(), projectionKey(repository, path)))?.sourceRevision ?? null,
        ingest: async (snapshot, expected) => ingestVerifiedArtifact(owned, await current(), snapshot, expected),
      }),
    });
    return { runOnce: async () => {
      try { return await job.runOnce(); } catch { throw new Error('Recorded Brief projection did not complete.'); }
    }, shutdown: job.shutdown, status: () => ({ ...job.status(), database: owned.status() }) };
  } catch {
    try { await pool?.shutdown(); } catch { throw new Error('Recorded Brief projection cleanup could not be confirmed.'); }
    throw new Error('Recorded Brief projection configuration could not be initialized.');
  }
}

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
    const gateway = createIdentityGateway({ publicOrigin, rendererOrigin: profile.rendererOrigin, issuer: profile.identity.browser.issuer,
      ...(profile.identity.readModel ? { workspace: { organizationId: profile.identity.github.binding.organizationId,
        repository: `github:${profile.identity.github.binding.repositoryId}` } } : {}) },
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
  let managedRecordedScheduler: ManagedRuntimeRecordedScheduler | undefined;
  let managedRecoveryScheduler: ManagedRuntimeRecoveryScheduler | undefined;
  let stopOwned: Promise<void> | undefined;
  let heldAssessment: HeldBriefAssessment | null = null, holdStopping = false;
  const shutdownPools = async () => {
    return stopOwned ??= (async () => {
      const results = await Promise.allSettled([
        ...pools.map((pool) => pool.shutdown()),
        ...(managedScheduler ? [Promise.resolve().then(() => managedScheduler!.shutdown())] : []),
        ...(managedRecordedScheduler ? [Promise.resolve().then(() => managedRecordedScheduler!.shutdown())] : []),
        ...(managedRecoveryScheduler ? [Promise.resolve().then(() => managedRecoveryScheduler!.shutdown())] : []),
      ]);
      if (results.some((result) => result.status === 'rejected')) throw new Error('Identity runtime resource shutdown failed.');
    })();
  };
  try {
    const profile = profileSchema.parse(rawProfile); const secrets = secretsSchema.parse(rawSecrets);
    if (transports.intentAgent && transports.intentAgent.organizationId !== profile.github.binding.organizationId) throw new Error('Agent scope mismatch.');
    if (transports.intentAgent && transports.modelGateway) throw new Error('Choose one agent binding.');
    const intentAgent = transports.modelGateway ? createIntentDevelopment({ organizationId: profile.github.binding.organizationId,
      configurationRevision: transports.modelGateway.configurationRevision, permit: transports.modelGateway.permit,
      runtime: createMastraDevelopmentRuntime(transports.modelGateway.options) }) : transports.intentAgent;
    if (Boolean(profile.readModel) !== Boolean(secrets.readModelDatabasePassword)) throw new Error('Incomplete read-model binding.');
    if (Boolean(profile.scheduling) !== Boolean(transports.createScheduler)) throw new Error('Incomplete scheduler binding.');
    if (Boolean(profile.recordedScheduling) !== Boolean(transports.createRecordedScheduler) ||
      (transports.createRecordedScheduler !== undefined && typeof transports.createRecordedScheduler !== 'function')) throw new Error('Incomplete recorded scheduler binding.');
    if (Boolean(profile.recordedRecovery) !== Boolean(transports.createRecoveryScheduler) ||
      (transports.createRecoveryScheduler !== undefined && typeof transports.createRecoveryScheduler !== 'function')) throw new Error('Incomplete recovery scheduler binding.');
    if (Boolean(profile.heldBrief) !== Boolean(transports.authenticateGateObserver) ||
      (transports.authenticateGateObserver !== undefined && typeof transports.authenticateGateObserver !== 'function')) throw new Error('Incomplete held observer binding.');
    const appJwt = createAppJwtSigner(profile.github.appId, secrets.githubPrivateKeyPem);
    const reader = createGitHubReader(profile.github.binding, {
      appJwt,
      ...(transports.github ? { fetch: transports.github } : {}),
    });
    const heldFactory = profile.heldBrief ? createHeldGitBriefWriterFactory(profile.github.binding, profile.heldBrief.writer, profile.heldBrief.policy, {
      issuer: profile.browser.issuer, authorizationPath: profile.github.authorizationPath, appJwt,
      fetch: transports.github ?? globalThis.fetch, authenticateObserver: transports.authenticateGateObserver!,
    }) : undefined;
    const destinationScope = profile.briefDestination ? briefDestinationScopeSchema.parse({
      organizationId: reader.binding.organizationId, repository: `github:${reader.binding.repositoryId}`,
      branch: reader.binding.branch, paths: profile.briefDestination.paths,
    }) : undefined;
    const pool = createRuntimePool({ ...profile.database, user: 'steer_auth_runtime', password: secrets.databasePassword }); pools.push(pool);
    let readPool: ReturnType<typeof createRuntimePool> | undefined;
    if (profile.readModel) { readPool = createRuntimePool({ ...profile.readModel.database, user: 'steer_app', password: secrets.readModelDatabasePassword! }); pools.push(readPool); }
    const artifactProjection = readPool && profile.readModel ? createArtifactProjectionReader(readPool, {
      organizationId: profile.github.binding.organizationId, repository: `github:${profile.github.binding.repositoryId}`, paths: profile.readModel.paths,
    }) : undefined;
    const projectionChanges = readPool && profile.readModel?.changes ? createProjectionChangeReader(readPool, {
      organizationId: profile.github.binding.organizationId, repository: `github:${profile.github.binding.repositoryId}`,
    }) : undefined;
    const projectionSnapshot = readPool && profile.readModel?.changes ? createProjectionSnapshotReader(readPool, {
      organizationId: profile.github.binding.organizationId, repository: `github:${profile.github.binding.repositoryId}`,
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
    if (profile.recordedScheduling && transports.createRecordedScheduler) {
      managedRecordedScheduler = await transports.createRecordedScheduler();
      const scheduler = managedRecordedScheduler.scheduler;
      const configured = recordedBriefSchedulingInputSchema.parse({ ...scheduler?.target?.scope, idempotencyKey: scheduler?.target?.idempotencyKey });
      const expected = { organizationId: reader.binding.organizationId, repository: `github:${reader.binding.repositoryId}`, ...profile.recordedScheduling };
      const id = `steer-recorded-brief/v1/${[expected.organizationId, expected.repository, expected.itemId].map(encodeURIComponent).join('/')}/${expected.idempotencyKey}`;
      if (typeof managedRecordedScheduler.shutdown !== 'function' || !scheduler || typeof scheduler.start !== 'function' || typeof scheduler.inspect !== 'function' ||
        (Object.keys(expected) as (keyof typeof expected)[]).some(key => configured[key] !== expected[key]) || scheduler.workflowId !== id) throw new Error('Mismatched recorded scheduler binding.');
    }
    if (profile.recordedRecovery && transports.createRecoveryScheduler) {
      managedRecoveryScheduler = await transports.createRecoveryScheduler();
      const scheduler = managedRecoveryScheduler.scheduler;
      const plan = recordedRecoveryPlanSchema.parse(scheduler?.plan);
      const configured = { ...plan.target.scope, idempotencyKey: plan.target.idempotencyKey, failedRunId: plan.failedRunId };
      const expected = { organizationId: reader.binding.organizationId, repository: `github:${reader.binding.repositoryId}`, ...profile.recordedRecovery };
      const id = `steer-recorded-brief-recovery/v1/${[expected.organizationId, expected.repository, expected.itemId].map(encodeURIComponent).join('/')}/${expected.idempotencyKey}/${expected.failedRunId}`;
      if (typeof managedRecoveryScheduler.shutdown !== 'function' || !scheduler || typeof scheduler.start !== 'function' || typeof scheduler.inspect !== 'function' ||
        (Object.keys(expected) as (keyof typeof expected)[]).some(key => configured[key] !== expected[key]) || scheduler.workflowId !== id) throw new Error('Mismatched recovery scheduler binding.');
    }
    const service = createIdentityService({ ...profile.browser, clientSecret: secrets.browserClientSecret }, {
      reader, authorizationPath: profile.github.authorizationPath,
      sessions: { binding, store, shutdown: shutdownPools },
      ...(heldFactory ? { createBriefWriter: (authenticate: Parameters<typeof heldFactory>[0]) => {
        const writer = heldFactory(authenticate);
        return { ...writer,
          inspect: (...args: Parameters<typeof writer.inspect>) => { heldAssessment = null; return writer.inspect(...args); },
          verifyWriteAuthority: async (...args: Parameters<typeof writer.verifyWriteAuthority>) => {
            heldAssessment = null;
            try { return await writer.verifyWriteAuthority(...args); }
            finally { if (!holdStopping) heldAssessment = writer.assessment(); }
          },
          compareAndCreate: (...args: Parameters<typeof writer.compareAndCreate>) => { heldAssessment = null; return writer.compareAndCreate(...args); },
        };
      } } : {}),
      ...(profile.mcp ? { mcp: profile.mcp } : {}),
      ...((intentAgent || artifactProjection || managedScheduler || managedRecordedScheduler || managedRecoveryScheduler || profile.briefDestination) ? { services: {
        ...(intentAgent ? { intentAgent } : {}),
        ...(destinationScope ? { briefDestination: { scope: Object.freeze({ ...destinationScope,
          paths: Object.freeze([...destinationScope.paths]),
        }), readHead: () => reader.readHead() } } : {}),
        ...(artifactProjection ? { artifactProjection } : {}), ...(managedScheduler ? { reconciliationScheduler: managedScheduler.scheduler } : {}),
        ...(managedRecordedScheduler ? { recordedBriefScheduler: managedRecordedScheduler.scheduler } : {}),
        ...(managedRecoveryScheduler ? { recordedBriefRecoveryScheduler: managedRecoveryScheduler.scheduler } : {}),
        ...(projectionChanges ? { projectionChanges } : {}),
        ...(projectionSnapshot ? { projectionSnapshot } : {}),
      } } : {}),
      ...(transports.identity ? { fetch: transports.identity } : {}),
    });
    return { fetch: service.fetch, shutdown: () => { holdStopping = true; heldAssessment = null; return service.shutdown(); },
      status: () => ({ ...service.status(), database: ownedPool.status(), ...(readPool ? { readModel: readPool.status() } : {}),
        ...(heldFactory ? { heldBrief: { writeAuthorized: false as const, gateVerified: false as const,
          // Historical internal diagnostic only; never a current readiness/authority lease.
          lastAssessment: heldAssessment } } : {}) }) };
  } catch {
    // Startup creates no listener. Dispose any allocated lazy pool before rejecting.
    try { await shutdownPools(); }
    catch { throw new Error('Identity runtime cleanup could not be confirmed.'); }
    throw new Error('Identity runtime configuration could not be initialized.');
  }
}
