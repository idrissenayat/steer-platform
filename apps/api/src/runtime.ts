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
import { createCandidateSavePreviewer, type CandidateGenerationReadPair, type CandidateGenerationReadSession } from '@steer/data/candidate-save-previewer';
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
import { scopeReviewConfigurationSchema, scopeReviewManifestSchema } from '@steer/data/scope-review-operations';
import { createScopeReviewReader } from '@steer/data/scope-review-reader';
import { createScopeReviewHistoryReader } from '@steer/data/scope-review-history-reader';
import { intentScopeHistoryInputSchema, intentScopeHistoryOutputSchema, type IntentScopeHistoryReader } from '@steer/tool-registry/intent-scope-history-contracts';
import { intentScopeReadInputSchema, intentScopeReadOutputSchema, type IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';
import { scopeReviewProfileSchema } from '@steer/tool-registry/intent-scope-review';
import { createRecordedScopeMastraVerifier } from '@steer/agents/recorded-mastra';
import { createIntentDraftDiscovery } from '@steer/data/intent-draft-discovery';
import { createIntentDevelopmentReviewer } from '@steer/data/intent-development-reviewer';
import { draftRecordsConfigurationSchema } from '@steer/data/draft-revisions';
import { createIntentCorpusEvidence, createApplicationIntentCorpusEvidence, type IntentCorpusAuthority } from '@steer/adapters/intent-corpus-evidence';
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

import { createRecordedMastraExchangeVerifier } from '@steer/agents/recorded-mastra';
import type { intentScopeAssessmentSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { prepareIntentScopeReview } from '@steer/tool-registry/intent-scope-review';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import { renderDevelopmentRequest } from '@steer/data/development-requests';
import { intentOperationCodec } from '@steer/data/intent-operations';
import { scopeReviewOperationCodec } from '@steer/data/scope-review-operations';
import { createRecordsContentReader, type RecordsContentLease } from '@steer/data/records-content-reader';
import { recordValuesEqual, type DecodedRecordContents } from '@steer/data/records-content-codecs';
import { intentDevelopmentHistoryInputSchema, verifyIntentDevelopmentHistoryOutput, type IntentDevelopmentHistoryReader } from '@steer/tool-registry/intent-development-history-contracts';

type RecordedHistoryProfiles = Parameters<typeof createRecordedMastraExchangeVerifier>[0];
type RecordedHistoryStep = ReturnType<typeof scopeReviewOperationCodec.step.parse>;
type RecordedHistoryState = RecordedHistoryStep['state'] | 'pending';
type RecordedHistoryRole = 'architect' | 'test-agent';
type RecordedHistoryRoleResult = DecodedRecordContents['decoded']['development_results'][number]['value'];
type RecordedScopeHistorySummary = { reviewId: string; preparationDigest: string;
  batches: Array<{ batchId: string; state: RecordedHistoryState; requestVerified: boolean; responseVerified: boolean; checkpointVerified: boolean }>;
  review: Awaited<ReturnType<typeof validateIntentScopeBatchResults>> };
type RecordedDevelopmentHistorySummary = { operationId: string; inputDigest: string;
  roles: Array<{ role: RecordedHistoryRole; state: RecordedHistoryState; requestVerified: boolean; responseVerified: boolean; checkpointVerified: boolean; result: RecordedHistoryRoleResult | null }> };
const historyUnavailable = () => new Error('Recorded history could not be verified.');
const historyEqual = (actual: unknown, expected: unknown) => { if (!recordValuesEqual(actual, expected)) throw historyUnavailable(); };
const historyOnly = <T,>(rows: readonly T[]): T | undefined => { if (rows.length > 1) throw historyUnavailable(); return rows[0]; };
const historyTime = (raw: unknown) => { const value = raw instanceof Date ? raw.getTime() : typeof raw === 'string' ? Date.parse(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < 0) throw historyUnavailable(); return value; };
const historyOwnership = (metadata: { owner: string; fencingToken: number; reservationId: string; stepInputDigest: string }, step: RecordedHistoryStep) => {
  if (metadata.owner !== step.owner || metadata.fencingToken !== step.fencingToken || metadata.reservationId !== step.reservationId
    || metadata.stepInputDigest !== step.binding.inputDigest) throw historyUnavailable();
};

/** Pure production SDK/lineage verification over already-authorized, decoded
 * records. It has no transport, secret or authority service. A request/response
 * match is neither provider authorship nor semantic accuracy or current consent. */
export function createRecordedHistoryVerifier(profiles: RecordedHistoryProfiles) {
  const sdk = createRecordedMastraExchangeVerifier(profiles);
  return Object.freeze({ async verify(lease: Pick<RecordsContentLease, 'snapshot' | 'contents' | 'check'>) {
    try {
      const { snapshot, contents, check } = lease, decoded = contents.decoded;
      check(); const scopeReviews: RecordedScopeHistorySummary[] = [], developments: RecordedDevelopmentHistorySummary[] = [];
      const counts = { scopeRequests: 0, scopeSdkExchanges: 0, developmentRequests: 0, developmentSdkExchanges: 0, developmentResults: 0 };
      const seenScope = new Set<string>(), seenDevelopment = new Set<string>(), scopeSnapshots = new Map<string, string>();
      for (const saved of decoded.scope_originals) {
        check(); const original = saved.value, c = original.configuration, reviewId = saved.metadata.reviewId;
        if (seenScope.has(reviewId)) throw historyUnavailable(); seenScope.add(reviewId);
        const run = historyOnly(snapshot.data.scope_runs.filter(row => row.review_id === reviewId));
        if (!run || c.budget.budgetId !== snapshot.target.budgetId || run.configuration_digest !== hash(c) || run.preparation_digest !== saved.metadata.preparationDigest
          || historyTime(run.expires_at) !== Date.parse(c.expiresAt) || run.draft_id !== original.source.scope.draftId
          || Number(run.draft_revision) !== original.source.revision) throw historyUnavailable();
        const prepared = await prepareIntentScopeReview(original.source.scope, original.evidence, original.profile); check();
        if (prepared.preparationDigest !== saved.metadata.preparationDigest) throw historyUnavailable();
        const verifier = await createRecordedScopeMastraVerifier({ scope: original.source.scope, evidence: original.evidence, profile: original.profile }); check();
        const steps = snapshot.data.scope_batches.filter(row => row.review_id === reviewId), observations = decoded.scope_observations.filter(row => row.metadata.reviewId === reviewId);
        if (steps.some(row => !prepared.batches.some(batch => batch.metadata.batchId === row.batch_id))) throw historyUnavailable();
        const batches: RecordedScopeHistorySummary['batches'] = [], receipts: Array<{ planDigest: string; batchId: string; assessment: z.infer<typeof intentScopeAssessmentSchema> }> = [];
        let used = 0;
        for (const batch of prepared.batches) {
          check(); const batchId = batch.metadata.batchId, row = historyOnly(steps.filter(row => row.batch_id === batchId));
          const step = row ? scopeReviewOperationCodec.step.parse(row.record) : undefined;
          if (step) {
            historyEqual(step.binding, { organizationId: c.organizationId, operationId: reviewId, stepId: batchId, subject: c.subject,
              draftId: original.source.scope.draftId, draftRevision: original.source.revision, inputDigest: batch.inputDigest, configurationRevision: c.configurationRevision });
            if (row!.budget_id !== c.budget.budgetId || row!.reservation_id !== step.reservationId) throw historyUnavailable();
          }
          const request = historyOnly(observations.filter(row => row.metadata.batchId === batchId && row.metadata.stage === 'request'));
          const response = historyOnly(observations.filter(row => row.metadata.batchId === batchId && row.metadata.stage === 'response'));
          if ((request || response) && (!step || step.state === 'claimed')) throw historyUnavailable();
          for (const observation of [request, response]) if (observation) {
            used++; historyOwnership(observation.metadata, step!);
            if (observation.metadata.preparationDigest !== saved.metadata.preparationDigest || observation.metadata.draftRevision !== original.source.revision) throw historyUnavailable();
          }
          if (request) {
            if (request.value.stage !== 'request') throw historyUnavailable(); historyEqual(request.value.rendered, batch.packet);
            verifier.verifyRequest(batchId, request.value); counts.scopeRequests++;
          }
          if (response) {
            if (!request || request.value.stage !== 'request' || response.value.stage !== 'response'
              || response.value.requestDigest !== request.metadata.payloadDigest) throw historyUnavailable();
            verifier.verify(batchId, request.value, response.value); counts.scopeSdkExchanges++;
          }
          const completed = step?.state === 'succeeded';
          if (completed) {
            if (!response || response.value.stage !== 'response' || response.metadata.payloadDigest !== step.resultDigest) throw historyUnavailable();
            receipts.push({ planDigest: response.value.result.planDigest, batchId, assessment: response.value.result.output });
          }
          batches.push({ batchId, state: step?.state ?? 'pending', requestVerified: Boolean(request), responseVerified: Boolean(response), checkpointVerified: completed });
        }
        if (used !== observations.length) throw historyUnavailable();
        const review = await validateIntentScopeBatchResults(original.evidence, receipts, original.profile.profileRevision); check();
        if (review.planDigest !== prepared.plan.planDigest) throw historyUnavailable();
        scopeReviews.push({ reviewId, preparationDigest: saved.metadata.preparationDigest, batches, review });
        scopeSnapshots.set(reviewId, prepared.plan.sourceSnapshotDigest);
      }
      for (const saved of decoded.development_originals) {
        check(); const original = saved.value, c = original.configuration, source = original.source, operationId = saved.metadata.operationId;
        if (seenDevelopment.has(operationId) || decoded.candidate_originals.some(row => row.metadata.operationId === operationId)) throw historyUnavailable(); seenDevelopment.add(operationId);
        const bound = original.direction.scopeReview;
        if (bound?.kind === 'recorded') {
          const sourceReview = historyOnly(decoded.scope_originals.filter(row => row.metadata.reviewId === bound.reviewId));
          const verifiedReview = historyOnly(scopeReviews.filter(row => row.reviewId === bound.reviewId));
          if (!sourceReview || !verifiedReview || verifiedReview.preparationDigest !== bound.preparationDigest
            || sourceReview.value.source.scope.draftId !== source.draftId || sourceReview.value.source.revision !== source.revision
            || sourceReview.value.source.revisionDigest !== source.revisionDigest || sourceReview.metadata.scopeInputDigest !== source.scopeInputDigest
            || sourceReview.value.evidence.head !== original.evidence.head || scopeSnapshots.get(bound.reviewId) !== original.direction.sourceSnapshotDigest) throw historyUnavailable();
          for (const field of ['organizationId', 'subject', 'productId', 'repository', 'branch'] as const) if (sourceReview.value.configuration[field] !== c[field]) throw historyUnavailable();
          historyEqual(sourceReview.value.evidence.inventory, original.evidence.inventory); historyEqual(verifiedReview.review, bound.results);
        }
        const operation = historyOnly(snapshot.data.operations.filter(row => row.operation_id === operationId));
        if (!operation || operation.action !== 'develop' || operation.configuration_revision !== c.configurationRevision
          || historyTime(operation.expires_at) !== Date.parse(c.expiresAt) || operation.draft_id !== source.draftId || Number(operation.draft_revision) !== source.revision) throw historyUnavailable();
        const binding = intentOperationCodec.binding.parse(operation.binding);
        historyEqual(binding, { draftId: source.draftId, draftRevision: source.revision, inputDigest: saved.metadata.inputDigest, configurationDigest: hash(c) });
        const steps = snapshot.data.steps.filter(row => row.operation_id === operationId), observations = decoded.development_observations.filter(row => row.metadata.operationId === operationId);
        const results = decoded.development_results.filter(row => row.metadata.operationId === operationId);
        if (steps.some(row => !['architect', 'test-agent'].includes(String(row.step_id)))) throw historyUnavailable();
        const roles: RecordedDevelopmentHistorySummary['roles'] = [];
        // Predecessor is assembled historyOnly after validating the succeeded Architect.
        let architect: { checkpoint: { binding: RecordedHistoryStep['binding']; resultRef: string; resultDigest: string; recordsPolicyDigest: string }; result: RecordedHistoryRoleResult } | null = null;
        let usedObservations = 0, usedResults = 0;
        for (const role of ['architect', 'test-agent'] as const) {
          check(); const row = historyOnly(steps.filter(row => row.step_id === role));
          const stored = row ? intentOperationCodec.storedStep(row, c, { ...binding, operationId }, role) : null;
          const request = historyOnly(observations.filter(row => row.metadata.stepId === role && row.metadata.stage === 'request'));
          const response = historyOnly(observations.filter(row => row.metadata.stepId === role && row.metadata.stage === 'response'));
          const result = historyOnly(results.filter(row => row.metadata.stepId === role));
          if (role === 'test-agent' && !architect) {
            if (stored || request || response || result) throw historyUnavailable();
            roles.push({ role, state: 'pending', requestVerified: false, responseVerified: false, checkpointVerified: false, result: null }); continue;
          }
          const predecessor = role === 'architect' ? null : architect;
          const prepared = await renderDevelopmentRequest({ original, operationId, role, predecessor }); check();
          const step = stored ? intentOperationCodec.step.parse(stored.record) : undefined;
          if (step && (step.binding.inputDigest !== prepared.stepReference.stepInputDigest || stored!.predecessorResultDigest !== prepared.stepReference.predecessorResultDigest)) throw historyUnavailable();
          if ((request || response || result) && (!step || step.state === 'claimed')) throw historyUnavailable();
          for (const observation of [request, response]) if (observation) {
            usedObservations++; historyOwnership(observation.metadata, step!);
            if (observation.metadata.inputDigest !== saved.metadata.inputDigest || observation.metadata.draftRevision !== source.revision) throw historyUnavailable();
          }
          if (request) {
            if (request.value.stage !== 'request') throw historyUnavailable(); historyEqual(request.value.rendered, prepared.rendered);
            sdk.verifyRequest(role, prepared.rendered.request, request.value as RecordedRequest); counts.developmentRequests++;
          }
          if (response) {
            if (!request || request.value.stage !== 'request' || response.value.stage !== 'response' || response.value.requestDigest !== request.metadata.payloadDigest) throw historyUnavailable();
            sdk.verify(role, prepared.rendered.request, request.value as RecordedRequest, response.value); counts.developmentSdkExchanges++;
          }
          if (result) {
            usedResults++; historyOwnership(result.metadata, step!);
            if (!response || response.value.stage !== 'response' || result.metadata.predecessorResultDigest !== prepared.stepReference.predecessorResultDigest) throw historyUnavailable();
            historyEqual(response.value.result, result.value);
          }
          const completed = step?.state === 'succeeded';
          if (completed && (!result || stored!.resultRef !== result.metadata.resultRef || step.resultDigest !== result.row.result_digest)) throw historyUnavailable();
          if (role === 'architect' && completed && result?.value.role === 'architect' && result.value.output.questions.length === 0
            && result.value.output.brief !== null && result.value.output.spec !== null) architect = {
            checkpoint: { binding: step.binding, resultRef: result.metadata.resultRef, resultDigest: String(result.row.result_digest), recordsPolicyDigest: c.recordsPolicyDigest }, result: result.value };
          roles.push({ role, state: step?.state ?? 'pending', requestVerified: Boolean(request), responseVerified: Boolean(response), checkpointVerified: completed, result: completed ? result!.value : null });
        }
        if (usedObservations !== observations.length || usedResults !== results.length) throw historyUnavailable(); counts.developmentResults += usedResults;
        developments.push({ operationId, inputDigest: saved.metadata.inputDigest, roles });
      }
      if (seenScope.size !== snapshot.data.scope_runs.length || decoded.scope_originals.length !== snapshot.data.scope_originals.length
        || decoded.development_originals.length !== snapshot.data.development_originals.length
        || counts.scopeRequests + counts.scopeSdkExchanges !== decoded.scope_observations.length
        || counts.developmentRequests + counts.developmentSdkExchanges !== decoded.development_observations.length
        || counts.developmentResults !== decoded.development_results.length) throw historyUnavailable();
      check(); return freeze({ scopeReviews, developments, counts, sdkConsistencyVerified: true as const,
        sourcePermissionsVerified: false as const, profileApprovalVerified: false as const, semanticQualityVerified: false as const,
        candidateExecutionVerified: false as const, executionAuthorized: false as const, retryAuthorized: false as const, gateSigned: false as const });
    } catch { throw historyUnavailable(); }
  } });
}

/** Read-historyOnly production composition. The enclosing owner still requires awaited
 * key/records recheck; source authority and public tool projection remain separate. */
export function createVerifiedRecordsContentReader(pools: Parameters<typeof createRecordsContentReader>[0], config: unknown,
  authority: Parameters<typeof createRecordsContentReader>[2], keys: Parameters<typeof createRecordsContentReader>[3], profiles: RecordedHistoryProfiles,
  options: Parameters<typeof createRecordsContentReader>[4] = {}) {
  const verifier = createRecordedHistoryVerifier(profiles), reader = createRecordsContentReader(pools, config, authority, keys, options);
  return { async withReadSet<T>(target: unknown, current: () => Promise<void>, use: (lease: RecordsContentLease & {
    history: Awaited<ReturnType<typeof verifier.verify>> }) => Promise<T>, signal?: AbortSignal) {
    return reader.withReadSet(target, current, async lease => {
      const history = await verifier.verify(lease); lease.check(); return use(freeze({ ...lease, history }));
    }, signal);
  }, close: reader.close, shutdown: reader.shutdown };
}

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
  const corpus = createApplicationIntentCorpusEvidence(reader, { organizationId, productId, repository, branch, retrievalConfigurationRevision }, dependencies.authority);
  try {
    const preparer = createIntentScopePreparer(pools, config, profile, { records: dependencies.records, authorizePreparation: dependencies.authorizePreparation,
      withEvidenceRead: (input, current, work) => corpus.withReadSession({ organizationId, productId, repository, branch, scopeInputDigest: input.scopeInputDigest }, current,
        read => work(async () => (await read()).evidence)),
      evidenceFor: async (input, current) => (await corpus.collect({ organizationId, productId, repository, branch, scopeInputDigest: input.scopeInputDigest }, current)).evidence });
    return { scope: preparer.scope, prepare: preparer.prepare, close() { preparer.close(); corpus.close(); },
      async shutdown() { preparer.close(); await corpus.shutdown(); } };
  } catch (error) { corpus.close(); throw error; }
}
/** Explicit read-only composition. The server supplies the current exact profile
 * and source/records authority; no credential, model transport or flag activation. */
export function createVerifiedScopeReviewReader(pools: Parameters<typeof createScopeReviewReader>[0], configuration: unknown,
  dependencies: { records: Omit<Parameters<typeof createScopeReviewReader>[2], 'verifyObservation'>; profile: unknown;
    ownedRead?: OwnedScopeReadBinding }) {
  if (dependencies.ownedRead) {
    const reader = createOwnedScopeReadProjection(pools, configuration, dependencies, false);
    return { ...reader, async read(raw: unknown, current: () => Promise<void>) { return freeze(intentScopeReadOutputSchema.parse(await reader.read(raw, current))); } };
  }
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
  dependencies: { records: Omit<Parameters<typeof createScopeReviewHistoryReader>[2], 'verifyObservation'>; profile: unknown;
    ownedRead?: OwnedScopeReadBinding }) {
  if (dependencies.ownedRead) {
    const reader = createOwnedScopeReadProjection(pools, configuration, dependencies, true);
    return { ...reader, async read(raw: unknown, current: () => Promise<void>) { return freeze(intentScopeHistoryOutputSchema.parse(await reader.read(raw, current))); } };
  }
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
type OwnedScopeReadBinding = {
  authority: Parameters<typeof createRecordsContentReader>[2] & Required<Pick<Parameters<typeof createRecordsContentReader>[2], 'authorizeScopeDiscovery'>>;
  keys: Parameters<typeof createRecordsContentReader>[3];
  profiles: RecordedHistoryProfiles;
};

/** Actual scope service projection over one owned decoded snapshot. The binding
 * is supplied only by the trusted runtime, with independent current/history
 * record and key grants. Existing source/profile/draft/review policies still run;
 * a failed owned read never falls back to a recursive or less-authorized reader. */
function createOwnedScopeReadProjection(pools: Parameters<typeof createScopeReviewReader>[0], configuration: unknown,
  dependencies: { records: Omit<Parameters<typeof createScopeReviewReader>[2], 'verifyObservation'>;
    profile: unknown; ownedRead?: OwnedScopeReadBinding }, historical: boolean) {
  const config = freeze(draftRecordsConfigurationSchema.parse(configuration)), profile = freeze(scopeReviewProfileSchema.parse(dependencies.profile));
  const r = dependencies.records, originals = r.originals, binding = dependencies.ownedRead!;
  const recordsAuthority = binding.authority, recordPolicies = recordsAuthority.records, keyServices = binding.keys;
  const history = r as Omit<Parameters<typeof createScopeReviewHistoryReader>[2], 'verifyObservation'>;
  const pins = [
    { owner: r, names: ['authorize', ...(historical ? ['authorizeHistoricalRead', 'authorizeHistoricalReview'] : [])] },
    { owner: originals, names: ['authorize', 'authorizeOriginal', 'authorizeDraft', 'authorizeReview', 'keyForDraft'] },
    { owner: binding.authority, names: ['authorize', 'authorizeScopeDiscovery'] },
  ].flatMap(({ owner, names }) => names.map(name => ({ owner, name, method: Reflect.get(owner, name) })));
  if (pins.some(pin => typeof pin.method !== 'function')) throw historyUnavailable();
  const pinned = () => {
    if (dependencies.records !== r || r.originals !== originals || dependencies.ownedRead !== binding
      || binding.authority !== recordsAuthority || recordsAuthority.records !== recordPolicies || binding.keys !== keyServices
      || pins.some(pin => Reflect.get(pin.owner, pin.name) !== pin.method)) throw historyUnavailable();
  };
  const authority: Parameters<typeof createRecordsContentReader>[2] = {
    ...binding.authority,
    async authorizeScopeDiscovery(context) { pinned(); return recordsAuthority.authorizeScopeDiscovery(context); },
    async authorize(context) {
      pinned();
      if (await originals.authorizeDraft(freeze({ configuration: config, draftId: context.target.draftId, action: 'read' })) !== undefined) throw historyUnavailable();
      pinned(); return binding.authority.authorize(context);
    },
  };
  const reader = createRecordsContentReader(pools, config, authority, binding.keys), verifier = createRecordedHistoryVerifier(binding.profiles);
  const scope = freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, repository: config.repository });
  return { scope, async read(raw: unknown, revalidate: () => Promise<void>) {
    try {
      pinned(); const input = intentScopeReadInputSchema.parse(raw);
      if (typeof revalidate !== 'function' || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])) throw historyUnavailable();
      const target = freeze({ reviewId: input.reviewId, preparationDigest: input.preparationDigest });
      let checkReviewLifetime = () => {};
      const current = async () => {
        pinned(); checkReviewLifetime(); if (await revalidate() !== undefined) throw historyUnavailable(); pinned(); checkReviewLifetime();
        if (await originals.authorize(freeze({ configuration: config, target, action: 'read' })) !== undefined) throw historyUnavailable(); pinned(); checkReviewLifetime();
      };
      const result = await reader.withReadSet({ kind: 'scope-review', mode: historical ? 'history' : 'current', ...target }, current, async lease => {
        const saved = historyOnly(lease.contents.decoded.scope_originals);
        if (!saved || saved.metadata.reviewId !== target.reviewId || saved.metadata.preparationDigest !== target.preparationDigest) throw historyUnavailable();
        const original = saved.value, source = original.source, expired = lease.hasExpired(original.configuration.expiresAt);
        if (original.configuration.budget.budgetId !== lease.snapshot.target.budgetId) throw historyUnavailable();
        if (!historical && !expired) checkReviewLifetime = () => { if (lease.hasExpired(original.configuration.expiresAt)) throw historyUnavailable(); };
        historyEqual(original.profile, profile);
        const grantSources = async () => {
          pinned(); lease.check();
          if (await originals.authorizeOriginal(freeze({ original, action: 'read' })) !== undefined) throw historyUnavailable();
          pinned(); lease.check();
        };
        const grantReview = async () => {
          pinned(); lease.check();
          if (historical) {
            if (await history.authorizeHistoricalReview(freeze({ configuration: original.configuration, request: target })) !== undefined) throw historyUnavailable();
          } else if (!expired && await originals.authorizeReview(freeze({ configuration: original.configuration, request: target })) !== undefined) throw historyUnavailable();
          const manifest = await prepareIntentScopeReview(original.source.scope, original.evidence, profile); lease.check();
          for (const batch of manifest.batches) {
            const batchTarget = freeze({ ...target, batchId: batch.metadata.batchId });
            const result = historical ? await history.authorizeHistoricalRead(freeze({ configuration: config, target: batchTarget }))
              : expired ? undefined : await r.authorize(freeze({ configuration: config, target: batchTarget, action: 'read' }));
            if (result !== undefined) throw historyUnavailable(); pinned(); lease.check();
          }
        };
        await grantSources(); await grantReview();
        const verified = historical || !expired ? historyOnly((await verifier.verify(lease)).scopeReviews) : undefined;
        if ((historical || !expired) && !verified) throw historyUnavailable();
        // No writes, scheduling, retries or model calls occur within this phase.
        await lease.recheck(); await grantReview(); await grantSources(); lease.check();
        const reviewExpired = expired || lease.hasExpired(original.configuration.expiresAt);
        if (!historical && !expired && reviewExpired) throw historyUnavailable();
        if (historical && !reviewExpired) checkReviewLifetime = () => { if (lease.hasExpired(original.configuration.expiresAt)) throw historyUnavailable(); };
        const base = { ...scope, ...target,
          source: { draftId: source.scope.draftId, revision: source.revision, revisionDigest: source.revisionDigest,
            scopeInputDigest: saved.metadata.scopeInputDigest, latestRevision: Number(lease.snapshot.data.latest_revision[0]!.revision) },
          semanticQualityVerified: false, authoritativeClearance: false, savedToGit: false,
          gateSigned: false, executionAuthorized: false, retryAuthorized: false };
        if (!historical && expired) return freeze(intentScopeReadOutputSchema.parse({ ...base,
          kind: 'steer-scope-review-read/v1', status: 'expired', batches: null, review: null }));
        const batches = verified!.batches.map(batch => ({ batchId: batch.batchId, state: batch.state,
          resultDigest: batch.state === 'succeeded'
            ? scopeReviewOperationCodec.step.parse(lease.snapshot.data.scope_batches.find(row => row.batch_id === batch.batchId)!.record).resultDigest : null }));
        const review = verified!.review;
        if (historical) return freeze(intentScopeHistoryOutputSchema.parse({ ...base, kind: 'steer-scope-review-history/v1',
          historical: true, reviewExpired, head: original.evidence.head,
          sourceSnapshotDigest: scopeReviewManifestSchema.parse(lease.snapshot.data.scope_runs[0]!.manifest).sourceSnapshotDigest,
          inventory: original.evidence.inventory, batches, review }));
        const status = base.source.latestRevision !== source.revision ? 'superseded'
          : batches.some(batch => ['outcome-unknown', 'failed-known'].includes(batch.state)) ? 'attention-required'
            : batches.some(batch => batch.state !== 'succeeded') ? 'pending' : review.structuralAssessmentComplete ? 'review-available' : 'incomplete';
        return freeze(intentScopeReadOutputSchema.parse({ ...base, kind: 'steer-scope-review-read/v1', status, batches, review }));
      });
      pinned(); return result.value;
    } catch { throw historyUnavailable(); }
  }, close: reader.close, shutdown: reader.shutdown } satisfies IntentScopeReader & { close(): void; shutdown(): Promise<void> };
}
/** Connect actual repository enumeration to the existing review query. Trusted
 * product/lifecycle/read authorities remain mandatory; never installed by flags. */
