import type { ToolServices } from '@steer/tool-registry';

/** One explicit service bundle, not an unrestricted ToolServices override. */
export const intentJourneyMethods = Object.freeze({
  intentDrafts: ['create', 'append', 'read'], intentDraftDiscovery: ['discover'], intentRunDiscovery: ['discover'],
  intentAdmissionDiscovery: ['discover'], intentScopeDiscovery: ['discover'], intentScopePreparer: ['prepare'],
  intentScopeStarter: ['start'], intentScopeReader: ['read'], intentScopeHistoryReader: ['read'],
  intentDevelopmentReviewReader: ['review'], intentDevelopmentPreparer: ['prepare'], intentDevelopmentStarter: ['start'],
  intentDevelopmentReader: ['read'], intentDevelopmentHistoryReader: ['read'], candidateSaveReviewer: ['review'],
  candidateSavePreviewer: ['preview'], candidateSavePreparer: ['prepare'], candidateSaveStarter: ['start'],
  candidateSaveStatusReader: ['read'], candidateBundleReader: ['read'], candidateProposalReader: ['list'],
} as const);
Object.values(intentJourneyMethods).forEach(methods => Object.freeze(methods));
export type IntentJourneyServices = { readonly [K in keyof typeof intentJourneyMethods]: NonNullable<ToolServices[K]> };
export interface IntentJourneyConfiguration {
  readonly organizationId: string; readonly subject: string; readonly productId: string; readonly repository: string; readonly branch: string;
  readonly configurationRevision: string; readonly recordsPolicyDigest: string; readonly itemIds: readonly string[];
}
export interface ManagedRuntimeIntentJourney {
  readonly configuration: IntentJourneyConfiguration;
  readonly services: IntentJourneyServices;
  /** Internal records action only, not a tool or an implicit status effect. */
  readonly publicationRecords: { readonly scope: IntentJourneyServices['candidateSaveStatusReader']['scope'];
    record(input: unknown, current: () => Promise<void>): Promise<unknown> };
  /** Ownership transfers on resolution. Rejecting factories clean their own allocations. */
  shutdown(): Promise<void>;
}
const fail = () => new Error('Intent journey service is unavailable.');
const common = ['organizationId', 'subject', 'productId', 'repository'] as const;
const scopeKeys = new Set<string>([...common, 'branch', 'configurationRevision', 'recordsPolicyDigest', 'itemIds']);
const configured = new Set(['intentScopePreparer', 'intentDevelopmentReviewReader', 'intentDevelopmentPreparer',
  'candidateSaveReviewer', 'candidateSavePreviewer', 'candidateSavePreparer']);
const branched = new Set(['candidateSaveReviewer', 'candidateSavePreviewer', 'candidateSavePreparer', 'candidateSaveStarter',
  'candidateSaveStatusReader', 'candidateBundleReader', 'candidateProposalReader', 'publicationRecords']);
const itemScoped = new Set(['candidateSaveStatusReader', 'candidateBundleReader', 'candidateProposalReader', 'publicationRecords']);
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(); return value as Record<string, unknown>;
};
const sameItems = (left: unknown, right: readonly string[]) => Array.isArray(left) && left.length === right.length
  && new Set(left).size === left.length && left.every(item => typeof item === 'string' && right.includes(item));
const sameConfiguration = (value: unknown, expected: IntentJourneyConfiguration) => {
  const actual = object(value);
  return Object.keys(actual).length === Object.keys(expected).length && Object.keys(expected).every(key =>
    key === 'itemIds' ? sameItems(actual[key], expected.itemIds) : actual[key] === expected[key as keyof IntentJourneyConfiguration]);
};

/** Pin methods/scope and retain bounded calls until actual work drains. This
 * wrapper never grants a tool, fabricates records adoption or supplies a provider.
 * The permission callback is additional current bundle-use authority; every
 * existing service still owns its full action-time authorization contracts. */
