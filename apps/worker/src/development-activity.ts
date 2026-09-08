import type { createDevelopmentStepRuntime } from './development-step-runtime.ts';
import { parseDevelopmentTarget, parseDevelopmentStepTarget, parseDevelopmentStepResult } from './development-workflow-contracts.ts';

/** Uninstalled fixed-operation wrapper. The trusted caller binds the runtime to
 * this same operation and owns model/pool closure. SQL remains the execution truth.
 */
export function createDevelopmentActivities(raw: unknown, runtime: Pick<ReturnType<typeof createDevelopmentStepRuntime>, 'run' | 'close'>) {
  const target = parseDevelopmentTarget(raw);
  if (typeof runtime?.run !== 'function' || typeof runtime?.close !== 'function') throw new Error('Development activity unavailable.');
  let closed = false, active = false, abortActive: (() => void) | undefined;
  const close = () => {
    if (closed) return; closed = true; abortActive?.();
    try { runtime.close(); } catch { /* Do not publish private close errors into history. */ }
  };
  return {
    async developIntentStep(rawTarget: unknown, cancellation: AbortSignal) {
      const actual = parseDevelopmentStepTarget(rawTarget);
      if (actual.organizationId !== target.organizationId || actual.operationId !== target.operationId || actual.inputDigest !== target.inputDigest
        || closed || active || !(cancellation instanceof AbortSignal) || cancellation.aborted) throw new Error('Development activity unavailable.');
      active = true; let pending = false, finished = false;
      const controller = new AbortController(), release = () => { if (finished && !pending) active = false; };
      abortActive = () => controller.abort();
      const abort = () => close(); cancellation.addEventListener('abort', abort, { once: true });
      const deadline = setTimeout(abort, 100000);
      let onAbort: (() => void) | undefined;
      try {
        if (closed || cancellation.aborted) throw new Error();
        pending = true;
        const work = Promise.resolve().then(() => {
          if (closed || controller.signal.aborted) throw new Error();
          return runtime.run(actual.role, controller.signal);
        });
        void work.finally(() => { pending = false; release(); }).catch(() => {});
        const result = await Promise.race([work, new Promise<never>((_, reject) => {
          onAbort = () => reject(new Error()); controller.signal.addEventListener('abort', onAbort, { once: true });
        })]);
        if (closed || cancellation.aborted || controller.signal.aborted) throw new Error();
        return parseDevelopmentStepResult(result, actual);
      } catch { throw new Error('Intent development requires attention.'); }
      finally {
        clearTimeout(deadline); cancellation.removeEventListener('abort', abort);
        if (onAbort) controller.signal.removeEventListener('abort', onAbort);
        abortActive = undefined; controller.abort(); finished = true; release();
      }
    },
    close,
    status: () => ({ active, closed }),
  };
}
