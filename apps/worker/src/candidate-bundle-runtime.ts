import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createIntentOperationStore, intentOperationConfigurationSchema } from '@steer/data/intent-operations';
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
  }) {
  const config = freeze(optionsSchema.parse(rawOptions)), owner = randomUUID();
  if (config.execution.action !== 'candidate-save' || config.execution.budget !== null
    || typeof dependencies.evaluateDispatch !== 'function') throw new Error('Invalid candidate execution configuration.');
  for (const key of ['organizationId', 'productId', 'repository', 'branch'] as const)
    if (config.execution[key] !== config.publication[key]) throw new Error('Candidate execution scope mismatch.');
  const publicationDigest = createHash('sha256').update(JSON.stringify([config.publication,
    binding.organizationId, binding.installationId, binding.repositoryId, binding.owner, binding.repository, binding.branch])).digest('hex');
  const operations = createIntentOperationStore(pool, config.execution, { authorize: dependencies.authorizeOperation,
    verifyCheckpoint: async () => { throw new Error('Candidate receipt reconciliation is not installed.'); } });
  let closed = false, active = false;
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
    if (closed || active) return observe(p, 'unknown');
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
      if (closed || active) return { outcome: 'unavailable' as const };
      active = true;
      try {
        const result = await operations.create({ draftId: submission.confirmation.draftId,
          draftRevision: submission.confirmation.draftRevision, inputDigest: inputDigest(submission, publicationDigest) });
        if (result.outcome !== 'ok') return { outcome: result.outcome };
        if (closed) return { outcome: 'unknown' as const };
        return freeze({ outcome: 'prepared' as const, request: { ...submission, bundle: { ...submission.bundle, operationId: result.value.operationId } } });
      } finally { active = false; }
    },
    compareAndWrite: (request: unknown) => run(request, true),
    inspect: (request: unknown) => run(request, false),
    close: () => { closed = true; operations.close(); writer.close(); },
  };
}