export function createCorpusRecordedDevelopmentReviewer(reader: Parameters<typeof createIntentCorpusEvidence>[0], configuration: unknown,
  retrievalConfigurationRevision: string, dependencies: Omit<Parameters<typeof createIntentDevelopmentReviewer>[1], 'evidenceFor' | 'withEvidenceRead'> & { authority: IntentCorpusAuthority }) {
  const config = draftRecordsConfigurationSchema.parse(configuration), { organizationId, productId, repository, branch } = config;
  const corpus = createApplicationIntentCorpusEvidence(reader, { organizationId, productId, repository, branch, retrievalConfigurationRevision }, dependencies.authority);
  try {
    const reviewer = createIntentDevelopmentReviewer(config, { drafts: dependencies.drafts, authorizeReview: dependencies.authorizeReview,
      withEvidenceRead: (input, current, work) => corpus.withReadSession({ organizationId, productId, repository, branch, scopeInputDigest: input.scopeInputDigest }, current,
        read => work(async () => (await read()).evidence)),
      evidenceFor: async (input, current) => (await corpus.collect({ organizationId, productId, repository, branch, scopeInputDigest: input.scopeInputDigest }, current)).evidence });
    return { scope: reviewer.scope, review: reviewer.review, close() { reviewer.close(); corpus.close(); },
      async shutdown() { reviewer.close(); await corpus.shutdown(); } };
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
    return { scope: preparer.scope, prepare: preparer.prepare, close() { preparer.close(); reader.close(); },
      async shutdown() { preparer.close(); reader.close(); if ('shutdown' in reader) await reader.shutdown(); } };
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
  dependencies:Parameters<typeof createVerifiedDevelopmentHistoryExchangeReader>[2] & { ownedRead?: OwnedDevelopmentHistoryBinding }): ReturnType<typeof createIntentDevelopmentHistoryReader> & {
    shutdown?(): Promise<void>; withGenerationRead?: CandidateGenerationReadSession['withRead'] } {
  if(dependencies.ownedRead !== undefined) {
    if(!dependencies.ownedRead)throw historyUnavailable();
    return createOwnedDevelopmentHistoryProjection(pools,configuration,dependencies);
  }
  const verifier=createRecordedMastraVerifier(dependencies.profiles);
  return createIntentDevelopmentHistoryReader(pools,configuration,{...dependencies.records,
    verifyHistoricalExchange:async({role,request,response})=>{
      const rendered=z.object({request:z.unknown()}).parse(request.rendered);
      verifier.verify(role,rendered.request,request as RecordedRequest,response as RecordedResponse);
    },
  });
}
type OwnedDevelopmentHistoryBinding = {
  authority: Parameters<typeof createRecordsContentReader>[2] & Required<Pick<Parameters<typeof createRecordsContentReader>[2], 'authorizeDevelopmentDiscovery'>>;
  keys: Parameters<typeof createRecordsContentReader>[3];
  scope: { records: ScopeHistory; ownedRead: Omit<OwnedScopeReadBinding, 'profiles'>; profile: unknown };
};

/** Join only independently authorized exact same-draft snapshots for the pure
 * SDK/lineage verifier. No merged lease, cached grant or new execution proof is
 * created; the enclosing operation must recheck both real leases independently. */
function combineRecordedHistoryInputs(development: RecordsContentLease, scope: RecordsContentLease) {
  development.check(); scope.check();
  const left = development.snapshot, right = scope.snapshot;
  for (const key of ['draftId', 'budgetId'] as const) historyEqual(left.target[key], right.target[key]);
  historyEqual(left.target.revisions, right.target.revisions); historyEqual(left.lifecycle, right.lifecycle);
  if (left.target.reviewIds.length || right.target.operationIds.length || left.target.operationIds.length !== 1 || right.target.reviewIds.length !== 1) throw historyUnavailable();
  const merge = <T,>(a: readonly T[], b: readonly T[]) => {
    if (a.length && b.length) { historyEqual(a, b); return a; } return a.length ? a : b;
  };
  const data = Object.fromEntries(Object.keys(left.data).map(key => {
    const group = key as keyof typeof left.data;
    if (group === 'reservations') {
      const rows = [...left.data.reservations, ...right.data.reservations];
      // The two reads own disjoint operation IDs; never accept a colliding
      // reservation as an implicit cross-operation join.
      if (new Set(rows.map(row => row.reservation_id)).size !== rows.length) throw historyUnavailable();
      return [group, rows];
    }
    return [group, merge(left.data[group], right.data[group])];
  })) as typeof left.data;
  const decoded = Object.fromEntries(Object.keys(development.contents.decoded).map(key => {
    const group = key as keyof DecodedRecordContents['decoded'];
    return [group, merge<unknown>(development.contents.decoded[group], scope.contents.decoded[group])];
  })) as DecodedRecordContents['decoded'];
  const snapshot = freeze({ ...left, target: { ...left.target, reviewIds: right.target.reviewIds }, data,
    digest: hash({ data, lifecycle: left.lifecycle }), keys: [...left.keys, ...right.keys] });
  const contents = freeze({ ...development.contents, decoded, plaintextRows: Object.values(decoded).reduce((n, rows) => n + rows.length, 0) });
  return freeze({ snapshot, contents, check() { development.check(); scope.check(); } });
}

/** One owned development read plus, only when the original names it, one owned
 * retained scope read. Both keep their independent record/key grants and actual
 * cancellation drain. No recursive original/results reconstruction or effects. */
function createOwnedDevelopmentHistoryProjection(pools: Parameters<typeof createRecordsContentReader>[0], configuration: unknown,
  dependencies: Parameters<typeof createVerifiedDevelopmentHistoryExchangeReader>[2] & { ownedRead?: OwnedDevelopmentHistoryBinding }) {
  const config = freeze(draftRecordsConfigurationSchema.parse(configuration)), binding = dependencies.ownedRead!, r = dependencies.records;
  const originals = r.originals, results = r.results, scopeBinding = binding.scope, scopeRecords = scopeBinding.records, scopeOriginals = scopeRecords.originals;
  const profile = freeze(scopeReviewProfileSchema.parse(scopeBinding.profile));
  const identities = [{ owner: dependencies, name: 'records', value: r }, { owner: dependencies, name: 'ownedRead', value: binding },
    { owner: r, name: 'originals', value: originals }, { owner: r, name: 'results', value: results },
    { owner: binding, name: 'scope', value: scopeBinding }, { owner: scopeBinding, name: 'records', value: scopeRecords },
    { owner: scopeBinding, name: 'ownedRead', value: scopeBinding.ownedRead },
    { owner: scopeRecords, name: 'originals', value: scopeOriginals },
    ...[binding, scopeBinding.ownedRead].flatMap(owner => [{ owner, name: 'authority', value: owner.authority },
      { owner, name: 'keys', value: owner.keys }, { owner: owner.authority, name: 'records', value: owner.authority.records }])];
  const methods = [
    { owner: r, names: ['authorizeHistoricalRead'] },
    { owner: originals, names: ['authorizeHistoricalRead', 'authorizeOriginal', 'authorizeDraft', 'keyForDraft'] },
    { owner: results, names: ['authorizeHistoricalResult', 'authorizeDraft', 'keyForDraft'] },
    { owner: scopeRecords, names: ['authorizeHistoricalRead', 'authorizeHistoricalReview'] },
    { owner: scopeOriginals, names: ['authorize', 'authorizeOriginal', 'authorizeDraft', 'keyForDraft'] },
    { owner: binding.authority, names: ['authorize', 'authorizeDevelopmentDiscovery'] },
    { owner: scopeBinding.ownedRead.authority, names: ['authorize', 'authorizeScopeDiscovery'] },
  ].flatMap(({ owner, names }) => names.map(name => ({ owner, name, value: Reflect.get(owner, name) })));
  if (methods.some(pin => typeof pin.value !== 'function')) throw historyUnavailable();
  const pinned = () => { if ([...identities, ...methods].some(pin => Reflect.get(pin.owner, pin.name) !== pin.value)) throw historyUnavailable(); };
  const devAuthority: Parameters<typeof createRecordsContentReader>[2] = { ...binding.authority,
    async authorizeDevelopmentDiscovery(context) { pinned(); return binding.authority.authorizeDevelopmentDiscovery(context); },
    async authorize(context) {
      pinned(); const target = freeze({ configuration: config, draftId: context.target.draftId, action: 'read' as const });
      if (await originals.authorizeDraft(target) !== undefined || await results.authorizeDraft(target) !== undefined) throw historyUnavailable();
      pinned(); return binding.authority.authorize(context);
    },
  };
  const historicalAuthority: Parameters<typeof createRecordsContentReader>[2] = { ...scopeBinding.ownedRead.authority,
    async authorizeScopeDiscovery(context) { pinned(); return scopeBinding.ownedRead.authority.authorizeScopeDiscovery(context); },
    async authorize(context) {
      pinned(); if (await scopeOriginals.authorizeDraft(freeze({ configuration: config, draftId: context.target.draftId, action: 'read' })) !== undefined) throw historyUnavailable();
      pinned(); return scopeBinding.ownedRead.authority.authorize(context);
    },
  };
  const reader = createRecordsContentReader(pools, config, devAuthority, binding.keys);
  let scopeReader: ReturnType<typeof createRecordsContentReader>;
  try { scopeReader = createRecordsContentReader(pools, config, historicalAuthority, scopeBinding.ownedRead.keys); }
  catch(error) { reader.close(); throw error; }
  const verifier = createRecordedHistoryVerifier(dependencies.profiles);
  const scope = freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, repository: config.repository });
  async function run<T>(raw: unknown, revalidate: () => Promise<void>, use: (read: () => Promise<CandidateGenerationReadPair>) => Promise<T>, drain: boolean) {
    try {
      pinned(); const input = intentDevelopmentHistoryInputSchema.parse(raw), target = freeze({ operationId: input.operationId, inputDigest: input.inputDigest });
      if (typeof revalidate !== 'function' || typeof use !== 'function'
        || (['organizationId', 'productId', 'repository'] as const).some(key => input[key] !== scope[key])) throw historyUnavailable();
      let lifetime = () => {};
      const current = async () => {
        pinned(); lifetime(); if (await revalidate() !== undefined) throw historyUnavailable(); pinned(); lifetime();
        if (await originals.authorizeHistoricalRead!(freeze({ configuration: config, target })) !== undefined) throw historyUnavailable();
        for (const stepId of ['architect', 'test-agent'] as const)
          if (await r.authorizeHistoricalRead!(freeze({ configuration: config, target: { ...target, stepId } })) !== undefined) throw historyUnavailable();
        pinned(); lifetime();
      };
      const reading = reader.startReadSet({ kind: 'development-history', ...target }, current, async development => {
        const saved = historyOnly(development.contents.decoded.development_originals);
        if (!saved || saved.metadata.operationId !== target.operationId || saved.metadata.inputDigest !== target.inputDigest
          || saved.value.configuration.budget?.budgetId !== development.snapshot.target.budgetId) throw historyUnavailable();
        const original = saved.value, source = original.source, bound = original.direction.scopeReview;
        const sourceGrant = async () => {
          pinned(); development.check();
          if (await originals.authorizeOriginal(freeze({ original, action: 'read' })) !== undefined) throw historyUnavailable();
          for (const stepId of ['architect', 'test-agent'] as const)
            if (await results.authorizeHistoricalResult!(freeze({ configuration: original.configuration,
              target: { operationId: target.operationId, stepId }, action: 'read' })) !== undefined) throw historyUnavailable();
          pinned(); development.check();
        };
        const project = async (records: Parameters<ReturnType<typeof createRecordedHistoryVerifier>['verify']>[0], recheck: () => Promise<void>, finalScopeGrant = async () => {}) => {
          await sourceGrant(); const history = historyOnly((await verifier.verify(records)).developments);
          if (!history || history.operationId !== target.operationId || history.inputDigest !== target.inputDigest) throw historyUnavailable();
          const operationExpired = development.hasExpired(original.configuration.expiresAt);
          const outputs = history.roles.filter(role => role.checkpointVerified).map(role => {
            const record = historyOnly(development.contents.decoded.development_results.filter(result => result.metadata.stepId === role.role));
            if (!record || !role.result) throw historyUnavailable();
            return { resultRef: record.metadata.resultRef, resultDigest: String(record.row.result_digest), stepInputDigest: record.metadata.stepInputDigest,
              predecessorResultDigest: record.metadata.predecessorResultDigest, outputDigest: hash(role.result), result: role.result };
          });
          const steps = history.roles.map(role => ({ role: role.role, state: role.state })), architect = outputs.find(result => result.result.role === 'architect');
          const questions = architect?.result.role === 'architect' && architect.result.output.questions.length > 0;
          const status = steps.some(step => ['outcome-unknown', 'failed-known'].includes(step.state)) ? 'attention-required'
            : questions ? 'needs-clarification' : outputs.length === 2 ? 'complete' : outputs.length === 1 ? 'partial' : 'pending';
          const output = freeze(await verifyIntentDevelopmentHistoryOutput({ kind: 'steer-development-history/v1', ...input, historical: true, operationExpired,
            source: { draftId: source.draftId, revision: source.revision, revisionDigest: source.revisionDigest,
              scopeInputDigest: source.scopeInputDigest, latestRevision: Number(development.snapshot.data.latest_revision[0]!.revision) },
            status, steps, results: outputs, savedToGit: false, gateSigned: false, executionAuthorized: false, retryAuthorized: false, semanticQualityVerified: false }));
          const pair: CandidateGenerationReadPair = freeze({ history: output, retained: { original,
            latestDraftRevision: output.source.latestRevision, operationExpired, historical: true,
            executionAuthorized: false, retryAuthorized: false, gateSigned: false } });
          let consuming = true, invalid = false, consumed = false, pending: Promise<CandidateGenerationReadPair> | undefined;
          lifetime = () => { if (invalid || (!operationExpired && development.hasExpired(original.configuration.expiresAt))) throw historyUnavailable(); };
          const readPair = () => {
            try {
              development.check(); lifetime(); if (!consuming || pending) throw historyUnavailable();
              pending = Promise.resolve().then(async () => {
                await current(); await sourceGrant(); await finalScopeGrant(); development.check(); lifetime();
                if (!consuming) throw historyUnavailable(); consumed = true; return pair;
              }).catch(error => { invalid = true; throw error; }).finally(() => { pending = undefined; });
              void pending.catch(() => {}); return pending;
            } catch { invalid = true; return Promise.reject(historyUnavailable()); }
          };
          try {
            const value = await use(readPair); consuming = false;
            if (!consumed || invalid || pending) throw historyUnavailable();
            await recheck(); await sourceGrant(); await finalScopeGrant(); development.check(); lifetime(); return value;
          } finally { consuming = false; await pending?.catch(() => {}); }
        };
        if (bound?.kind !== 'recorded') return project(development, development.recheck);
        const scopeTarget = freeze({ reviewId: bound.reviewId, preparationDigest: bound.preparationDigest });
        const scopeCurrent = async () => {
          development.check(); await current();
          if (await scopeOriginals.authorize(freeze({ configuration: config, target: scopeTarget, action: 'read' })) !== undefined) throw historyUnavailable();
          development.check(); pinned();
        };
        const nested = scopeReader.startReadSet({ kind: 'scope-review', mode: 'history', ...scopeTarget }, scopeCurrent, async retained => {
          const record = historyOnly(retained.contents.decoded.scope_originals); if (!record) throw historyUnavailable();
          historyEqual(record.value.profile, profile);
          const grant = async () => {
            development.check(); retained.check(); pinned();
            if (await scopeOriginals.authorizeOriginal(freeze({ original: record.value, action: 'read' })) !== undefined
              || await scopeRecords.authorizeHistoricalReview(freeze({ configuration: record.value.configuration, request: scopeTarget })) !== undefined) throw historyUnavailable();
            const manifest = scopeReviewManifestSchema.parse(retained.snapshot.data.scope_runs[0]!.manifest);
            for (const batch of manifest.batches)
              if (await scopeRecords.authorizeHistoricalRead(freeze({ configuration: config, target: { ...scopeTarget, batchId: batch.batchId } })) !== undefined) throw historyUnavailable();
            development.check(); retained.check(); pinned();
          };
          await grant();
          return project(combineRecordedHistoryInputs(development, retained), async () => {
            await development.recheck(); await retained.recheck();
          }, grant);
        });
        try { return (await nested.result).value; }
        finally { await nested.drained; }
      });
      try { const read = await reading.result; pinned(); return read.value; }
      finally { if (drain) await reading.drained; }
    } catch { throw new Error('Development history is unavailable.'); }
  }
  return { scope, read: (input, current) => run(input, current, async read => (await read()).history, false),
    withGenerationRead: (input, current, work) => run(input, current, work, true),
    close() { reader.close(); scopeReader.close(); }, async shutdown() { reader.close(); scopeReader.close(); await Promise.all([reader.shutdown(), scopeReader.shutdown()]); }
  } satisfies IntentDevelopmentHistoryReader & { close(): void; shutdown(): Promise<void>; withGenerationRead: CandidateGenerationReadSession['withRead'] };
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
    /** Trusted, independently authorized current/history read bindings only.
     * No browser/environment opt-in; absence retains the established readers. */
    ownedReads?: { current: Omit<OwnedScopeReadBinding, 'profiles'>; history: Omit<OwnedScopeReadBinding, 'profiles'> };
    authorizePreparation: Parameters<typeof createCorpusRecordedScopePreparer>[5]['authorizePreparation'];
    scheduler: Parameters<typeof createRecordedScopeStarter>[2]['scheduler'];
    authorizeStart: Parameters<typeof createRecordedScopeStarter>[2]['authorizeStart'];
  };
  development: {
    records: Omit<DevelopmentRecords, 'originals'> & { originals: DevelopmentOriginals };
    history: Omit<DevelopmentHistory, 'originals'> & { originals: DevelopmentOriginals };
    /** Independent records/key authority for retained development reads. Requires
     * the separately authorized scope-history binding; never enables execution. */
    ownedHistory?: Pick<OwnedDevelopmentHistoryBinding, 'authority' | 'keys'>;
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
  const resources = deps.resources, owned: Array<{ close(): void; shutdown?(): Promise<void> }> = [];
  const stopResources = resources.shutdown.bind(resources);
  let stopped: Promise<void> | undefined;
  const shutdown = () => stopped ??= (async () => {
    let failed = false;
    for (const service of [...owned].reverse()) try { service.close(); } catch { failed = true; }
    for (const service of [...owned].reverse()) if (service.shutdown) try { await service.shutdown(); } catch { failed = true; }
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
    if (deps.scope.ownedReads !== undefined && (!deps.scope.ownedReads?.current || !deps.scope.ownedReads?.history)) throw fail();
    if (deps.development.ownedHistory !== undefined && (!deps.development.ownedHistory?.authority
      || !deps.development.ownedHistory?.keys || !deps.scope.ownedReads?.history)) throw fail();
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
    const scopeBindings = { records: deps.scope.records, profile: config.scopeProfile,
      ...(deps.scope.ownedReads ? { ownedRead: { ...deps.scope.ownedReads.current, profiles: config.developmentProfiles } } : {}) };
    const scopeReader = own(createVerifiedScopeReviewReader(pools, records, scopeBindings));
    const scopeHistory = own(createVerifiedScopeReviewHistoryReader(pools, records, { records: deps.scope.history, profile: config.scopeProfile,
      ...(deps.scope.ownedReads ? { ownedRead: { ...deps.scope.ownedReads.history, profiles: config.developmentProfiles } } : {}) }));
    const originalRecords = { ...deps.development.records.originals, scopeReview: scopeReader, scopeHistory };
    const historicalOriginals = { ...deps.development.history.originals, scopeReview: scopeReader, scopeHistory };
    const developmentRecords = { ...deps.development.records, originals: originalRecords };
    const historyRecords = { ...deps.development.history, originals: historicalOriginals };
    const drafts = own(createIntentDraftService(pools.drafts, records, deps.drafts));
    const sourceReview = own(createCorpusRecordedDevelopmentReviewer(resources.reader, records, config.retrievalConfigurationRevision,
      { drafts, authority: deps.corpus, authorizeReview: deps.development.authorizeReview }));
    const corpus = own(createApplicationIntentCorpusEvidence(resources.reader, { organizationId, productId, repository, branch,
      retrievalConfigurationRevision: config.retrievalConfigurationRevision }, deps.corpus));
    // Derive preserved role profiles from the same allowlisted SDK profiles used
    // by current and historical readers. There is no independently mutable copy.
    const sourceProfile = (profile: z.infer<typeof roleProfile>) => ({ configurationRevision: profile.profileRevision,
      runtimeRevision: RECORDED_MASTRA_REVISION, modelRoute: profile.modelRoute, maxOutputTokens: profile.maxOutputTokens, instructions: profile.instructions });
    const profiles = developmentOriginalSchema.shape.profiles.parse({ architect: sourceProfile(config.developmentProfiles.architect),
      testAgent: sourceProfile(config.developmentProfiles.testAgent) });
    const developmentHistory = own(createVerifiedDevelopmentHistoryReader(pools, records,
      { records: historyRecords, profiles: config.developmentProfiles,
        ...(deps.development.ownedHistory ? { ownedRead: { ...deps.development.ownedHistory,
          scope: { records: deps.scope.history, ownedRead: deps.scope.ownedReads!.history, profile: config.scopeProfile } } } : {}) }));
    if (deps.development.ownedHistory && typeof developmentHistory.withGenerationRead !== 'function') throw fail();
    const review = own(createRecordedCandidateSaveReviewer(records, { drafts, sources: sourceReview,
      scopeReview: scopeReader, authorizeReview: deps.candidate.authorizeReview }));
    const destination = own(createCandidateSaveDestination(resources.reader,
      { ...candidateScope, configurationRevision: records.configurationRevision }, deps.candidate.destination));
    const previewer = own(createRecordedCandidateSavePreviewer(pools, { ...records, serviceCommitter: config.publication.serviceCommitter },
      { drafts, review, history: developmentHistory, originals: historicalOriginals, destination, authorizePreview: deps.candidate.authorizePreview,
        ...(developmentHistory.withGenerationRead ? { generationRead: { configuration: records, historyRead: developmentHistory.read,
          withRead: developmentHistory.withGenerationRead } } : {}) }));
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
        withEvidenceRead: (input, current, work) => corpus.withReadSession({ organizationId, productId, repository, branch,
          scopeInputDigest: input.scopeInputDigest }, current, read => work(async () => (await read()).evidence)),
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
