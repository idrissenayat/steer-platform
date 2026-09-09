import { intentDevelopmentStartInputSchema, intentDevelopmentStartOutputSchema, developmentScheduleReceiptSchema,
  type IntentDevelopmentStarter, type DevelopmentScheduler } from '@steer/tool-registry/intent-development-start-contracts';
import { createDevelopmentOriginalStore, developmentRecordsConfigurationSchema } from './development-originals.ts';
import { createIntentOperationStore } from './intent-operations.ts';
import { developmentOriginalHash as hash, freezeOriginal as freeze, type DevelopmentOriginal } from './development-original-contracts.ts';
import { withCurrentScopeReadWindow } from './current-scope-read-window.ts';
import { bracketCurrentReadAuthority } from './current-read-authority.ts';
import { createReadPolicyAuthority } from './read-policy-authority.ts';

type Records = Parameters<typeof createDevelopmentOriginalStore>[2];
const unavailable = () => new Error('Development start is unavailable.');
/** Uninstalled start boundary for an already admitted operation and acknowledged
 * encrypted original. It never manufactures originals, direction, profiles, scope
 * clearance or spending authority. Reference preparation/admission remains upstream. */
export function createIntentDevelopmentStarter(pools: Parameters<typeof createDevelopmentOriginalStore>[0], rawConfig: unknown, deps: {
  records: Records; scheduler: DevelopmentScheduler;
  authorizeStart(original: Readonly<DevelopmentOriginal>): Promise<void>;
}) {
  const config = freeze(developmentRecordsConfigurationSchema.parse(rawConfig));
  const scope = freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, repository: config.repository });
  const r = deps.records;
  if ([r?.authorize, r?.authorizeOriginal, r?.authorizeOperation, r?.authorizeDraft, r?.keyForDraft, deps.scheduler?.start, deps.authorizeStart]
    .some(v => typeof v !== 'function')) throw unavailable();
  let closed = false, active = 0; const children = new Set<{ close(): void }>();
  return {
    scope,
    async start(raw, revalidate) {
      const input = intentDevelopmentStartInputSchema.parse(raw);
      if (closed || active >= 4 || typeof revalidate !== 'function' || (['organizationId', 'productId', 'repository'] as const).some(k => input[k] !== scope[k])) throw unavailable();
      active++;
      let finished = false, settled = false, pending = 0, released = false, timer: ReturnType<typeof setTimeout> | undefined;
      const owned: { close(): void }[] = [], target = freeze({ operationId: input.operationId, inputDigest: input.inputDigest });
      const release = () => { if (settled && !pending && !released) { released = true; active--; } };
      const guard = () => { if (finished || closed) throw unavailable(); };
      const track = async <T>(work: Promise<T>) => { pending++; try { return await work; } finally { pending--; release(); } };
      const current = async () => { guard(); if (await track(Promise.resolve().then(revalidate)) !== undefined) throw unavailable(); guard(); };
      const checked = async <T>(work: () => Promise<T>) => { await current(); const value = await track(Promise.resolve().then(work)); await current(); return value; };
      const authority = createReadPolicyAuthority(current, track, guard);
      const sourceScope = r.scopeReview; let scopeReader = sourceScope, validating = false;
      const secured: Records = {
        ...(sourceScope ? { scopeReview: { scope: sourceScope.scope, read: (input, current) => scopeReader!.read(input, current) } } : {}),
        authorize: c => authority(c.action, () => r.authorize(c)),
        authorizeOriginal: bracketCurrentReadAuthority(current, async (c: Parameters<Records['authorizeOriginal']>[0]) => {
          if (c.action !== 'read') throw unavailable(); return r.authorizeOriginal(c);
        }, track, guard),
        authorizeDraft: c => authority(c.action, () => r.authorizeDraft(c)),
        authorizeOperation: async c => { if (hash(c.request) !== hash(target)) throw unavailable(); await authority('read', () => r.authorizeOperation(c)); },
        keyForDraft: (ref, keyId) => { if (keyId === null) throw unavailable(); return checked(() => r.keyForDraft(ref, keyId)); },
      };
      const scopedPools = { drafts: { connect: () => { guard(); return track(pools.drafts.connect()); } },
        execution: { connect: () => { guard(); return track(pools.execution.connect()); } } };
      const own = <T extends { close(): void }>(store: T) => { owned.push(store); children.add(store); return store; };
      const work = Promise.resolve().then(async () => {
        await current(); const originals = own(createDevelopmentOriginalStore(scopedPools, config, secured));
        const read = async () => {
          const found = await originals.read(target); guard(); const s = found.original.source;
          if (found.operationExpired || found.latestDraftRevision !== input.revision || s.draftId !== input.draftId
            || s.revision !== input.revision || s.revisionDigest !== input.revisionDigest) throw unavailable();
          return found.original;
        };
        const original = await read();
        const operations = own(createIntentOperationStore(scopedPools.execution, original.configuration, {
          authorize: secured.authorizeOperation, verifyCheckpoint: async () => { throw unavailable(); },
        }));
        const authorize = async () => {
          if (validating) throw unavailable(); validating = true;
          try { await withCurrentScopeReadWindow(sourceScope, current, async reader => {
            scopeReader = reader;
            await current(); if (hash(await read()) !== hash(original)) throw unavailable();
            if (await checked(() => deps.authorizeStart(original)) !== undefined) throw unavailable();
            // Recheck source and SQL operation after the external authorization wait.
            if (hash(await read()) !== hash(original)) throw unavailable();
            const op = await operations.inspect(target); guard();
            if (op.outcome !== 'ok' || op.value.operation.draftId !== input.draftId || op.value.operation.draftRevision !== input.revision) throw unavailable();
            if (hash(await read()) !== hash(original)) throw unavailable();
            await current();
          }); } finally { scopeReader = sourceScope; validating = false; }
        };
        await authorize();
        const receipt = developmentScheduleReceiptSchema.parse(await track(deps.scheduler.start(freeze({ organizationId: scope.organizationId,
          ...target, expiresAt: original.configuration.expiresAt }), authorize)));
        // A lost permission after dispatch conceals the ACK but never undoes or
        // restarts that workflow. The existing read query is separate authority.
        await authorize();
        return freeze(intentDevelopmentStartOutputSchema.parse({ ...input, kind: 'steer-development-start/v1', receipt,
          savedToGit: false, gateSigned: false, documentsReady: false, retryAuthorized: false }));
      });
      void work.finally(() => { settled = true; release(); }).catch(() => {});
      try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 30000); })]); }
      catch { throw unavailable(); }
      finally { finished = true; if (timer) clearTimeout(timer); for (const child of owned) { child.close(); children.delete(child); } }
    },
    close() { closed = true; children.forEach(child => child.close()); },
  } satisfies IntentDevelopmentStarter & { close(): void };
}
