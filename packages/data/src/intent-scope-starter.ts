import { intentScopeStartInputSchema, intentScopeStartOutputSchema, scopeScheduleReceiptSchema,
  type IntentScopeStarter, type ScopeScheduler } from '@steer/tool-registry/intent-scope-start-contracts';
import { createScopeReviewOriginalStore, scopeRecordsConfigurationSchema } from './scope-review-originals.ts';
import { createScopeReviewOperationStore } from './scope-review-operations.ts';
import { scopeOriginalHash as hash, freezeScopeOriginal as freeze, type ScopeOriginal } from './scope-original-contracts.ts';
import { createReadPolicyAuthority } from './read-policy-authority.ts';

type Records = Parameters<typeof createScopeReviewOriginalStore>[2];
const unavailable = () => new Error('Scope start is unavailable.');
/** Uninstalled start boundary for an already admitted review and acknowledged
 * encrypted original. It never manufactures originals, direction, profiles, scope
 * clearance or spending authority. Reference preparation/admission remains upstream. */
export function createIntentScopeStarter(pools: Parameters<typeof createScopeReviewOriginalStore>[0], rawConfig: unknown, deps: {
  records: Records; scheduler: ScopeScheduler;
  authorizeStart(original: Readonly<ScopeOriginal>): Promise<void>;
}) {
  const config = freeze(scopeRecordsConfigurationSchema.parse(rawConfig));
  const scope = freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, repository: config.repository });
  const r = deps.records;
  if ([r?.authorize, r?.authorizeOriginal, r?.authorizeReview, r?.authorizeDraft, r?.keyForDraft, deps.scheduler?.start, deps.authorizeStart]
    .some(v => typeof v !== 'function')) throw unavailable();
  let closed = false, active = 0; const children = new Set<{ close(): void }>();
  return {
    scope,
    async start(raw, revalidate) {
      const input = intentScopeStartInputSchema.parse(raw);
      if (closed || active >= 4 || typeof revalidate !== 'function' || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])) throw unavailable();
      active++;
      let finished = false, settled = false, pending = 0, released = false, timer: ReturnType<typeof setTimeout> | undefined;
      const owned: { close(): void }[] = [], target = freeze({ reviewId: input.reviewId, preparationDigest: input.preparationDigest });
      const release = () => { if (settled && !pending && !released) { released = true; active--; } };
      const guard = () => { if (finished || closed) throw unavailable(); };
      const track = async <T>(work: Promise<T>) => { pending++; try { return await work; } finally { pending--; release(); } };
      const current = async () => { guard(); if (await track(Promise.resolve().then(revalidate)) !== undefined) throw unavailable(); guard(); };
      const checked = async <T>(work: () => Promise<T>) => { await current(); const value = await track(Promise.resolve().then(work)); await current(); return value; };
      // This service only inspects records. Scheduling/start authority and key IO
      // remain independently bracketed; every metadata policy still runs freshly.
      const authority = createReadPolicyAuthority(current, track, guard);
      const secured: Records = {
        authorize: c => authority(c.action, () => r.authorize(c)),
        authorizeOriginal: c => authority(c.action, () => r.authorizeOriginal(c)),
        authorizeDraft: c => authority(c.action, () => r.authorizeDraft(c)),
        authorizeReview: async c => { if (hash(c.request) !== hash(target)) throw unavailable(); await authority('read', () => r.authorizeReview(c)); },
        keyForDraft: (ref, keyId) => { if (keyId === null) throw unavailable(); return checked(() => r.keyForDraft(ref, keyId)); },
      };
      const scopedPools = { drafts: { connect: () => { guard(); return track(pools.drafts.connect()); } },
        execution: { connect: () => { guard(); return track(pools.execution.connect()); } } };
      const own = <T extends { close(): void }>(store: T) => { owned.push(store); children.add(store); return store; };
      const work = Promise.resolve().then(async () => {
        await current(); const originals = own(createScopeReviewOriginalStore(scopedPools, config, secured));
        const read = async () => {
          const found = await originals.read(target); guard(); const s = found.original.source;
          if (found.reviewExpired || found.latestDraftRevision !== input.revision || s.scope.draftId !== input.draftId
            || s.revision !== input.revision || s.revisionDigest !== input.revisionDigest) throw unavailable();
          return found.original;
        };
        const original = await read();
        const operations = own(createScopeReviewOperationStore(scopedPools.execution, original.configuration, {
          authorize: secured.authorizeReview, verifyCheckpoint: async () => { throw unavailable(); },
        }));
        const authorize = async () => {
          await current(); if (hash(await read()) !== hash(original)) throw unavailable();
          if (await checked(() => deps.authorizeStart(original)) !== undefined) throw unavailable();
          // Recheck source and SQL operation after the external authorization wait.
          if (hash(await read()) !== hash(original)) throw unavailable();
          const op = await operations.inspect(target); guard();
          if (op.outcome !== 'ok' || op.value.manifest.draftId !== input.draftId || op.value.manifest.draftRevision !== input.revision) throw unavailable();
          if (hash(await read()) !== hash(original)) throw unavailable();
          await current(); if (Date.parse(original.configuration.expiresAt) <= Date.now()) throw unavailable();
        };
        await authorize();
        const receipt = scopeScheduleReceiptSchema.parse(await track(deps.scheduler.start(freeze({ organizationId: scope.organizationId,
          ...target, expiresAt: original.configuration.expiresAt }), authorize)));
        // A lost permission after dispatch conceals the ACK but never undoes or
        // restarts that workflow. The existing read query is separate authority.
        await authorize();
        return freeze(intentScopeStartOutputSchema.parse({ ...input, kind: 'steer-scope-start/v1', receipt,
          savedToGit: false, gateSigned: false, semanticReviewComplete: false, authoritativeClearance: false, executionAuthorized: false, retryAuthorized: false }));
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); for (const child of owned) { child.close(); children.delete(child); } }
    },
    close() { closed = true; children.forEach(child => child.close()); },
  } satisfies IntentScopeStarter & { close(): void };
}
