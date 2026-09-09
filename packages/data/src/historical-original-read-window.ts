import type { DevelopmentOriginal } from './development-original-contracts.ts';
import { developmentOriginalHash as hash } from './development-original-contracts.ts';

export type HistoricalOriginalSnapshot = Readonly<{ original: DevelopmentOriginal; latestDraftRevision: number;
  operationExpired: boolean; executionAuthorized: false; retryAuthorized: false; gateSigned: false; historical: true }>;
declare const windowBrand: unique symbol;
export type HistoricalOriginalReadWindow = Readonly<{ [windowBrand]: true }>;
type Read = (raw: unknown) => Promise<HistoricalOriginalSnapshot>;
type Run = <T>(raw: unknown, current: () => Promise<void>, work: (read: Read) => Promise<T>) => Promise<T>;
const stores = new WeakMap<object, { configurationDigest: string; run: Run }>();
const windows = new WeakMap<HistoricalOriginalReadWindow, { configurationDigest: string; read: Read }>();
const unavailable = () => new Error('Historical original read is unavailable.');

/** Private constructor registration, absent from package exports and requests.
 * Only the actual original store supplies readback/key/lifecycle verification. */
export function registerHistoricalOriginalReadWindow(store: object, configuration: unknown, run: Run) {
  if (stores.has(store)) throw unavailable();
  stores.set(store, { configurationDigest: hash(configuration), run });
}

/** One read-only computation; no writes or result publication inside work.
 * The store owns final full verification and actual pending-work drain; the
 * enclosing history owner supplies cancellation and its 30-second deadline. */
export async function withHistoricalOriginalReadWindow<T>(store: object, raw: unknown, current: () => Promise<void>,
  work: (window: HistoricalOriginalReadWindow) => Promise<T>): Promise<T> {
  const registered = stores.get(store);
  if (!registered || typeof current !== 'function' || typeof work !== 'function') throw unavailable();
  return registered.run(raw, current, async read => {
    const token = Object.freeze({}) as HistoricalOriginalReadWindow;
    windows.set(token, { configurationDigest: registered.configurationDigest, read });
    try { return await work(token); } finally { windows.delete(token); }
  });
}

export function readHistoricalOriginalWindow(window: HistoricalOriginalReadWindow, configuration: unknown, raw: unknown) {
  const registered = windows.get(window);
  if (!registered || registered.configurationDigest !== hash(configuration)) throw unavailable();
  return registered.read(raw);
}