export function manageIntentJourney(expected: IntentJourneyConfiguration, owned: ManagedRuntimeIntentJourney, authorize: () => Promise<void>) {
  expected = Object.freeze({ ...expected, itemIds: Object.freeze([...expected.itemIds]) });
  if (!sameConfiguration(owned.configuration, expected) || typeof owned.shutdown !== 'function' || typeof authorize !== 'function'
    || Object.keys(object(owned.services)).length !== Object.keys(intentJourneyMethods).length
    || Object.keys(owned.services).some(key => !(key in intentJourneyMethods))) throw fail();
  let stopping = false, disposed = false, active = 0, drain: (() => void) | undefined, stopped: Promise<void> | undefined;
  const bind = (name: string, raw: unknown, methods: readonly string[]) => {
    const source = object(raw), scope = object(source.scope), pinned = JSON.stringify(scope);
    if (Object.keys(scope).some(key => !scopeKeys.has(key)) || common.some(key => scope[key] !== expected[key])
      || (branched.has(name) && scope.branch !== expected.branch)
      || (configured.has(name) && scope.configurationRevision !== expected.configurationRevision)
      || ((itemScoped.has(name) || 'itemIds' in scope) && !sameItems(scope.itemIds, expected.itemIds))
      || (['branch', 'configurationRevision', 'recordsPolicyDigest'] as const).some(key => key in scope && scope[key] !== expected[key])) throw fail();
    const entries = methods.map(method => {
      const invoke = source[method]; if (typeof invoke !== 'function') throw fail();
      return [method, async (input: unknown, revalidate: () => Promise<void>) => {
        if (stopping || disposed || active >= 4 || typeof revalidate !== 'function') throw fail(); active++;
        let finished = false, settled = false, pending = 0, released = false, timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = performance.now() + 120000;
        const release = () => { if (settled && !pending && !released) { released = true; active--; if (!active) drain?.(); } };
        const guard = () => {
          if (finished || disposed || performance.now() >= deadline || !sameConfiguration(owned.configuration, expected)
            || (name === 'publicationRecords' ? owned.publicationRecords : owned.services[name as keyof IntentJourneyServices]) !== source
            || JSON.stringify(source.scope) !== pinned || source[method] !== invoke) throw fail();
        };
        const tracked = async <T>(work: () => Promise<T>, limit?: number): Promise<T> => {
          guard(); pending++;
          const task = Promise.resolve().then(() => { guard(); return work(); });
          void task.finally(() => { pending--; release(); }).catch(() => {});
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            const value = limit === undefined ? await task : await Promise.race([task, new Promise<never>((_, reject) => {
              timeout = setTimeout(() => reject(fail()), limit);
            })]); guard(); return value;
          } finally { if (timeout) clearTimeout(timeout); }
        };
        const current = async () => {
          if (await tracked(revalidate, 5000) !== undefined || await tracked(authorize, 5000) !== undefined) throw fail();
          if (await tracked(revalidate, 5000) !== undefined) throw fail();
        };
        const work = Promise.resolve().then(async () => { await current(); const result = await tracked(() => invoke.call(source, input, current)); await current(); return result; });
        void work.finally(() => { settled = true; release(); }).catch(() => {});
        try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(fail()), 120000); })]); }
        catch { throw fail(); }
        finally { finished = true; if (timer) clearTimeout(timer); }
      }];
    });
    // Only a cloned reference scope and explicit methods reach either transport.
    const clone = JSON.parse(pinned) as Record<string, unknown>;
    if (Array.isArray(clone.itemIds)) Object.freeze(clone.itemIds);
    return Object.freeze({ scope: Object.freeze(clone), ...Object.fromEntries(entries) });
  };
  const services = Object.freeze(Object.fromEntries(Object.entries(intentJourneyMethods).map(([name, methods]) =>
    [name, bind(name, owned.services[name as keyof IntentJourneyServices], methods)]))) as IntentJourneyServices;
  const publicationRecords = bind('publicationRecords', owned.publicationRecords, ['record']) as ManagedRuntimeIntentJourney['publicationRecords'];
  return { services, publicationRecords,
    shutdown() {
      if (stopped) return stopped; stopping = true;
      stopped = (async () => {
        if (active) await new Promise<void>(resolve => { drain = resolve; });
        disposed = true; drain = undefined;
        try { await owned.shutdown(); } catch { throw new Error('Intent journey resource shutdown failed.'); }
      })(); return stopped;
    },
  };
}
