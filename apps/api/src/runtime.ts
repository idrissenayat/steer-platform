import { z } from 'zod';
import { createIntentDraftService } from '@steer/data/intent-draft-service';
import { createIntentAdmissionDiscovery } from '@steer/data/intent-admission-discovery';
import { developmentOriginalSchema, developmentOriginalHash as hash, freezeOriginal as freeze } from '@steer/data/development-original-contracts';
import { createCandidateSaveDestination } from '@steer/adapters/candidate-save-destination';
import { createCandidateProposalReader } from '@steer/adapters/candidate-proposal-reader';
import { RECORDED_MASTRA_REVISION, recordedRoleRequestSchema } from '@steer/agents/recorded-mastra';
import { createVerifiedCandidateBundleReader } from './candidate-reader.ts';
import { manageIntentJourney, type ManagedRuntimeIntentJourney, type IntentJourneyConfiguration } from './intent-journey-services.ts';
import { candidateSaveStatusScopeSchema } from '@steer/tool-registry/candidate-save-status-contracts';
import { createCandidateSavePreviewer } from '@steer/data/candidate-save-previewer';
import { createCandidateSavePreparer } from '@steer/data/candidate-save-preparer';
import { createCandidateSaveStarter } from '@steer/data/candidate-save-starter';
import { createCandidatePublicationRecorder } from '@steer/data/candidate-publication-recorder';
import { describeCandidatePublication } from '@steer/adapters/github-candidate-bundle-store';
import { createCandidateSaveReviewer } from '@steer/data/candidate-save-reviewer';
import { createCandidateOriginalStore, candidateOriginalConfigurationSchema } from '@steer/data/candidate-originals';
import { createCandidateSaveStatusReader } from '@steer/adapters/candidate-save-status-reader';
import { candidateBundleStoreConfigurationSchema } from '@steer/adapters/github-candidate-bundle-store';
import { createIntentScopeDiscovery } from '@steer/data/intent-scope-discovery';
import { createIntentRunDiscovery } from '@steer/data/intent-run-discovery';
import { createIntentScopeStarter } from '@steer/data/intent-scope-starter';
import { createIntentScopePreparer } from '@steer/data/intent-scope-preparer';
import { scopeReviewConfigurationSchema } from '@steer/data/scope-review-operations';
import { createScopeReviewReader } from '@steer/data/scope-review-reader';
import { createScopeReviewHistoryReader } from '@steer/data/scope-review-history-reader';
import { intentScopeHistoryInputSchema, type IntentScopeHistoryReader } from '@steer/tool-registry/intent-scope-history-contracts';
import { intentScopeReadInputSchema, type IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';
import { scopeReviewProfileSchema } from '@steer/tool-registry/intent-scope-review';
import { createRecordedScopeMastraVerifier } from '@steer/agents/recorded-mastra';
import { createIntentDraftDiscovery } from '@steer/data/intent-draft-discovery';
import { createIntentDevelopmentReviewer } from '@steer/data/intent-development-reviewer';
import { draftRecordsConfigurationSchema } from '@steer/data/draft-revisions';
import { createIntentCorpusEvidence, type IntentCorpusAuthority } from '@steer/adapters/intent-corpus-evidence';
import type { IntentAgentService } from '@steer/tool-registry/agent-contracts';
import { createIntentDevelopment, type DevelopmentPermit } from '@steer/agents';
import { createMastraDevelopmentRuntime } from '@steer/agents/mastra';
import { createRecordedMastraVerifier, type RecordedRequest, type RecordedResponse } from '@steer/agents/recorded-mastra';
import { createIntentDevelopmentReader } from '@steer/data/intent-development-reader';
import { createIntentDevelopmentHistoryReader } from '@steer/data/intent-development-history-reader';
import { createDevelopmentObservationStore } from '@steer/data/development-observations';
import { createIntentDevelopmentStarter } from '@steer/data/intent-development-starter';
import { createIntentDevelopmentPreparer } from '@steer/data/intent-development-preparer';
import { intentOperationConfigurationSchema } from '@steer/data/intent-operations';
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
/** Explicit, uninstalled reference-only start. No provider client is created;
 * the runtime owner must supply adopted current authority and fixed scheduler. */
export function createRecordedCandidateSaveStarter(pools: Parameters<typeof createCandidateSaveStarter>[0],
  binding: Parameters<typeof describeCandidatePublication>[0], configuration: unknown, publication: unknown,
  dependencies: Parameters<typeof createCandidateSaveStarter>[3]) {
  const config = z.strictObject({ records: candidateOriginalConfigurationSchema, execution: intentOperationConfigurationSchema }).parse(configuration);
  const bound = describeCandidatePublication(binding, publication);
  for (const key of ['organizationId', 'productId', 'repository', 'branch'] as const)
    if (bound.configuration[key] !== config.execution[key]) throw new Error('Candidate start scope mismatch.');
  return createCandidateSaveStarter(pools, config, bound.options, dependencies);
}
/** Explicit and uninstalled. Shares admission identity with the durable worker,
 * but neither creates a provider client nor starts a workflow. */
export function createRecordedCandidateSavePreparer(pools: Parameters<typeof createCandidateSavePreparer>[0],
  binding: Parameters<typeof describeCandidatePublication>[0], configuration: unknown, publication: unknown,
  dependencies: Parameters<typeof createCandidateSavePreparer>[3]) {
  const config = z.strictObject({ records: candidateOriginalConfigurationSchema, execution: intentOperationConfigurationSchema }).parse(configuration);
  const bound = describeCandidatePublication(binding, publication);
  for (const key of ['organizationId', 'productId', 'repository', 'branch'] as const)
    if (bound.configuration[key] !== config.execution[key]) throw new Error('Candidate preparation scope mismatch.');
  return createCandidateSavePreparer(pools, config, bound.options, dependencies);
}
/** Explicit, uninstalled final-package preview. Trusted lifecycle evidence and
 * verified historical SDK readers are required; never a save/grant fallback. */
export function createRecordedCandidateSavePreviewer(pools: Parameters<typeof createCandidateSavePreviewer>[0],
  configuration: unknown, dependencies: Parameters<typeof createCandidateSavePreviewer>[2]) {
  return createCandidateSavePreviewer(pools, configuration, dependencies);
}
/** Final-draft review only. No default installation, confirmation or allocation.
 * The source reviewer and pinned recorded scope reader must be supplied by the
 * existing corpus/records factories; input contains references, never findings. */
export function createRecordedCandidateSaveReviewer(configuration: unknown, dependencies: Parameters<typeof createCandidateSaveReviewer>[1]) {
  return createCandidateSaveReviewer(configuration, dependencies);
}
/** Read-only recovery from adopted, encrypted originals and verified native Git
 * receipts. Explicit factory only: no records activation, workflow or dispatch.
 */
export function createRecordedCandidateSaveStatusReader(pool: Parameters<typeof createCandidateOriginalStore>[0],
  binding: Parameters<typeof createCandidateSaveStatusReader>[1], recordsConfiguration: unknown, publicationConfiguration: unknown,
  dependencies: { records: Parameters<typeof createCandidateOriginalStore>[2];
    provider: Omit<Parameters<typeof createCandidateSaveStatusReader>[3], 'loadOriginal'> }) {
  const recordsConfig = candidateOriginalConfigurationSchema.parse(recordsConfiguration), publication = candidateBundleStoreConfigurationSchema.parse(publicationConfiguration);
  const originals = createCandidateOriginalStore(pool, recordsConfig, dependencies.records);
  try {
    const { organizationId, subject, productId, repository, branch } = recordsConfig;
    const reader = createCandidateSaveStatusReader({ organizationId, subject, productId, repository, branch, itemIds: publication.itemIds }, binding, publication,
      { ...dependencies.provider, loadOriginal: target => originals.read(target) });
    return { scope: reader.scope, read: reader.read, close() { reader.close(); originals.close(); } };
  } catch (error) { originals.close(); throw error; }
}
/** Explicit internal records action, never mounted by an environment flag or a
 * status read. Its clock/records authorities must be separately adopted. The
 * original-bound Git reader is owned here; no caller-supplied success receipt. */
export function createRecordedCandidatePublicationRecorder(pool: Parameters<typeof createCandidateOriginalStore>[0],
  binding: Parameters<typeof createCandidateSaveStatusReader>[1], recordsConfiguration: unknown, publicationConfiguration: unknown,
  dependencies: Parameters<typeof createRecordedCandidateSaveStatusReader>[4]
    & Omit<Parameters<typeof createCandidatePublicationRecorder>[2], 'status'>) {
  const status = createRecordedCandidateSaveStatusReader(pool, binding, recordsConfiguration, publicationConfiguration, dependencies);
  try {
    const recorder = createCandidatePublicationRecorder(pool, recordsConfiguration, {
      status, authorizeRecord: dependencies.authorizeRecord, verifyPublicationClock: dependencies.verifyPublicationClock,
    });
    return { scope: recorder.scope, record: recorder.record, close() { recorder.close(); status.close(); } };
  } catch (error) { status.close(); throw error; }
}
/** Start/recover only retained scope references under current authority. No
 * default installation, source admission or direct model dispatch capability. */
export function createRecordedScopeStarter(pools: Parameters<typeof createIntentScopeStarter>[0], configuration: unknown,
  dependencies: Parameters<typeof createIntentScopeStarter>[2]) {
  return createIntentScopeStarter(pools, configuration, dependencies);
}
/** Explicit preparation only. Current corpus/records/profile authorities are
 * mandatory; no workflow/model call or default activation. */
export function createRecordedScopePreparer(pools: Parameters<typeof createIntentScopePreparer>[0], configuration: unknown,
  profile: unknown, dependencies: Parameters<typeof createIntentScopePreparer>[3]) {
  return createIntentScopePreparer(pools, configuration, profile, dependencies);
}
/** Repository-wide source preparation through the existing verified collector.
 * No caller-provided evidence or environment-only activation path. */
export function createCorpusRecordedScopePreparer(reader: Parameters<typeof createIntentCorpusEvidence>[0],
  pools: Parameters<typeof createIntentScopePreparer>[0], configuration: unknown, profile: unknown, retrievalConfigurationRevision: string,
  dependencies: Omit<Parameters<typeof createIntentScopePreparer>[3], 'evidenceFor' | 'withEvidenceRead'> & { authority: IntentCorpusAuthority }) {
  const config = scopeReviewConfigurationSchema.parse(configuration), { organizationId, productId, repository, branch } = config;
  const corpus = createIntentCorpusEvidence(reader, { organizationId, productId, repository, branch, retrievalConfigurationRevision }, dependencies.authority);
  try {
    const preparer = createIntentScopePreparer(pools, config, profile, { records: dependencies.records, authorizePreparation: dependencies.authorizePreparation,
      withEvidenceRead: (input, current, work) => corpus.withReadSession({ organizationId, productId, repository, branch, scopeInputDigest: input.scopeInputDigest }, current,
        read => work(async () => (await read()).evidence)),
      evidenceFor: async (input, current) => (await corpus.collect({ organizationId, productId, repository, branch, scopeInputDigest: input.scopeInputDigest }, current)).evidence });
    return { scope: preparer.scope, prepare: preparer.prepare, close() { preparer.close(); corpus.close(); } };
  } catch (error) { corpus.close(); throw error; }
}
/** Explicit read-only composition. The server supplies the current exact profile
 * and source/records authority; no credential, model transport or flag activation. */
export function createVerifiedScopeReviewReader(pools: Parameters<typeof createScopeReviewReader>[0], configuration: unknown,
  dependencies: { records: Omit<Parameters<typeof createScopeReviewReader>[2], 'verifyObservation'>; profile: unknown }) {
  const profile = scopeReviewProfileSchema.parse(dependencies.profile);
  const reader = createScopeReviewReader(pools, configuration, { ...dependencies.records,
    originals: { ...dependencies.records.originals, authorizeOriginal: async context => {
      if (JSON.stringify(context.original.profile) !== JSON.stringify(profile)) throw new Error('Scope profile is unavailable.');
      if (await dependencies.records.originals.authorizeOriginal(context) !== undefined) throw new Error('Scope source authority is unavailable.');
    } },
    verifyObservation: async ({ original, batchId, request, response }) => {
      const verifier = await createRecordedScopeMastraVerifier({ scope: original.source.scope, evidence: original.evidence, profile });
      const wire = { adapterRevision: request.adapterRevision, protocol: request.protocol, requestBody: request.requestBody };
      verifier.verifyRequest(batchId, wire);
      if (response) verifier.verify(batchId, wire, { responseBody: response.responseBody, providerRequestId: response.providerRequestId, usage: response.usage, result: response.result });
    },
  });
  return { scope: reader.scope, async read(raw, current) {
    const input = intentScopeReadInputSchema.parse(raw);
    if ((['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== reader.scope[k])) throw new Error('Scope read is unavailable.');
    return reader.read({ reviewId: input.reviewId, preparationDigest: input.preparationDigest }, current);
  }, close: reader.close } satisfies IntentScopeReader & { close(): void };
}
/** Explicit historical read factory. The supplied profile is currently authorized
 * for retained evidence verification, not for renewed execution. Never installed
 * by an environment flag, and never substitutes history for current clearance. */
export function createVerifiedScopeReviewHistoryReader(pools: Parameters<typeof createScopeReviewHistoryReader>[0], configuration: unknown,
  dependencies: { records: Omit<Parameters<typeof createScopeReviewHistoryReader>[2], 'verifyObservation'>; profile: unknown }) {
  const profile = scopeReviewProfileSchema.parse(dependencies.profile);
  const reader = createScopeReviewHistoryReader(pools, configuration, { ...dependencies.records,
    originals: { ...dependencies.records.originals, authorizeOriginal: async context => {
      if (JSON.stringify(context.original.profile) !== JSON.stringify(profile)) throw new Error('Scope profile is unavailable.');
      if (await dependencies.records.originals.authorizeOriginal(context) !== undefined) throw new Error('Scope source authority is unavailable.');
    } },
    verifyObservation: async ({ original, batchId, request, response }) => {
      const verifier = await createRecordedScopeMastraVerifier({ scope: original.source.scope, evidence: original.evidence, profile });
      const wire = { adapterRevision: request.adapterRevision, protocol: request.protocol, requestBody: request.requestBody };
      verifier.verifyRequest(batchId, wire);
      if (response) verifier.verify(batchId, wire, { responseBody: response.responseBody, providerRequestId: response.providerRequestId, usage: response.usage, result: response.result });
    },
  });
  return { scope: reader.scope, async read(raw, current) {
    const input = intentScopeHistoryInputSchema.parse(raw);
    if ((['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== reader.scope[k])) throw new Error('Scope read is unavailable.');
    return reader.read({ reviewId: input.reviewId, preparationDigest: input.preparationDigest }, current);
  }, close: reader.close } satisfies IntentScopeHistoryReader & { close(): void };
}
/** Connect actual repository enumeration to the existing review query. Trusted
 * product/lifecycle/read authorities remain mandatory; never installed by flags. */
export function createCorpusRecordedDevelopmentReviewer(reader: Parameters<typeof createIntentCorpusEvidence>[0], configuration: unknown,
  retrievalConfigurationRevision: string, dependencies: Omit<Parameters<typeof createIntentDevelopmentReviewer>[1], 'evidenceFor' | 'withEvidenceRead'> & { authority: IntentCorpusAuthority }) {
  const config = draftRecordsConfigurationSchema.parse(configuration), { organizationId, productId, repository, branch } = config;
  const corpus = createIntentCorpusEvidence(reader, { organizationId, productId, repository, branch, retrievalConfigurationRevision }, dependencies.authority);
  try {
    const reviewer = createIntentDevelopmentReviewer(config, { drafts: dependencies.drafts, authorizeReview: dependencies.authorizeReview,
      withEvidenceRead: (input, current, work) => corpus.withReadSession({ organizationId, productId, repository, branch, scopeInputDigest: input.scopeInputDigest }, current,
        read => work(async () => (await read()).evidence)),
      evidenceFor: async (input, current) => (await corpus.collect({ organizationId, productId, repository, branch, scopeInputDigest: input.scopeInputDigest }, current)).evidence });
    return { scope: reviewer.scope, review: reviewer.review, close() { reviewer.close(); corpus.close(); } };
  } catch (error) { corpus.close(); throw error; }
}
/** Owner-bound discovery is metadata only and remains uninstalled by default. */
export function createRecordedScopeDiscovery(pool: Parameters<typeof createIntentScopeDiscovery>[0], configuration: unknown,
  dependencies: Parameters<typeof createIntentScopeDiscovery>[2]) {
  return createIntentScopeDiscovery(pool, configuration, dependencies);
}
/** Explicit all-revision metadata history; never installed without real records authority. */
export function createRecordedRunDiscovery(pool: Parameters<typeof createIntentRunDiscovery>[0], configuration: unknown,
  dependencies: Parameters<typeof createIntentRunDiscovery>[2]) {
  return createIntentRunDiscovery(pool, configuration, dependencies);
}
/** Owner-bound discovery is metadata only and remains uninstalled by default. */
export function createRecordedDraftDiscovery(pool: Parameters<typeof createIntentDraftDiscovery>[0], configuration: unknown,
  dependencies: Parameters<typeof createIntentDraftDiscovery>[2]) {
  return createIntentDraftDiscovery(pool, configuration, dependencies);
}
/** Read-only reviewed metadata; real evidence and records authorities are mandatory. */
export function createRecordedDevelopmentReviewer(configuration: unknown, dependencies: Parameters<typeof createIntentDevelopmentReviewer>[1]) {
  return createIntentDevelopmentReviewer(configuration, dependencies);
}
/** Explicit owner-bound preparation; never derive profile, budget or evidence
 * authority from browser fields or install this service by default. */
export function createRecordedDevelopmentPreparer(pools: Parameters<typeof createIntentDevelopmentPreparer>[0], configuration: unknown,
  profiles: unknown, dependencies: Parameters<typeof createIntentDevelopmentPreparer>[3]) {
  return createIntentDevelopmentPreparer(pools, configuration, profiles, dependencies);
}
/** New journey composition: source-assessed direction and an exact versioned
 * full-source context digest are mandatory. A pinned
 * recorded reader, not browser findings, supplies and revalidates provenance.
 * Legacy preparation remains available only for historical/uninstalled consumers. */
export function createAssessedRecordedDevelopmentPreparer(pools: Parameters<typeof createIntentDevelopmentPreparer>[0], configuration: unknown,
  profiles: unknown, dependencies: Omit<Parameters<typeof createIntentDevelopmentPreparer>[3], 'requireScopeReview'> & {
    scope: Parameters<typeof createVerifiedScopeReviewReader>[2];
  }) {
  const { action: _action, budget: _budget, expiresAt: _expiry, ...recordsConfig } = intentOperationConfigurationSchema.parse(configuration);
  const reader = createVerifiedScopeReviewReader(pools, recordsConfig, dependencies.scope);
  try {
    const preparer = createIntentDevelopmentPreparer(pools, configuration, profiles, { ...dependencies, requireScopeReview: true,
      records: { ...dependencies.records, scopeReview: reader } });
    return { scope: preparer.scope, prepare: preparer.prepare, close() { preparer.close(); reader.close(); } };
  } catch (error) { reader.close(); throw error; }
}
/** Explicit uninstalled composition; no queue, authority or records fallback. */
export function createRecordedDevelopmentStarter(pools: Parameters<typeof createIntentDevelopmentStarter>[0], configuration: unknown,
  dependencies: Parameters<typeof createIntentDevelopmentStarter>[2]) {
  return createIntentDevelopmentStarter(pools, configuration, dependencies);
}
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
/** Server-only retained exchange verification. The returned wire/source content
 * is private lineage input, not an HTTP response. No transport/key configuration,
 * execution methods or default runtime binding are exposed. */
export function createVerifiedDevelopmentHistoryExchangeReader(pools: Parameters<typeof createDevelopmentObservationStore>[0], configuration: unknown,
  dependencies: {records: Omit<Parameters<typeof createDevelopmentObservationStore>[2],'verifyHistoricalExchange'>;
    profiles: Parameters<typeof createRecordedMastraVerifier>[0]}) {
  const verifier = createRecordedMastraVerifier(dependencies.profiles);
  const reader = createDevelopmentObservationStore(pools,configuration,{...dependencies.records,
    verifyHistoricalExchange:async ({role,request,response}) => {
      const rendered = z.object({request:z.unknown()}).parse(request.rendered);
      verifier.verify(role,rendered.request,request as RecordedRequest,response as RecordedResponse);
    },
  });
  return {read:reader.readHistoricalExchange,close:reader.close};
}
/** Explicit, uninstalled human history projection. Raw SDK exchanges stay inside
 * the records reader; the public service returns parsed documents and lineage. */
export function createVerifiedDevelopmentHistoryReader(pools:Parameters<typeof createIntentDevelopmentHistoryReader>[0],configuration:unknown,
  dependencies:Parameters<typeof createVerifiedDevelopmentHistoryExchangeReader>[2]){
  const verifier=createRecordedMastraVerifier(dependencies.profiles);
  return createIntentDevelopmentHistoryReader(pools,configuration,{...dependencies.records,
    verifyHistoricalExchange:async({role,request,response})=>{
      const rendered=z.object({request:z.unknown()}).parse(request.rendered);
      verifier.verify(role,rendered.request,request as RecordedRequest,response as RecordedResponse);
    },
  });
}
const databaseSchema = z.strictObject({ host: text, port: z.number(), database: text,
  transport: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('tls'), ca: text }),
    z.strictObject({ kind: z.literal('isolated-loopback-test') })]) });
export interface ManagedRuntimeScheduler { readonly scheduler: ReconciliationScheduler; shutdown(): Promise<void> }
export interface ManagedRuntimeRecordedScheduler { readonly scheduler: RecordedBriefScheduler; shutdown(): Promise<void> }
export interface ManagedRuntimeRecoveryScheduler { readonly scheduler: RecordedBriefRecoveryScheduler; shutdown(): Promise<void> }
export interface IdentityRuntimeDependencies {
  /** Explicit complete bundle, transferred only after separate records/activation authority. No environment fallback. */
  createIntentJourney?: (configuration: IntentJourneyConfiguration) => Promise<ManagedRuntimeIntentJourney>;
  /** Verifies adopted records, approved bindings and current bundle use. Never a substitute for action-time grants. */
  authorizeIntentJourney?: (context: Readonly<{ configuration: IntentJourneyConfiguration; action: 'activate' | 'use' }>) => Promise<void>;
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
  intentJourney: candidateOriginalConfigurationSchema.extend({ itemIds: candidateSaveStatusScopeSchema.shape.itemIds }).optional(),
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
  let ownedJourney: ManagedRuntimeIntentJourney | undefined;
  let managedJourney: ReturnType<typeof manageIntentJourney> | undefined;
  let stopOwned: Promise<void> | undefined;
  let heldAssessment: HeldBriefAssessment | null = null, holdStopping = false;
  const shutdownPools = async () => {
    return stopOwned ??= (async () => {
      // Journey callbacks may still require current identity or read-model data
      // after a transport timeout. Drain them before closing shared pools.
      let journeyFailed = false;
      try { if (managedJourney) await managedJourney.shutdown(); else if (ownedJourney) await ownedJourney.shutdown(); }
      catch { journeyFailed = true; }
      const results = await Promise.allSettled([
        ...pools.map((pool) => pool.shutdown()),
        ...(managedScheduler ? [Promise.resolve().then(() => managedScheduler!.shutdown())] : []),
        ...(managedRecordedScheduler ? [Promise.resolve().then(() => managedRecordedScheduler!.shutdown())] : []),
        ...(managedRecoveryScheduler ? [Promise.resolve().then(() => managedRecoveryScheduler!.shutdown())] : []),
      ]);
      if (journeyFailed || results.some((result) => result.status === 'rejected')) throw new Error('Identity runtime resource shutdown failed.');
    })();
  };
  try {
    const profile = profileSchema.parse(rawProfile); const secrets = secretsSchema.parse(rawSecrets);
    if (Boolean(profile.intentJourney) !== Boolean(transports.createIntentJourney)
      || Boolean(profile.intentJourney) !== Boolean(transports.authorizeIntentJourney)
      || (transports.createIntentJourney !== undefined && typeof transports.createIntentJourney !== 'function')
      || (transports.authorizeIntentJourney !== undefined && typeof transports.authorizeIntentJourney !== 'function')) throw new Error('Incomplete intent journey binding.');
    if (profile.intentJourney && (profile.intentJourney.organizationId !== profile.github.binding.organizationId
      || profile.intentJourney.repository !== `github:${profile.github.binding.repositoryId}` || profile.intentJourney.branch !== profile.github.binding.branch
      || transports.intentAgent || transports.modelGateway)) throw new Error('Mismatched or ambiguous intent journey binding.');
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
    if (profile.intentJourney) {
      const configuration = Object.freeze({ ...profile.intentJourney, itemIds: Object.freeze([...profile.intentJourney.itemIds]) });
      const authority = async (action: 'activate' | 'use') => {
        if (await transports.authorizeIntentJourney!(Object.freeze({ configuration, action })) !== undefined) throw new Error('Intent journey authority unavailable.');
      };
      // No service is mounted while factory construction or current policy is
      // incomplete. Factories must be lazy and clean allocations if they reject.
      await authority('activate');
      ownedJourney = await transports.createIntentJourney!(configuration);
      managedJourney = manageIntentJourney(configuration, ownedJourney, () => authority('use'));
      await authority('activate');
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
      ...((managedJourney || intentAgent || artifactProjection || managedScheduler || managedRecordedScheduler || managedRecoveryScheduler || profile.briefDestination) ? { services: {
        ...(managedJourney ? managedJourney.services : {}),
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
export { createCandidateProposalReader as createVerifiedCandidateProposalReader } from '@steer/adapters/candidate-proposal-reader';
export { createIntentAdmissionDiscovery as createRecordedAdmissionDiscovery } from '@steer/data/intent-admission-discovery';
export { createNewCandidateSaveDestination as createVerifiedNewCandidateDestination } from '@steer/adapters/new-candidate-destination';
export { createExistingCandidateSaveDestination as createVerifiedExistingCandidateDestination } from '@steer/adapters/existing-candidate-destination';
export { createCandidateSaveDestination as createVerifiedCandidateSaveDestination } from '@steer/adapters/candidate-save-destination';

const roleProfile = recordedRoleRequestSchema.omit({ runtimeRevision: true, source: true, outputContract: true }).extend({
  allowedResponseModels: z.array(recordedRoleRequestSchema.shape.modelRoute).min(1).max(20).refine(v => new Set(v).size === v.length),
});
export const intentJourneyFactoryConfigurationSchema = z.strictObject({
  scope: scopeReviewConfigurationSchema,
  development: intentOperationConfigurationSchema,
  candidate: intentOperationConfigurationSchema,
  scopeProfile: scopeReviewProfileSchema,
  developmentProfiles: z.strictObject({ architect: roleProfile, testAgent: roleProfile }),
  retrievalConfigurationRevision: z.string().min(1).max(100),
  publication: candidateBundleStoreConfigurationSchema,
});
type ScopeRecords = Parameters<typeof createVerifiedScopeReviewReader>[2]['records'];
type ScopeHistory = Parameters<typeof createVerifiedScopeReviewHistoryReader>[2]['records'];
type DevelopmentRecords = Parameters<typeof createVerifiedDevelopmentReader>[2]['records'];
type DevelopmentOriginals = Omit<DevelopmentRecords['originals'], 'scopeReview' | 'scopeHistory'>;
type DevelopmentHistory = Parameters<typeof createVerifiedDevelopmentHistoryReader>[2]['records'];

/** Owned transports/pools are created by the authorized runtime binding, not by
 * browser input. shutdown must drain their actual leases and pending I/O. This
 * factory takes ownership on entry when a valid shutdown method is present. */
export interface IntentJourneyFactoryDependencies {
  resources: {
    pools: Parameters<typeof createRecordedScopeStarter>[0];
    reader: Parameters<typeof createCandidateSaveDestination>[0] & Parameters<typeof createCandidateProposalReader>[0];
    shutdown(): Promise<void>;
  };
  drafts: Parameters<typeof createIntentDraftService>[2];
  discovery: {
    drafts: Parameters<typeof createRecordedDraftDiscovery>[2];
    runs: Parameters<typeof createRecordedRunDiscovery>[2];
    scopes: Parameters<typeof createRecordedScopeDiscovery>[2];
    admissions: Parameters<typeof createIntentAdmissionDiscovery>[2];
  };
  corpus: Parameters<typeof createIntentCorpusEvidence>[2];
  scope: {
    records: ScopeRecords;
    history: ScopeHistory;
    authorizePreparation: Parameters<typeof createCorpusRecordedScopePreparer>[5]['authorizePreparation'];
    scheduler: Parameters<typeof createRecordedScopeStarter>[2]['scheduler'];
    authorizeStart: Parameters<typeof createRecordedScopeStarter>[2]['authorizeStart'];
  };
  development: {
    records: Omit<DevelopmentRecords, 'originals'> & { originals: DevelopmentOriginals };
    history: Omit<DevelopmentHistory, 'originals'> & { originals: DevelopmentOriginals };
    authorizeReview: Parameters<typeof createCorpusRecordedDevelopmentReviewer>[3]['authorizeReview'];
    authorizePreparation: Parameters<typeof createAssessedRecordedDevelopmentPreparer>[3]['authorizePreparation'];
    scheduler: Parameters<typeof createRecordedDevelopmentStarter>[2]['scheduler'];
    authorizeStart: Parameters<typeof createRecordedDevelopmentStarter>[2]['authorizeStart'];
  };
  candidate: {
    destination: Parameters<typeof createCandidateSaveDestination>[2];
    authorizeReview: Parameters<typeof createRecordedCandidateSaveReviewer>[1]['authorizeReview'];
    authorizePreview: Parameters<typeof createRecordedCandidateSavePreviewer>[2]['authorizePreview'];
    confirmation: Omit<Parameters<typeof createRecordedCandidateSavePreparer>[4], 'drafts' | 'previewer'>;
    start: Omit<Parameters<typeof createRecordedCandidateSaveStarter>[4], 'drafts'>;
    status: Parameters<typeof createRecordedCandidateSaveStatusReader>[4];
    publication: Pick<Parameters<typeof createRecordedCandidatePublicationRecorder>[4], 'authorizeRecord' | 'verifyPublicationClock'>;
    authorizeRead: Parameters<typeof createVerifiedCandidateBundleReader>[2];
    authorizeProposals: Parameters<typeof createCandidateProposalReader>[2];
  };
}
const fail = () => new Error('Intent journey construction is unavailable.');

/** Concrete constructor graph for the governed identity runtime. No mock service
 * inventory, caller-supplied evidence/results, model transport, migration, budget
 * provision, Git writer or environment fallback. All policies remain required. */
export async function createOwnedIntentJourney(expected: IntentJourneyConfiguration, raw: unknown,
  deps: IntentJourneyFactoryDependencies): Promise<ManagedRuntimeIntentJourney> {
  if (typeof deps.resources?.shutdown !== 'function') throw fail();
  const resources = deps.resources, owned: Array<{ close(): void }> = [];
  const stopResources = resources.shutdown.bind(resources);
  let stopped: Promise<void> | undefined;
  const shutdown = () => stopped ??= (async () => {
    let failed = false;
    for (const service of [...owned].reverse()) try { service.close(); } catch { failed = true; }
    try { await stopResources(); } catch { failed = true; }
    if (failed) throw new Error('Intent journey construction cleanup failed.');
  })();
  const own = <T extends { close(): void }>(service: T): T => { owned.push(service); return service; };
  try {
    if ([resources.pools?.drafts?.connect, resources.pools?.execution?.connect, resources.reader?.readHead,
      resources.reader?.readArtifact, resources.reader?.readInventory, resources.reader?.readScopeInventory,
      resources.reader?.readDirectoryInventory].some(v => typeof v !== 'function')
      || resources.pools.drafts === resources.pools.execution) throw fail();
    const { itemIds, ...rawRecords } = expected;
    const records = freeze(draftRecordsConfigurationSchema.parse(rawRecords));
    const config = freeze(intentJourneyFactoryConfigurationSchema.parse(raw));
    const binding = resources.reader.binding;
    const publication = describeCandidatePublication(binding, config.publication);
    for (const execution of [config.scope, config.development, config.candidate])
      if ((Object.keys(records) as Array<keyof typeof records>).some(k => execution[k] !== records[k])) throw fail();
    if (config.development.action !== 'develop' || config.candidate.action !== 'candidate-save' || config.candidate.budget !== null
      || hash(config.scope.budget) !== hash(config.development.budget)
      || config.scope.scopeTerms.profileDigest !== hash(['steer-scope-review-profile/v1', config.scopeProfile])
      || (['organizationId', 'productId', 'repository', 'branch'] as const).some(k => publication.configuration[k] !== records[k])
      || !Array.isArray(itemIds) || new Set(itemIds).size !== itemIds.length
      || itemIds.length !== config.publication.itemIds.length || itemIds.some(id => !config.publication.itemIds.includes(id))) throw fail();
    const configuration = freeze({ ...records, itemIds: [...itemIds] });
    const pools = resources.pools, { organizationId, subject, productId, repository, branch } = records;
    const candidateScope = { organizationId, subject, productId, repository, branch, itemIds: [...itemIds] };
    const scopeBindings = { records: deps.scope.records, profile: config.scopeProfile };
    const scopeReader = own(createVerifiedScopeReviewReader(pools, records, scopeBindings));
    const scopeHistory = own(createVerifiedScopeReviewHistoryReader(pools, records, { records: deps.scope.history, profile: config.scopeProfile }));
    const originalRecords = { ...deps.development.records.originals, scopeReview: scopeReader, scopeHistory };
    const historicalOriginals = { ...deps.development.history.originals, scopeReview: scopeReader, scopeHistory };
    const developmentRecords = { ...deps.development.records, originals: originalRecords };
    const historyRecords = { ...deps.development.history, originals: historicalOriginals };
    const drafts = own(createIntentDraftService(pools.drafts, records, deps.drafts));
    const sourceReview = own(createCorpusRecordedDevelopmentReviewer(resources.reader, records, config.retrievalConfigurationRevision,
      { drafts, authority: deps.corpus, authorizeReview: deps.development.authorizeReview }));
    const corpus = own(createIntentCorpusEvidence(resources.reader, { organizationId, productId, repository, branch,
      retrievalConfigurationRevision: config.retrievalConfigurationRevision }, deps.corpus));
    // Derive preserved role profiles from the same allowlisted SDK profiles used
    // by current and historical readers. There is no independently mutable copy.
    const sourceProfile = (profile: z.infer<typeof roleProfile>) => ({ configurationRevision: profile.profileRevision,
      runtimeRevision: RECORDED_MASTRA_REVISION, modelRoute: profile.modelRoute, maxOutputTokens: profile.maxOutputTokens, instructions: profile.instructions });
    const profiles = developmentOriginalSchema.shape.profiles.parse({ architect: sourceProfile(config.developmentProfiles.architect),
      testAgent: sourceProfile(config.developmentProfiles.testAgent) });
    const developmentHistory = own(createVerifiedDevelopmentHistoryReader(pools, records,
      { records: historyRecords, profiles: config.developmentProfiles }));
    const review = own(createRecordedCandidateSaveReviewer(records, { drafts, sources: sourceReview,
      scopeReview: scopeReader, authorizeReview: deps.candidate.authorizeReview }));
    const destination = own(createCandidateSaveDestination(resources.reader,
      { ...candidateScope, configurationRevision: records.configurationRevision }, deps.candidate.destination));
    const previewer = own(createRecordedCandidateSavePreviewer(pools, { ...records, serviceCommitter: config.publication.serviceCommitter },
      { drafts, review, history: developmentHistory, originals: historicalOriginals, destination, authorizePreview: deps.candidate.authorizePreview }));
    const candidateConfiguration = { records, execution: config.candidate };
    const services = {
      intentDrafts: drafts,
      intentDraftDiscovery: own(createRecordedDraftDiscovery(pools.drafts, records, deps.discovery.drafts)),
      intentRunDiscovery: own(createRecordedRunDiscovery(pools.drafts, records, deps.discovery.runs)),
      intentAdmissionDiscovery: own(createIntentAdmissionDiscovery(pools, { records, executions: [
        { kind: 'scope', configuration: config.scope }, { kind: 'development', configuration: config.development },
      ] }, deps.discovery.admissions)),
      intentScopeDiscovery: own(createRecordedScopeDiscovery(pools.drafts, records, deps.discovery.scopes)),
      intentScopePreparer: own(createCorpusRecordedScopePreparer(resources.reader, pools, config.scope, config.scopeProfile,
        config.retrievalConfigurationRevision, { records: deps.scope.records.originals, authority: deps.corpus,
          authorizePreparation: deps.scope.authorizePreparation })),
      intentScopeStarter: own(createRecordedScopeStarter(pools, records, { records: deps.scope.records.originals,
        scheduler: deps.scope.scheduler, authorizeStart: deps.scope.authorizeStart })),
      intentScopeReader: scopeReader, intentScopeHistoryReader: scopeHistory,
      intentDevelopmentReviewReader: sourceReview,
      intentDevelopmentPreparer: own(createAssessedRecordedDevelopmentPreparer(pools, config.development, profiles, {
        records: originalRecords, scope: scopeBindings, authorizePreparation: deps.development.authorizePreparation,
        evidenceFor: async (input, current) => (await corpus.collect({ organizationId, productId, repository, branch,
          scopeInputDigest: input.scopeInputDigest }, current)).evidence,
      })),
      intentDevelopmentStarter: own(createRecordedDevelopmentStarter(pools, records, { records: originalRecords,
        scheduler: deps.development.scheduler, authorizeStart: deps.development.authorizeStart })),
      intentDevelopmentReader: own(createVerifiedDevelopmentReader(pools, records, { records: developmentRecords, profiles: config.developmentProfiles })),
      intentDevelopmentHistoryReader: developmentHistory,
      candidateSaveReviewer: review, candidateSavePreviewer: previewer,
      candidateSavePreparer: own(createRecordedCandidateSavePreparer(pools, binding, candidateConfiguration, config.publication,
        { ...deps.candidate.confirmation, drafts, previewer })),
      candidateSaveStarter: own(createRecordedCandidateSaveStarter(pools, binding, candidateConfiguration, config.publication,
        { ...deps.candidate.start, drafts })),
      candidateSaveStatusReader: own(createRecordedCandidateSaveStatusReader(pools.drafts, binding, records, config.publication, deps.candidate.status)),
      candidateBundleReader: own(createVerifiedCandidateBundleReader(resources.reader, candidateScope, deps.candidate.authorizeRead)),
      candidateProposalReader: own(createCandidateProposalReader(resources.reader, candidateScope, deps.candidate.authorizeProposals)),
    };
    const publicationRecords = own(createRecordedCandidatePublicationRecorder(pools.drafts, binding, records, config.publication,
      { ...deps.candidate.status, ...deps.candidate.publication }));
    const result = { configuration, services, publicationRecords, shutdown } satisfies ManagedRuntimeIntentJourney;
    // Validate the concrete inventory before transferring it. No wrapper method
    // is invoked here; the identity root supplies actual activate/use authority.
    manageIntentJourney(configuration, result, async () => { throw fail(); });
    return result;
  } catch {
    try { await shutdown(); } catch { throw new Error('Intent journey construction cleanup failed.'); }
    throw fail();
  }
}
