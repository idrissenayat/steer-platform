import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createIntentOperationStore, intentOperationConfigurationSchema, type IntentCheckpointReference } from '@steer/data/intent-operations';
import type { DatabasePool } from '@steer/data/runtime-pool';
import { createGitHubCandidateBundleStore, candidateBundleStoreConfigurationSchema, candidateBundleDispatchProofSchema,
  type CandidateBundlePrepared } from '@steer/adapters/github-candidate-bundle-store';
import { candidateBundleInputSchema, planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { intentSaveBindingSchema, assertIntentSaveBindingCurrent } from '@steer/tool-registry/intent-revision-contracts';

const submissionSchema = z.strictObject({
  bundle: z.strictObject(candidateBundleInputSchema.shape).omit({ operationId: true }), confirmation: intentSaveBindingSchema,
});
const requestSchema = z.strictObject({ bundle: candidateBundleInputSchema, confirmation: intentSaveBindingSchema });
type ProviderDependencies = Parameters<typeof createGitHubCandidateBundleStore>[2];
const optionsSchema = z.strictObject({ execution: intentOperationConfigurationSchema, publication: candidateBundleStoreConfigurationSchema });
const previewId = '00000000-0000-4000-8000-000000000000'; // Never admitted or sent to a provider.
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
function submissionOf(request: CandidateBundlePrepared['request']) {
  const { operationId: _operation, ...bundle } = request.bundle;
  return submissionSchema.parse({ bundle, confirmation: request.confirmation });
}
function inputDigest(value: z.infer<typeof submissionSchema>, publicationDigest: string) {
  // Admission excludes the not-yet-minted operation ID. The step/receipt digest
  // remains the v2 write plan, including the actual server ID and exact consent.
  return createHash('sha256').update(JSON.stringify(['steer-candidate-submission/v1', publicationDigest, value])).digest('hex');
}

/** Uninstalled composition, never a public save tool or an authority verifier.
 * Current identity/grants, adopted records/gates, complete source and lifecycle
 * evidence must come from the trusted ports. No fixture fallback or auto-retry.
 */
export function createDurableCandidateBundleStore(pool: DatabasePool,
  binding: Parameters<typeof createGitHubCandidateBundleStore>[0], rawOptions: unknown,
  dependencies: Pick<ProviderDependencies, 'fetch' | 'appJwt' | 'now' | 'authorizeRead'> & {
    authorizeOperation: Parameters<typeof createIntentOperationStore>[2]['authorize'];
    evaluateDispatch: (prepared: CandidateBundlePrepared) => Promise<unknown>;
    authorizeReconciliation?: (prepared: CandidateBundlePrepared) => Promise<void>;
  }) {
  const config = freeze(optionsSchema.parse(rawOptions)), owner = randomUUID();
  if (config.execution.action !== 'candidate-save' || config.execution.budget !== null
    || typeof dependencies.evaluateDispatch !== 'function') throw new Error('Invalid candidate execution configuration.');
  for (const key of ['organizationId', 'productId', 'repository', 'branch'] as const)
    if (config.execution[key] !== config.publication[key]) throw new Error('Candidate execution scope mismatch.');
  const publicationDigest = createHash('sha256').update(JSON.stringify([config.publication,
    binding.organizationId, binding.installationId, binding.repositoryId, binding.owner, binding.repository, binding.branch])).digest('hex');
  let closed = false, active = false, pending = 0;
  let checkpointProof: (IntentCheckpointReference & { verifiedAt: number }) | undefined;
  const operations = createIntentOperationStore(pool, config.execution, { authorize: dependencies.authorizeOperation,
    verifyCheckpoint: async ref => {
      // Created ONLY from this adapter's verified native receipt read, never a
      // caller assertion. Immutable Git-result evidence is prefetched outside SQL.
      const proof = checkpointProof, time = performance.now();
      if (closed || !proof || time < proof.verifiedAt || time - proof.verifiedAt >= 5000
        || ref.resultRef !== proof.resultRef || ref.resultDigest !== proof.resultDigest || ref.recordsPolicyDigest !== proof.recordsPolicyDigest
        || Object.keys(ref.binding).some(key => ref.binding[key as keyof typeof ref.binding] !== proof.binding[key as keyof typeof proof.binding]))
        throw new Error('Candidate receipt checkpoint unavailable.');
    } });
  const within = async <T>(work: Promise<T>): Promise<T> => {
    pending++; void work.finally(() => { pending--; }).catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Candidate reconciliation unavailable.')), 5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
  const validate = async (raw: unknown) => {
    const request = freeze(requestSchema.parse(raw)), input = request.bundle;
    for (const key of ['organizationId', 'productId', 'repository', 'branch', 'serviceCommitter'] as const)
      if (input[key] !== config.publication[key]) throw new Error('Candidate request scope mismatch.');
    if (input.originatorSubject !== config.execution.subject || !config.publication.itemIds.includes(input.itemId))
      throw new Error('Candidate request owner mismatch.');
    const plan = await planCandidateBundle(input, request.confirmation);
    return freeze({ request, plan });
  };
  const reference = (p: CandidateBundlePrepared) => ({ operationId: p.request.bundle.operationId, inputDigest: inputDigest(submissionOf(p.request), publicationDigest) });
  const checkProof = (p: CandidateBundlePrepared, raw: unknown) => {
    const proof = candidateBundleDispatchProofSchema.parse(raw);
    assertIntentSaveBindingCurrent(p.request.confirmation, proof.currentBinding);
    const time = (dependencies.now ?? (() => new Date()))().getTime(), evaluated = Date.parse(proof.evaluatedAt), expiry = Date.parse(proof.validThrough);
    if (closed || !Number.isFinite(time) || evaluated > time || time - evaluated > 5000 || expiry <= time || expiry <= evaluated || expiry - evaluated > 30000
      || proof.operationId !== p.request.bundle.operationId || proof.inputDigest !== p.plan.inputDigest
      || proof.authorizationRevision !== p.plan.expectedHead || proof.sourceReviewRevision !== p.plan.expectedHead
      || proof.lifecycleRevision !== p.plan.expectedHead || proof.lifecycle !== p.plan.requiredLifecycle
      || proof.platformRevision !== config.publication.platformRevision || proof.gate2DecisionDigest !== config.publication.gate2DecisionDigest)
      throw new Error('Candidate dispatch evidence unavailable.');
    return freeze(proof);
  };
  const writer = createGitHubCandidateBundleStore(binding, config.publication, { ...dependencies,
    authorizeAndClaimDispatch: async prepared => {
      const p = await validate(prepared.request);
      const proof = checkProof(p, await dependencies.evaluateDispatch(p));
      const ref = { ...reference(p), stepId: 'candidate-save', stepInputDigest: p.plan.inputDigest, predecessorResultDigest: null };
      if (closed) throw new Error('Candidate execution closed.');
      const claim = await operations.claim({ ...ref, owner, leaseMs: 30000 });
      if (claim.outcome !== 'ok' || claim.value.record.state !== 'claimed' || claim.value.record.owner !== owner)
        throw new Error('Candidate dispatch already owned or unavailable.');
      checkProof(p, proof);
      const result = await operations.transition({ ...ref, event: { type: 'commit-dispatch', owner, fencingToken: claim.value.record.fencingToken } });
      if (result.outcome !== 'ok' || !result.dispatchAllowed) throw new Error('Candidate dispatch acknowledgement unavailable.');
      return checkProof(p, proof);
    } });
  const observe = (p: CandidateBundlePrepared, outcome: 'unknown' | 'conflict') => freeze({
    kind: 'steer-candidate-bundle-observation/v1' as const, operationId: p.request.bundle.operationId, inputDigest: p.plan.inputDigest,
    gateSigned: false as const, executionAuthorized: false as const, retryAuthorized: false as const, outcome,
  });
  async function run(raw: unknown, write: boolean) {
    const p = await validate(raw);
    if (closed || active || pending) return observe(p, 'unknown');
    active = true;
    try {
      const current = await operations.inspect(reference(p));
      if (current.outcome !== 'ok') return observe(p, current.outcome === 'conflict' ? 'conflict' : 'unknown');
      const op = current.value.operation, step = current.value.steps[0];
      if (op.draftId !== p.request.confirmation.draftId || op.draftRevision !== p.request.confirmation.draftRevision
        || (step && step.record.binding.inputDigest !== p.plan.inputDigest)) return observe(p, 'conflict');
      if (closed) return observe(p, 'unknown');
      // Once sent, use the read-only provider path even after process restart.
      const sent = Boolean(step && step.record.state !== 'claimed');
      const result = await (write && !sent ? writer.compareAndWrite(p.request) : writer.inspect(p.request));
      return closed || (sent && result.outcome === 'not-found') ? observe(p, 'unknown') : result;
    } catch { return observe(p, 'unknown'); }
    finally { active = false; }
  }
  return {
    async prepare(raw: unknown) {
      const submission = freeze(submissionSchema.parse(raw));
      // Validate purpose, exact document/consent hashes and configured scope
      // before allocating an operation; the placeholder plan never escapes.
      await validate({ ...submission, bundle: { ...submission.bundle, operationId: previewId } });
      if (closed || active || pending) return { outcome: 'unavailable' as const };
      active = true;
      try {
        const result = await operations.create({ draftId: submission.confirmation.draftId,
          draftRevision: submission.confirmation.draftRevision, inputDigest: inputDigest(submission, publicationDigest) });
        if (result.outcome !== 'ok') return { outcome: result.outcome };
        if (closed) return { outcome: 'unknown' as const };
        return freeze({ outcome: 'prepared' as const, request: { ...submission, bundle: { ...submission.bundle, operationId: result.value.operationId } } });
      } finally { active = false; }
    },
    /** Admission-only original-payload verification. Never contacts Git or claims a step. */
    async verifyOriginal(request: unknown): Promise<void> {
      const p = await validate(request);
      if (closed || active || pending) throw new Error('Candidate original unavailable.');
      active = true;
      try {
        const current = await operations.inspect(reference(p));
        if (closed || current.outcome !== 'ok' || current.value.operation.draftId !== p.request.confirmation.draftId
          || current.value.operation.draftRevision !== p.request.confirmation.draftRevision
          || current.value.steps.some(step => step.record.binding.inputDigest !== p.plan.inputDigest))
          throw new Error('Candidate original unavailable.');
      } finally { active = false; }
    },
    compareAndWrite: (request: unknown) => run(request, true),
    inspect: (request: unknown) => run(request, false),
    async reconcile(request: unknown) {
      const p = await validate(request);
      const result = (outcome: 'recorded' | 'unknown' | 'unavailable' | 'conflict', revision: string | null = null, resultDigest: string | null = null) => freeze({
        kind: 'steer-candidate-reconciliation/v1' as const, operationId: p.request.bundle.operationId, inputDigest: p.plan.inputDigest,
        outcome, revision, resultDigest, gateSigned: false as const, executionAuthorized: false as const, retryAuthorized: false as const,
      });
      if (closed || active || pending || typeof dependencies.authorizeReconciliation !== 'function') return result('unavailable');
      active = true;
      const authorize = async () => {
        if (closed || await within(dependencies.authorizeReconciliation!(p)) !== undefined) throw new Error();
        if (closed || await within(dependencies.authorizeRead(p)) !== undefined) throw new Error();
        if (closed) throw new Error();
      };
      try {
        await authorize();
        const current = await operations.inspect(reference(p));
        if (current.outcome !== 'ok') return result(current.outcome === 'conflict' ? 'conflict' : 'unknown');
        const op = current.value.operation, step = current.value.steps[0];
        if (op.draftId !== p.request.confirmation.draftId || op.draftRevision !== p.request.confirmation.draftRevision
          || (step && step.record.binding.inputDigest !== p.plan.inputDigest)) return result('conflict');
        // No creation, reassignment, failure erasure or manual quarantine release.
        if (!step || !['dispatch-committed', 'succeeded'].includes(step.record.state)) return result('unavailable');
        const observed = await writer.inspect(p.request);
        if (closed || observed.outcome !== 'committed') return result(observed.outcome === 'conflict' ? 'conflict' : 'unknown');
        const verifiedAt = performance.now();
        const resultDigest = createHash('sha256').update(JSON.stringify(['steer-candidate-receipt-checkpoint/v1', config.execution.organizationId,
          observed.operationId, observed.inputDigest, observed.revision, observed.expectedHead, observed.manifestDigest, observed.pointerDigest])).digest('hex');
        await authorize();
        checkpointProof = freeze({ binding: step.record.binding, resultRef: p.request.bundle.operationId, resultDigest,
          recordsPolicyDigest: config.execution.recordsPolicyDigest, verifiedAt });
        const saved = await operations.transition({ ...reference(p), stepId: 'candidate-save', stepInputDigest: p.plan.inputDigest, predecessorResultDigest: null,
          event: { type: 'checkpoint', owner: step.record.owner, fencingToken: step.record.fencingToken, resultRef: p.request.bundle.operationId, resultDigest } });
        checkpointProof = undefined;
        if (saved.outcome !== 'ok' || saved.dispatchAllowed || saved.value.record.state !== 'succeeded') return result(saved.outcome === 'conflict' ? 'conflict' : 'unknown');
        await authorize();
        if (performance.now() - verifiedAt >= 5000) return result('unknown');
        return result('recorded', observed.revision, resultDigest);
      } catch { return result('unknown'); }
      finally { checkpointProof = undefined; active = false; }
    },
    close: () => { closed = true; operations.close(); writer.close(); },
  };
}
