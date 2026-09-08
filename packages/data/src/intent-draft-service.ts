import { intentDraftCreateInputSchema, intentDraftAppendInputSchema, intentDraftReadInputSchema,
  type IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { createDraftLifecycleStore } from './draft-lifecycle.ts';
import { createDraftRevisionStore, draftRecordsConfigurationSchema } from './draft-revisions.ts';

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
  let closed = false, running = 0;
  const children = new Set<{ close(): void }>();
  const guard = () => { if (closed) throw new Error('Draft service unavailable.'); };
  const fixed = (input: { organizationId: string; productId: string; repository: string }) => {
    guard(); for (const key of ['organizationId', 'productId', 'repository'] as const) if (input[key] !== config[key]) throw new Error('Draft service unavailable.');
  };
  async function run<T>(revalidate: () => Promise<void>, work: (stores: {
    lifecycle: ReturnType<typeof createDraftLifecycleStore>; revisions: ReturnType<typeof createDraftRevisionStore>;
  }) => Promise<T>): Promise<T> {
    guard(); if (running >= 4 || typeof revalidate !== 'function') throw new Error('Draft service unavailable.'); running++;
    let finished = false, timer: ReturnType<typeof setTimeout> | undefined;
    const current = async () => { guard(); if (finished || await revalidate() !== undefined || finished) throw new Error(); guard(); };
    const lifecycle = createDraftLifecycleStore(pool, config, { authorize: async context => {
      await current(); if (await dependencies.lifecycle.authorize(context) !== undefined) throw new Error(); await current();
    } });
    const revisions = createDraftRevisionStore(pool, config, {
      authorize: async context => { await current(); if (await dependencies.revisions.authorize(context) !== undefined) throw new Error(); await current(); },
      keyForDraft: async (reference, keyId) => { await current(); const key = await dependencies.revisions.keyForDraft(reference, keyId); await current(); return key; },
    });
    children.add(lifecycle); children.add(revisions);
    const pending = Promise.resolve().then(async () => { await current(); const output = await work({ lifecycle, revisions }); await current(); return output; });
    void pending.finally(() => { running--; }).catch(() => {});
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
  return {
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
      });
    },
    close() { closed = true; for (const child of children) child.close(); },
  } satisfies IntentDraftService & { close(): void };
}
