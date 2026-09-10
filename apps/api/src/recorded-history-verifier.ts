import { isDeepStrictEqual } from 'node:util';
import type { z } from 'zod';
import type { intentScopeAssessmentSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { createRecordedMastraExchangeVerifier, createRecordedScopeMastraVerifier, type RecordedRequest } from '@steer/agents/recorded-mastra';
import { prepareIntentScopeReview } from '@steer/tool-registry/intent-scope-review';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import { renderDevelopmentRequest } from '@steer/data/development-requests';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from '@steer/data/development-original-contracts';
import { intentOperationCodec } from '@steer/data/intent-operations';
import { scopeReviewOperationCodec } from '@steer/data/scope-review-operations';
import { createRecordsContentReader, type RecordsContentLease } from '../../../packages/data/src/records-content-reader.ts';
import type { DecodedRecordContents } from '../../../packages/data/src/records-content-codecs.ts';

type Profiles = Parameters<typeof createRecordedMastraExchangeVerifier>[0];
type Step = ReturnType<typeof scopeReviewOperationCodec.step.parse>;
type State = Step['state'] | 'pending';
type Role = 'architect' | 'test-agent';
type RoleResult = DecodedRecordContents['decoded']['development_results'][number]['value'];
type ScopeSummary = { reviewId: string; preparationDigest: string;
  batches: Array<{ batchId: string; state: State; requestVerified: boolean; responseVerified: boolean; checkpointVerified: boolean }>;
  review: Awaited<ReturnType<typeof validateIntentScopeBatchResults>> };
type DevelopmentSummary = { operationId: string; inputDigest: string;
  roles: Array<{ role: Role; state: State; requestVerified: boolean; responseVerified: boolean; checkpointVerified: boolean; result: RoleResult | null }> };
const fail = () => new Error('Recorded history could not be verified.');
const equal = (actual: unknown, expected: unknown) => { if (!isDeepStrictEqual(actual, expected)) throw fail(); };
const only = <T>(rows: readonly T[]): T | undefined => { if (rows.length > 1) throw fail(); return rows[0]; };
const time = (raw: unknown) => { const value = raw instanceof Date ? raw.getTime() : typeof raw === 'string' ? Date.parse(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < 0) throw fail(); return value; };
const ownership = (metadata: { owner: string; fencingToken: number; reservationId: string; stepInputDigest: string }, step: Step) => {
  if (metadata.owner !== step.owner || metadata.fencingToken !== step.fencingToken || metadata.reservationId !== step.reservationId
    || metadata.stepInputDigest !== step.binding.inputDigest) throw fail();
};

/** Pure production SDK/lineage verification over already-authorized, decoded
 * records. It has no transport, secret or authority service. A request/response
 * match is neither provider authorship nor semantic accuracy or current consent. */
export function createRecordedHistoryVerifier(profiles: Profiles) {
  const sdk = createRecordedMastraExchangeVerifier(profiles);
  return Object.freeze({ async verify(lease: Pick<RecordsContentLease, 'snapshot' | 'contents' | 'check'>) {
    try {
      const { snapshot, contents, check } = lease, decoded = contents.decoded;
      check(); const scopeReviews: ScopeSummary[] = [], developments: DevelopmentSummary[] = [];
      const counts = { scopeRequests: 0, scopeSdkExchanges: 0, developmentRequests: 0, developmentSdkExchanges: 0, developmentResults: 0 };
      const seenScope = new Set<string>(), seenDevelopment = new Set<string>(), scopeSnapshots = new Map<string, string>();
      for (const saved of decoded.scope_originals) {
        check(); const original = saved.value, c = original.configuration, reviewId = saved.metadata.reviewId;
        if (seenScope.has(reviewId)) throw fail(); seenScope.add(reviewId);
        const run = only(snapshot.data.scope_runs.filter(row => row.review_id === reviewId));
        if (!run || run.configuration_digest !== hash(c) || run.preparation_digest !== saved.metadata.preparationDigest
          || time(run.expires_at) !== Date.parse(c.expiresAt) || run.draft_id !== original.source.scope.draftId
          || Number(run.draft_revision) !== original.source.revision) throw fail();
        const prepared = await prepareIntentScopeReview(original.source.scope, original.evidence, original.profile); check();
        if (prepared.preparationDigest !== saved.metadata.preparationDigest) throw fail();
        const verifier = await createRecordedScopeMastraVerifier({ scope: original.source.scope, evidence: original.evidence, profile: original.profile }); check();
        const steps = snapshot.data.scope_batches.filter(row => row.review_id === reviewId), observations = decoded.scope_observations.filter(row => row.metadata.reviewId === reviewId);
        if (steps.some(row => !prepared.batches.some(batch => batch.metadata.batchId === row.batch_id))) throw fail();
        const batches: ScopeSummary['batches'] = [], receipts: Array<{ planDigest: string; batchId: string; assessment: z.infer<typeof intentScopeAssessmentSchema> }> = [];
        let used = 0;
        for (const batch of prepared.batches) {
          check(); const batchId = batch.metadata.batchId, row = only(steps.filter(row => row.batch_id === batchId));
          const step = row ? scopeReviewOperationCodec.step.parse(row.record) : undefined;
          if (step) {
            equal(step.binding, { organizationId: c.organizationId, operationId: reviewId, stepId: batchId, subject: c.subject,
              draftId: original.source.scope.draftId, draftRevision: original.source.revision, inputDigest: batch.inputDigest, configurationRevision: c.configurationRevision });
            if (row!.budget_id !== c.budget.budgetId || row!.reservation_id !== step.reservationId) throw fail();
          }
          const request = only(observations.filter(row => row.metadata.batchId === batchId && row.metadata.stage === 'request'));
          const response = only(observations.filter(row => row.metadata.batchId === batchId && row.metadata.stage === 'response'));
          if ((request || response) && (!step || step.state === 'claimed')) throw fail();
          for (const observation of [request, response]) if (observation) {
            used++; ownership(observation.metadata, step!);
            if (observation.metadata.preparationDigest !== saved.metadata.preparationDigest || observation.metadata.draftRevision !== original.source.revision) throw fail();
          }
          if (request) {
            if (request.value.stage !== 'request') throw fail(); equal(request.value.rendered, batch.packet);
            verifier.verifyRequest(batchId, request.value); counts.scopeRequests++;
          }
          if (response) {
            if (!request || request.value.stage !== 'request' || response.value.stage !== 'response'
              || response.value.requestDigest !== request.metadata.payloadDigest) throw fail();
            verifier.verify(batchId, request.value, response.value); counts.scopeSdkExchanges++;
          }
          const completed = step?.state === 'succeeded';
          if (completed) {
            if (!response || response.value.stage !== 'response' || response.metadata.payloadDigest !== step.resultDigest) throw fail();
            receipts.push({ planDigest: response.value.result.planDigest, batchId, assessment: response.value.result.output });
          }
          batches.push({ batchId, state: step?.state ?? 'pending', requestVerified: Boolean(request), responseVerified: Boolean(response), checkpointVerified: completed });
        }
        if (used !== observations.length) throw fail();
        const review = await validateIntentScopeBatchResults(original.evidence, receipts, original.profile.profileRevision); check();
        if (review.planDigest !== prepared.plan.planDigest) throw fail();
        scopeReviews.push({ reviewId, preparationDigest: saved.metadata.preparationDigest, batches, review });
        scopeSnapshots.set(reviewId, prepared.plan.sourceSnapshotDigest);
      }
      for (const saved of decoded.development_originals) {
        check(); const original = saved.value, c = original.configuration, source = original.source, operationId = saved.metadata.operationId;
        if (seenDevelopment.has(operationId) || decoded.candidate_originals.some(row => row.metadata.operationId === operationId)) throw fail(); seenDevelopment.add(operationId);
        const bound = original.direction.scopeReview;
        if (bound?.kind === 'recorded') {
          const sourceReview = only(decoded.scope_originals.filter(row => row.metadata.reviewId === bound.reviewId));
          const verifiedReview = only(scopeReviews.filter(row => row.reviewId === bound.reviewId));
          if (!sourceReview || !verifiedReview || verifiedReview.preparationDigest !== bound.preparationDigest
            || sourceReview.value.source.scope.draftId !== source.draftId || sourceReview.value.source.revision !== source.revision
            || sourceReview.value.source.revisionDigest !== source.revisionDigest || sourceReview.metadata.scopeInputDigest !== source.scopeInputDigest
            || sourceReview.value.evidence.head !== original.evidence.head || scopeSnapshots.get(bound.reviewId) !== original.direction.sourceSnapshotDigest) throw fail();
          for (const field of ['organizationId', 'subject', 'productId', 'repository', 'branch'] as const) if (sourceReview.value.configuration[field] !== c[field]) throw fail();
          equal(sourceReview.value.evidence.inventory, original.evidence.inventory); equal(verifiedReview.review, bound.results);
        }
        const operation = only(snapshot.data.operations.filter(row => row.operation_id === operationId));
        if (!operation || operation.action !== 'develop' || operation.configuration_revision !== c.configurationRevision
          || time(operation.expires_at) !== Date.parse(c.expiresAt) || operation.draft_id !== source.draftId || Number(operation.draft_revision) !== source.revision) throw fail();
        const binding = intentOperationCodec.binding.parse(operation.binding);
        equal(binding, { draftId: source.draftId, draftRevision: source.revision, inputDigest: saved.metadata.inputDigest, configurationDigest: hash(c) });
        const steps = snapshot.data.steps.filter(row => row.operation_id === operationId), observations = decoded.development_observations.filter(row => row.metadata.operationId === operationId);
        const results = decoded.development_results.filter(row => row.metadata.operationId === operationId);
        if (steps.some(row => !['architect', 'test-agent'].includes(String(row.step_id)))) throw fail();
        const roles: DevelopmentSummary['roles'] = [];
        // Predecessor is assembled only after validating the succeeded Architect.
        let architect: { checkpoint: { binding: Step['binding']; resultRef: string; resultDigest: string; recordsPolicyDigest: string }; result: RoleResult } | null = null;
        let usedObservations = 0, usedResults = 0;
        for (const role of ['architect', 'test-agent'] as const) {
          check(); const row = only(steps.filter(row => row.step_id === role));
          const stored = row ? intentOperationCodec.storedStep(row, c, { ...binding, operationId }, role) : null;
          const request = only(observations.filter(row => row.metadata.stepId === role && row.metadata.stage === 'request'));
          const response = only(observations.filter(row => row.metadata.stepId === role && row.metadata.stage === 'response'));
          const result = only(results.filter(row => row.metadata.stepId === role));
          if (role === 'test-agent' && !architect) {
            if (stored || request || response || result) throw fail();
            roles.push({ role, state: 'pending', requestVerified: false, responseVerified: false, checkpointVerified: false, result: null }); continue;
          }
          const predecessor = role === 'architect' ? null : architect;
          const prepared = await renderDevelopmentRequest({ original, operationId, role, predecessor }); check();
          const step = stored ? intentOperationCodec.step.parse(stored.record) : undefined;
          if (step && (step.binding.inputDigest !== prepared.stepReference.stepInputDigest || stored!.predecessorResultDigest !== prepared.stepReference.predecessorResultDigest)) throw fail();
          if ((request || response || result) && (!step || step.state === 'claimed')) throw fail();
          for (const observation of [request, response]) if (observation) {
            usedObservations++; ownership(observation.metadata, step!);
            if (observation.metadata.inputDigest !== saved.metadata.inputDigest || observation.metadata.draftRevision !== source.revision) throw fail();
          }
          if (request) {
            if (request.value.stage !== 'request') throw fail(); equal(request.value.rendered, prepared.rendered);
            sdk.verifyRequest(role, prepared.rendered.request, request.value as RecordedRequest); counts.developmentRequests++;
          }
          if (response) {
            if (!request || request.value.stage !== 'request' || response.value.stage !== 'response' || response.value.requestDigest !== request.metadata.payloadDigest) throw fail();
            sdk.verify(role, prepared.rendered.request, request.value as RecordedRequest, response.value); counts.developmentSdkExchanges++;
          }
          if (result) {
            usedResults++; ownership(result.metadata, step!);
            if (!response || response.value.stage !== 'response' || result.metadata.predecessorResultDigest !== prepared.stepReference.predecessorResultDigest) throw fail();
            equal(response.value.result, result.value);
          }
          const completed = step?.state === 'succeeded';
          if (completed && (!result || stored!.resultRef !== result.metadata.resultRef || step.resultDigest !== result.row.result_digest)) throw fail();
          if (role === 'architect' && completed && result?.value.role === 'architect' && result.value.output.questions.length === 0
            && result.value.output.brief !== null && result.value.output.spec !== null) architect = {
            checkpoint: { binding: step.binding, resultRef: result.metadata.resultRef, resultDigest: String(result.row.result_digest), recordsPolicyDigest: c.recordsPolicyDigest }, result: result.value };
          roles.push({ role, state: step?.state ?? 'pending', requestVerified: Boolean(request), responseVerified: Boolean(response), checkpointVerified: completed, result: completed ? result!.value : null });
        }
        if (usedObservations !== observations.length || usedResults !== results.length) throw fail(); counts.developmentResults += usedResults;
        developments.push({ operationId, inputDigest: saved.metadata.inputDigest, roles });
      }
      if (seenScope.size !== snapshot.data.scope_runs.length || decoded.scope_originals.length !== snapshot.data.scope_originals.length
        || decoded.development_originals.length !== snapshot.data.development_originals.length
        || counts.scopeRequests + counts.scopeSdkExchanges !== decoded.scope_observations.length
        || counts.developmentRequests + counts.developmentSdkExchanges !== decoded.development_observations.length
        || counts.developmentResults !== decoded.development_results.length) throw fail();
      check(); return freeze({ scopeReviews, developments, counts, sdkConsistencyVerified: true as const,
        sourcePermissionsVerified: false as const, profileApprovalVerified: false as const, semanticQualityVerified: false as const,
        candidateExecutionVerified: false as const, executionAuthorized: false as const, retryAuthorized: false as const, gateSigned: false as const });
    } catch { throw fail(); }
  } });
}

/** Read-only production composition. The enclosing owner still requires awaited
 * key/records recheck; source authority and public tool projection remain separate. */
export function createVerifiedRecordsContentReader(pools: Parameters<typeof createRecordsContentReader>[0], config: unknown,
  authority: Parameters<typeof createRecordsContentReader>[2], keys: Parameters<typeof createRecordsContentReader>[3], profiles: Profiles,
  options: Parameters<typeof createRecordsContentReader>[4] = {}) {
  const verifier = createRecordedHistoryVerifier(profiles), reader = createRecordsContentReader(pools, config, authority, keys, options);
  return { async withReadSet<T>(target: unknown, current: () => Promise<void>, use: (lease: RecordsContentLease & {
    history: Awaited<ReturnType<typeof verifier.verify>> }) => Promise<T>, signal?: AbortSignal) {
    return reader.withReadSet(target, current, async lease => {
      const history = await verifier.verify(lease); lease.check(); return use(freeze({ ...lease, history }));
    }, signal);
  }, close: reader.close, shutdown: reader.shutdown };
}
