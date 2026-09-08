import { z } from 'zod';
import { candidateBundleInputSchema, planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { intentSaveBindingSchema } from '@steer/tool-registry/intent-revision-contracts';
import type { createDurableCandidateBundleStore } from './candidate-bundle-runtime.ts';
import { parseCandidateSaveTarget, parseCandidateSaveResult, type CandidateSaveTarget } from './candidate-save-contracts.ts';

const requestSchema = z.strictObject({ bundle: candidateBundleInputSchema, confirmation: intentSaveBindingSchema });
const sha = z.string().length(40).regex(/^[a-f0-9]{40}$/), digest = z.string().length(64).regex(/^[a-f0-9]{64}$/);
const base = { kind: z.literal('steer-candidate-bundle-observation/v1'), operationId: z.uuid().length(36), inputDigest: digest,
  gateSigned: z.literal(false), executionAuthorized: z.literal(false), retryAuthorized: z.literal(false) };
const observationSchema = z.discriminatedUnion('outcome', [
  z.strictObject({ ...base, outcome: z.literal('unknown') }), z.strictObject({ ...base, outcome: z.literal('conflict') }),
  z.strictObject({ ...base, outcome: z.literal('not-found'), observedHead: sha }),
  z.strictObject({ ...base, outcome: z.literal('committed'), revision: sha, expectedHead: sha, manifestDigest: digest, pointerDigest: digest }),
]);
type Store = Pick<ReturnType<typeof createDurableCandidateBundleStore>, 'compareAndWrite' | 'close'>;

/** Uninstalled, fixed-operation activity. The caller owns the current authority
 * and exact original-payload store; neither bytes nor callbacks enter history.
 */
export function createCandidateSaveActivities(raw: unknown, dependencies: {
  store: Store; authorize: (target: CandidateSaveTarget) => Promise<void>;
  loadOriginal: (target: CandidateSaveTarget) => Promise<unknown>;
}) {
  const target = parseCandidateSaveTarget(raw);
  if ([dependencies.authorize, dependencies.loadOriginal, dependencies.store?.compareAndWrite, dependencies.store?.close].some(v => typeof v !== 'function'))
    throw new Error('Candidate activity services unavailable.');
  let active = false, closed = false;
  const close = () => { if (closed) return; closed = true; dependencies.store.close(); };
  return {
    async saveCandidateBundle(rawTarget: unknown, cancellation: AbortSignal) {
      const actual = parseCandidateSaveTarget(rawTarget);
      if (Object.keys(target).some(k => target[k as keyof CandidateSaveTarget] !== actual[k as keyof CandidateSaveTarget])
        || closed || active || !cancellation || cancellation.aborted) throw new Error('Candidate activity unavailable.');
      active = true;
      const controller = new AbortController(); let pending = 0, finished = false;
      const release = () => { if (finished && pending === 0) active = false; };
      const abort = () => { close(); controller.abort(); };
      cancellation.addEventListener('abort', abort, { once: true });
      const deadline = setTimeout(abort, 90000);
      const guard = () => { if (closed || cancellation.aborted || controller.signal.aborted) throw new Error('Candidate activity unavailable.'); };
      const bounded = async <T>(work: Promise<T>, ms: number): Promise<T> => {
        pending++; void work.finally(() => { pending--; release(); }).catch(() => {});
        let timer: ReturnType<typeof setTimeout> | undefined, onAbort: (() => void) | undefined;
        try {
          guard();
          return await Promise.race([work, new Promise<never>((_, reject) => {
            onAbort = () => reject(new Error('Candidate activity unavailable.'));
            controller.signal.addEventListener('abort', onAbort, { once: true }); timer = setTimeout(abort, ms);
          })]);
        } finally { if (timer) clearTimeout(timer); if (onAbort) controller.signal.removeEventListener('abort', onAbort); }
      };
      const authorize = async () => { guard(); if (await bounded(dependencies.authorize(target), 5000) !== undefined) throw new Error(); guard(); };
      try {
        await authorize();
        const request = requestSchema.parse(await bounded(dependencies.loadOriginal(target), 5000)); guard();
        if (request.bundle.organizationId !== target.organizationId || request.bundle.operationId !== target.operationId) throw new Error();
        const plan = await planCandidateBundle(request.bundle, request.confirmation); guard();
        if (plan.inputDigest !== target.inputDigest) throw new Error();
        await authorize();
        const observation = observationSchema.parse(await bounded(dependencies.store.compareAndWrite(request), 75000)); guard();
        if (observation.operationId !== target.operationId || observation.inputDigest !== target.inputDigest
          || (observation.outcome === 'committed' && (observation.expectedHead !== plan.expectedHead
            || observation.manifestDigest !== plan.manifestDigest || observation.pointerDigest !== plan.pointerDigest))) throw new Error();
        await authorize();
        return parseCandidateSaveResult({ operationId: target.operationId, inputDigest: target.inputDigest,
          outcome: observation.outcome, revision: observation.outcome === 'committed' ? observation.revision : null }, target);
      } catch { throw new Error('Candidate save requires attention.'); }
      finally {
        clearTimeout(deadline); cancellation.removeEventListener('abort', abort); finished = true; release();
      }
    },
    close,
    status: () => ({ active, closed }),
  };
}
