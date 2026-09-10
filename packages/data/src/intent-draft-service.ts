import { intentDraftCreateInputSchema, intentDraftAppendInputSchema, intentDraftReadInputSchema,
  type IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { createDraftLifecycleStore } from './draft-lifecycle.ts';
import { createDraftRevisionStore, draftRecordsConfigurationSchema } from './draft-revisions.ts';
import { createReadPolicyAuthority } from './read-policy-authority.ts';
import { registerDraftReadSession, withDraftReadSession } from './draft-read-session.ts';

/** Explicit, uninstalled owner-bound API service. No key/grant/env fallback and
 * no adoption of records policy from a request or tool grant. Each request owns
 * stores; concurrent edits use SQL CAS rather than shared mutable browser state.
 */
export function createIntentDraftService(pool: Parameters<typeof createDraftRevisionStore>[0], rawConfiguration: unknown, dependencies: {
  lifecycle: Parameters<typeof createDraftLifecycleStore>[2]; revisions: Parameters<typeof createDraftRevisionStore>[2];
}) {
  const config = Object.freeze(draftRecordsConfigurationSchema.parse(rawConfiguration));
  if ([dependencies.lifecycle?.authorize, dependencies.revisions?.authorize, dependencies.revisions?.keyForDraft].some(v => typeof v !== 'function')) throw new Error('Draft service unavailable.');
  const scope = Object.freeze({ organizationId: config.organizationId, subject: config.subject, productId: config.productId, repository: config.repository });
  let closed = false, running = 0, phases = 0;
  const children = new Set<{ close(): void }>();
  const guard = () => { if (closed) throw new Error('Draft service unavailable.'); };
  const fixed = (input: { organizationId: string; productId: string; repository: string }) => {
    guard(); for (const key of ['organizationId', 'productId', 'repository'] as const) if (input[key] !== config[key]) throw new Error('Draft service unavailable.');
  };
  async function run<T>(revalidate: () => Promise<void>, work: (stores: {
    lifecycle: ReturnType<typeof createDraftLifecycleStore>; revisions: ReturnType<typeof createDraftRevisionStore>; check(): void;
  }) => Promise<T>, readOnly = false, phase = false): Promise<T> {
    guard(); if ((phase ? phases : running) >= 4 || typeof revalidate !== 'function') throw new Error('Draft service unavailable.');
    if (phase) phases++; else running++;
    let finished = false, settled = false, inFlight = 0, released = false, timer: ReturnType<typeof setTimeout> | undefined;
    const release = () => { if (settled && !inFlight && !released) { released = true; if (phase) phases--; else running--; } };
    const live = () => { guard(); if (finished) throw new Error('Draft service unavailable.'); };
    const track = async <V>(task: Promise<V>): Promise<V> => { inFlight++; try { return await task; } finally { inFlight--; release(); } };
    const invoke = <V,>(call: () => Promise<V>) => track(Promise.resolve().then(() => { live(); return call(); }));
    const current = async () => { live(); if (await invoke(revalidate) !== undefined) throw new Error(); live(); };
    const readAuthority = createReadPolicyAuthority(current, track, live);
    const lifecycle = createDraftLifecycleStore(pool, config, { authorize: async context => {
      if (readOnly) throw new Error('Draft service unavailable.');
      await current(); if (await invoke(() => dependencies.lifecycle.authorize(context)) !== undefined) throw new Error(); await current();
    } });
    const revisions = createDraftRevisionStore(pool, config, {
      authorize: async context => {
        if (readOnly) return readAuthority(context.action, () => dependencies.revisions.authorize(context));
        await current(); if (await invoke(() => dependencies.revisions.authorize(context)) !== undefined) throw new Error(); await current();
      },
      keyForDraft: async (reference, keyId) => {
        if (readOnly && keyId === null) throw new Error('Draft service unavailable.');
        await current(); const key = await invoke(() => dependencies.revisions.keyForDraft(reference, keyId)); await current(); return key;
      },
    });
    children.add(lifecycle); children.add(revisions);
    const pending = Promise.resolve().then(async () => { await current(); const output = await work({ lifecycle, revisions, check: live }); await current(); return output; });
    void pending.finally(() => { settled = true; release(); }).catch(() => {});
    try {
      return await Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error()), 30000); })]);
    } catch { throw new Error('Draft service unavailable.'); }
    finally { finished = true; if (timer) clearTimeout(timer); lifecycle.close(); revisions.close(); children.delete(lifecycle); children.delete(revisions); }
  }
  const reference = (raw: Awaited<ReturnType<ReturnType<typeof createDraftRevisionStore>['read']>>['reference'], latestRevision: number) => {
    if (raw.organizationId !== config.organizationId || raw.subject !== config.subject || raw.productId !== config.productId) throw new Error();
    return { draftId: raw.draftId, revision: raw.revision, revisionDigest: raw.revisionDigest, sourceRevision: raw.sourceRevision,
      scopeInputDigest: raw.scopeInputDigest, latestRevision, savedToGit: false as const };
  };
  const service = {
    scope,
    async create(raw, revalidate) {
      const input = intentDraftCreateInputSchema.parse(raw); fixed(input);
      try { return await run(revalidate, async ({ lifecycle }) => {
        const result = await lifecycle.create({ requestId: input.requestId });
        if (result.outcome !== 'ok') return { outcome: result.outcome, savedToGit: false };
        const value = result.value;
        if (value.held || value.expired || value.discardedAt || value.publishedAt) return { outcome: 'unavailable' as const, savedToGit: false };
        return { outcome: 'created' as const, requestId: input.requestId, draftId: value.draftId, createdAt: value.createdAt,
          useUntil: value.useUntil, retentionDeadline: value.retentionDeadline, contentPreserved: false as const, savedToGit: false as const };
      }); } catch { return { outcome: 'unknown' as const, savedToGit: false as const }; }
    },
    async append(raw, revalidate) {
      const input = intentDraftAppendInputSchema.parse(raw); fixed(input);
      try { return await run(revalidate, async ({ revisions }) => {
        const { draftId, mutationId, expectedRevision, expectedDigest, content } = input;
        const result = await revisions.append({ draftId, mutationId, expectedRevision, expectedDigest, content });
        if (result.outcome !== 'acknowledged') return { outcome: result.outcome, savedToGit: false as const };
        return { outcome: 'acknowledged' as const, mutationId: result.reference.mutationId, ...reference(result.reference, result.latestRevision) };
      }); } catch { return { outcome: 'unknown' as const, savedToGit: false as const }; }
    },
    async read(raw, revalidate) {
      const input = intentDraftReadInputSchema.parse(raw); fixed(input);
      return run(revalidate, async ({ revisions }) => {
        const result = await revisions.read({ draftId: input.draftId, revision: input.revision });
        return { ...reference(result.reference, result.latestRevision), content: result.content };
      }, true);
    },
    close() { closed = true; for (const child of children) child.close(); },
  } satisfies IntentDraftService & { close(): void };
  // Private read phases have their own four-slot bound. An enclosing review must
  // not occupy the public draft-call slots needed by its dependent readers.
  // Both categories share closure, tracked drainage and the same bounded pool.
  registerDraftReadSession(service.read, scope, async (raw, revalidate, work) => {
    const input = intentDraftReadInputSchema.parse(raw); fixed(input);
    const ports = [dependencies.revisions.authorize, dependencies.revisions.keyForDraft,
      dependencies.lifecycle.authorize, pool.connect, service.read, service.close];
    const checkPorts = () => {
      guard(); if ([dependencies.revisions.authorize, dependencies.revisions.keyForDraft,
        dependencies.lifecycle.authorize, pool.connect, service.read, service.close].some((p, i) => p !== ports[i])) throw new Error('Draft service unavailable.');
    };
    const present = async () => { checkPorts(); if (await revalidate() !== undefined) throw new Error('Draft service unavailable.'); checkPorts(); };
    await run(present, async ({ revisions, check }) => {
      type Snapshot = Awaited<ReturnType<typeof revisions.read>>;
      // This exact run owns entry/final caller checks, a fresh caller after every
      // metadata permission, and both caller edges of each key lookup. The inner
      // primitive needs owner/port guards, not another identical caller barrier.
      // Ordinary/independent native consumers still provide their full caller.
      await withDraftReadSession<Snapshot>({ scope: config, read: revisions.read }, { draftId: input.draftId, revision: input.revision }, async () => { check(); checkPorts(); },
        async read => { await work(async () => { const result = await read(); return { ...reference(result.reference, result.latestRevision), content: result.content }; }); });
    }, true, true);
  });
  return service;
}
