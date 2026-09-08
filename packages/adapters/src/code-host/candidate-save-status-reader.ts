import { z } from 'zod';
import { candidateBundleInputSchema, planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { intentSaveBindingSchema } from '@steer/tool-registry/intent-revision-contracts';
import { candidateSaveStatusInputSchema, candidateSaveStatusScopeSchema, candidateSaveObservationSchema, verifyCandidateSaveStatus,
  type CandidateSaveStatusReader } from '@steer/tool-registry/candidate-save-status-contracts';
import { createGitHubCandidateBundleInspector, candidateBundleStoreConfigurationSchema } from './github-candidate-bundle-store.ts';

const originalSchema = z.strictObject({ bundle: candidateBundleInputSchema, confirmation: intentSaveBindingSchema });
type Provider = Parameters<typeof createGitHubCandidateBundleInspector>[2];
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}

/** Uninstalled original-bound read recovery. No admission, dispatch, workflow start,
 * checkpoint, quarantine release, retry, scope refresh or new operation ID.
 */
export function createCandidateSaveStatusReader(rawScope: unknown, binding: Parameters<typeof createGitHubCandidateBundleInspector>[0],
  publication: unknown, dependencies: Provider & {
    loadOriginal: (target: { organizationId: string; operationId: string; inputDigest: string }) => Promise<unknown>;
  }) {
  const scope = freeze(candidateSaveStatusScopeSchema.parse(rawScope)), config = candidateBundleStoreConfigurationSchema.parse(publication);
  if ((['organizationId', 'productId', 'repository', 'branch'] as const).some(key => scope[key] !== config[key])
    || scope.itemIds.some(id => !config.itemIds.includes(id)) || typeof dependencies.loadOriginal !== 'function') throw new Error('Candidate status configuration unavailable.');
  const inspector = createGitHubCandidateBundleInspector(binding, config, dependencies);
  const lifetime = new AbortController(); let active = false;
  return { scope,
    async read(raw, current) {
      const input = freeze(candidateSaveStatusInputSchema.parse(raw));
      if (lifetime.signal.aborted || active || typeof current !== 'function'
        || (['organizationId', 'productId', 'repository', 'branch'] as const).some(key => input[key] !== scope[key])) throw new Error('Candidate status unavailable.');
      active = true; let pending = 0, finished = false;
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(90000)]);
      const release = () => { if (finished && pending === 0) active = false; };
      const bounded = async <T>(work: () => Promise<T>): Promise<T> => {
        signal.throwIfAborted(); pending++; let abort: () => void = () => {};
        const task = Promise.resolve().then(() => { signal.throwIfAborted(); return work(); });
        void task.finally(() => { pending--; release(); }).catch(() => {});
        try { return await Promise.race([task, new Promise<never>((_, reject) => {
          abort = () => reject(new Error('Candidate status unavailable.')); signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        })]); } finally { signal.removeEventListener('abort', abort); }
      };
      const authorize = async () => { if (await bounded(current) !== undefined) throw new Error(); signal.throwIfAborted(); };
      try {
        await authorize();
        const original = freeze(originalSchema.parse(await bounded(() => dependencies.loadOriginal({
          organizationId: input.organizationId, operationId: input.operationId, inputDigest: input.inputDigest }))));
        await authorize();
        const bundle = original.bundle, confirmation = original.confirmation;
        if (bundle.originatorSubject !== scope.subject || !scope.itemIds.includes(bundle.itemId)
          || bundle.operationId !== input.operationId || confirmation.draftId !== input.draftId || confirmation.draftRevision !== input.draftRevision
          || (['organizationId', 'productId', 'repository', 'branch'] as const).some(key => bundle[key] !== input[key])) throw new Error();
        const plan = await planCandidateBundle(bundle, confirmation);
        if (plan.inputDigest !== input.inputDigest || !plan.confirmationDigest) throw new Error();
        await authorize();
        const observed = candidateSaveObservationSchema.parse(await bounded(() => inspector.inspect(original, authorize)));
        await authorize();
        if (observed.operationId !== input.operationId || observed.inputDigest !== plan.inputDigest) throw new Error();
        // Receipt reads may be slow. Recheck the retained original, keys and
        // lifecycle before disclosing even a committed-status reference.
        const latestOriginal = originalSchema.parse(await bounded(() => dependencies.loadOriginal({
          organizationId: input.organizationId, operationId: input.operationId, inputDigest: input.inputDigest })));
        if (JSON.stringify(latestOriginal) !== JSON.stringify(original)) throw new Error();
        await authorize();
        const base = { ...input, kind: 'steer-candidate-save-status/v1', retryAuthorized: false, executionAuthorized: false, gateSigned: false };
        if (observed.outcome !== 'committed') return verifyCandidateSaveStatus(input, { ...base, outcome: observed.outcome, saveVerified: false,
          ...(observed.outcome === 'not-found' ? { observedHead: observed.observedHead } : {}) });
        if (observed.expectedHead !== plan.expectedHead || observed.manifestDigest !== plan.manifestDigest || observed.pointerDigest !== plan.pointerDigest) throw new Error();
        return verifyCandidateSaveStatus(input, { ...base, outcome: 'committed', saveVerified: true,
          reference: { organizationId: input.organizationId, productId: input.productId, repository: input.repository, branch: input.branch,
            itemId: bundle.itemId, bundleId: bundle.bundleId, revision: observed.revision, manifestDigest: plan.manifestDigest },
          expectedHead: plan.expectedHead, pointerDigest: plan.pointerDigest, confirmationDigest: plan.confirmationDigest });
      } catch { throw new Error('Candidate save status could not be verified.'); }
      finally { finished = true; release(); }
    },
    close() { lifetime.abort(); inspector.close(); },
  } satisfies CandidateSaveStatusReader & { close(): void };
}
