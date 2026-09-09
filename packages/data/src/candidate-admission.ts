import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateBundleInputSchema, planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { intentSaveBindingSchema } from '@steer/tool-registry/intent-revision-contracts';
import { createIntentOperationStore, intentOperationConfigurationSchema } from './intent-operations.ts';
import type { DatabasePool } from './runtime-pool.ts';

export const candidateSubmissionSchema = z.strictObject({
  bundle: z.strictObject(candidateBundleInputSchema.shape).omit({ operationId: true }), confirmation: intentSaveBindingSchema,
});
export const candidateRequestSchema = z.strictObject({ bundle: candidateBundleInputSchema, confirmation: intentSaveBindingSchema });
export const candidateAdmissionOptionsSchema = z.strictObject({
  publicationDigest: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
  serviceCommitter: candidateBundleInputSchema.shape.serviceCommitter,
  itemIds: z.array(candidateBundleInputSchema.shape.itemId).min(1).max(100).refine(v => new Set(v).size === v.length),
});
export function candidateSubmissionOf(request: z.infer<typeof candidateRequestSchema>) {
  const { operationId: _operation, ...bundle } = request.bundle;
  return candidateSubmissionSchema.parse({ bundle, confirmation: request.confirmation });
}
export function candidateSubmissionDigest(value: z.infer<typeof candidateSubmissionSchema>, publicationDigest: string) {
  return createHash('sha256').update(JSON.stringify(['steer-candidate-submission/v1', publicationDigest, value])).digest('hex');
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
const placeholder = '00000000-0000-4000-8000-000000000000';
const failure = () => new Error('Candidate admission unavailable.');
/** Shared API/worker admission, never a provider writer or consent verifier.
 * Preserves the existing submission hash and SQL uniqueness/expiry contract.
 * No operation ID may come from a submission; no step or budget is allocated. */
export function createCandidateAdmission(pool: DatabasePool, rawExecution: unknown, rawOptions: unknown,
  authorize: Parameters<typeof createIntentOperationStore>[2]['authorize']) {
  const config = freeze(intentOperationConfigurationSchema.parse(rawExecution)), options = freeze(candidateAdmissionOptionsSchema.parse(rawOptions));
  if (config.action !== 'candidate-save' || config.budget !== null || typeof authorize !== 'function') throw failure();
  const operations = createIntentOperationStore(pool, config, { authorize, verifyCheckpoint: async () => { throw failure(); } });
  let closed = false, active = false;
  const validate = async (raw: unknown) => {
    const request = freeze(candidateRequestSchema.parse(raw)), input = request.bundle;
    if ((['organizationId', 'productId', 'repository', 'branch'] as const).some(k => input[k] !== config[k])
      || input.originatorSubject !== config.subject || input.serviceCommitter !== options.serviceCommitter || !options.itemIds.includes(input.itemId)) throw failure();
    return freeze({ request, plan: await planCandidateBundle(input, request.confirmation) });
  };
  return {
    async prepare(raw: unknown) {
      const submission = freeze(candidateSubmissionSchema.parse(raw));
      await validate({ ...submission, bundle: { ...submission.bundle, operationId: placeholder } });
      if (closed || active) return { outcome: 'unavailable' as const }; active = true;
      try {
        const result = await operations.create({ draftId: submission.confirmation.draftId, draftRevision: submission.confirmation.draftRevision,
          inputDigest: candidateSubmissionDigest(submission, options.publicationDigest) });
        if (result.outcome !== 'ok') return { outcome: result.outcome };
        if (closed) return { outcome: 'unknown' as const };
        return freeze({ outcome: 'prepared' as const, request: { ...submission, bundle: { ...submission.bundle, operationId: result.value.operationId } } });
      } finally { active = false; }
    },
    async verifyOriginal(raw: unknown): Promise<void> {
      const p = await validate(raw);
      if (closed || active) throw failure(); active = true;
      try {
        const current = await operations.inspect({ operationId: p.request.bundle.operationId,
          inputDigest: candidateSubmissionDigest(candidateSubmissionOf(p.request), options.publicationDigest) });
        if (closed || current.outcome !== 'ok' || current.value.operation.draftId !== p.request.confirmation.draftId
          || current.value.operation.draftRevision !== p.request.confirmation.draftRevision
          || current.value.steps.some(step => step.record.binding.inputDigest !== p.plan.inputDigest)) throw failure();
      } finally { active = false; }
    },
    close() { closed = true; operations.close(); },
  };
}
