import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout as delay } from 'node:timers/promises';

/** TEST ONLY. Wrap a disposable native fixture, never a real provider. Request-
 * local counters include identity traffic and remain separate under concurrency.
 * No URLs, tokens, headers, bodies, errors or identities enter reported samples. */
export function createIntentPerformanceProbe(options = { delayMs: 20, maxAttempts: 200 }) {
  const { delayMs, maxAttempts } = options;
  if (!Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 20
    || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 200) throw new Error('Invalid synthetic probe bounds.');
  type State = { closed: boolean; attempts: number; dispatched: number; pending: number; peakPending: number;
    limited: boolean; controller: AbortController; tasks: Set<Promise<unknown>> };
  const context = new AsyncLocalStorage<State>();
  const denied = () => new Error('Synthetic performance probe is closed or over budget.');
  return {
    wrap(transport: typeof fetch): typeof fetch {
      return (input, init) => {
        const state = context.getStore();
        if (!state) return transport(input, init); // Fixture seeding is not measured.
        if (state.closed) return Promise.reject(denied());
        state.attempts++;
        if (state.attempts > maxAttempts || state.limited) {
          state.limited = true; return Promise.reject(denied());
        }
        state.pending++; state.peakPending = Math.max(state.peakPending, state.pending);
        const caller = init?.signal ?? (input instanceof Request ? input.signal : undefined);
        const signal = caller ? AbortSignal.any([caller, state.controller.signal]) : state.controller.signal;
        const task = (async () => {
          signal.throwIfAborted();
          await delay(delayMs, undefined, { signal });
          if (state.closed || state.limited) throw denied();
          signal.throwIfAborted(); state.dispatched++;
          return transport(input, { ...init, signal });
        })();
        state.tasks.add(task);
        void task.finally(() => { state.pending--; state.tasks.delete(task); }).catch(() => {});
        return task;
      };
    },
    async measure<T>(work: () => Promise<T>) {
      const state: State = { closed: false, attempts: 0, dispatched: 0, pending: 0, peakPending: 0,
        limited: false, controller: new AbortController(), tasks: new Set() };
      const start = performance.now(); let value: T | undefined, error: unknown, returned = false;
      try { value = await context.run(state, work); returned = true; } catch (failure) { error = failure; }
      const ms = performance.now() - start, outstandingAtReturn = state.pending;
      state.closed = true; state.controller.abort();
      // The real runtime owns underlying resource drain. The benchmark never
      // claims unawaited work as a successful latency sample.
      const sample = Object.freeze({ ms, attempts: state.attempts, dispatched: state.dispatched,
        peakPending: state.peakPending, outstandingAtReturn, limited: state.limited,
        delayMs, maxAttempts, returned });
      return { value, error, sample };
    },
  };
}

export type IntentPerformanceSample = Awaited<ReturnType<ReturnType<typeof createIntentPerformanceProbe>['measure']>>['sample'];

/** No percentile on an incomplete, failed, undrained or differently configured
 * group. Report all raw metadata samples so failures cannot become outliers. */
export function summarizeIntentPerformance(samples: readonly IntentPerformanceSample[], expectedCount: number,
  responseSucceeded: readonly boolean[]) {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1 || samples.length > expectedCount
    || responseSucceeded.length !== samples.length) throw new Error('Invalid synthetic sample group.');
  const complete = samples.length === expectedCount;
  const healthy = complete && samples.every((sample, index) => responseSucceeded[index] && sample.returned
    && !sample.limited && sample.outstandingAtReturn === 0 && sample.attempts <= 200
    && sample.delayMs === 20 && sample.maxAttempts === 200 && Number.isFinite(sample.ms) && sample.ms >= 0
    && [sample.attempts, sample.dispatched, sample.peakPending, sample.outstandingAtReturn].every(n => Number.isSafeInteger(n) && n >= 0)
    && sample.dispatched <= sample.attempts && sample.peakPending <= sample.attempts);
  const times = samples.map(sample => sample.ms).sort((a, b) => a - b);
  const p95Ms = healthy ? times[Math.ceil(times.length * 0.95) - 1]! : null;
  return Object.freeze({ complete, healthy, p95Ms, maximumMs: healthy ? times.at(-1)! : null,
    withinTarget: healthy && p95Ms! <= 5000, samples: Object.freeze(samples.map(sample => Object.freeze({ ...sample }))) });
}
