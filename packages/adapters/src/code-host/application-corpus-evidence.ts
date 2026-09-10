import { createHash } from 'node:crypto';
import { intentEvidenceInputSchema, buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';
import { createIntentCorpusEvidence, type IntentCorpusAuthority } from './intent-corpus-evidence.ts';
import type { CorpusRepositoryReader } from './github.ts';
import { createCorpusReadGraph } from './corpus-read-graph.ts';
import { hasCorpusArtifactBatch } from './corpus-artifact-batch.ts';

const scopeSchema = intentEvidenceInputSchema.pick({ organizationId: true, productId: true, repository: true, branch: true });
const inputSchema = scopeSchema.extend({ scopeInputDigest: intentEvidenceInputSchema.shape.scopeInputDigest });
const configurationSchema = scopeSchema.extend({ retrievalConfigurationRevision: intentEvidenceInputSchema.shape.permissionsRevision.max(100) });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const fail = () => new Error('Current intent corpus could not be verified; this does not establish new intent.');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
type Collection = Awaited<ReturnType<ReturnType<typeof createIntentCorpusEvidence>['collect']>>;

/** Existing application contract, selected only by native constructor identity.
 * Unknown adapters retain compatibility. A native failure never triggers fallback.
 * The caller is trusted read-only service composition, not an HTTP callback. */
export function createApplicationIntentCorpusEvidence(reader: CorpusRepositoryReader, raw: unknown, authority: IntentCorpusAuthority) {
  if (!hasCorpusArtifactBatch(reader)) {
    const legacy = createIntentCorpusEvidence(reader, raw, authority);
    return { ...legacy, shutdown: async () => { legacy.close(); } };
  }
  const configuration = freeze(configurationSchema.parse(raw)), { retrievalConfigurationRevision, ...scope } = configuration;
  const graph = createCorpusReadGraph(reader, scope, authority);
  const lifetime = new AbortController(), active = new Set<Promise<unknown>>();
  let closed = false;
  const ports = [reader.readHead, reader.readScopeInventory, reader.readArtifact, authority.authorize, authority.select, authority.authorizeSource];
  const binding = hash(reader.binding);
  async function withReadSession<T>(rawInput: unknown, revalidate: () => Promise<void>, work: (read: () => Promise<Collection>) => Promise<T>): Promise<T> {
    const input = freeze(inputSchema.parse(rawInput));
    if (closed || active.size >= 4 || typeof revalidate !== 'function' || typeof work !== 'function'
      || Object.entries(scope).some(([key, value]) => input[key as keyof typeof scope] !== value)) throw fail();
    let ended = false, consumerEnded = false, reading = false, invalid = false, used = false, last = performance.now();
    const deadline = last + 30000, pending = new Set<Promise<unknown>>();
    const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(30000)]);
    const guard = () => {
      const now = performance.now();
      if (closed || signal.aborted || ended || invalid || !Number.isFinite(now) || now < last || now >= deadline || hash(reader.binding) !== binding
        || [reader.readHead, reader.readScopeInventory, reader.readArtifact, authority.authorize, authority.select, authority.authorizeSource]
          .some((port, i) => port !== ports[i])) { invalid = true; throw fail(); }
      last = now;
    };
    const current = async () => { guard(); if (await revalidate() !== undefined) { invalid = true; throw fail(); } guard(); };
    let resolveEvidence!: (value: Collection) => void, rejectEvidence!: (error: Error) => void;
    let evidence: Promise<Collection> | undefined, graphWork: Promise<void> | undefined, graphDrain: Promise<void> | undefined, consumer!: Promise<T>;
    const begin = () => {
      evidence = new Promise<Collection>((resolve, reject) => { resolveEvidence = resolve; rejectEvidence = reject; });
      // The graph starts only at the first actual evidence read. A service's
      // preceding draft/policy validation therefore cannot cause source prefetch.
      const owned = graph.startCurrentReadSet(current, async snapshot => {
        guard();
        const context = snapshot.contexts[0];
        if (snapshot.contexts.length !== 1 || !context || context.revision !== snapshot.observedHead) throw fail();
        const inventory = context.semantic.map(file => ({ sourceId: `source:${digest(file.path)}`,
          targetId: file.path.split('/').slice(0, 2).join('/'), path: file.path, status: file.status,
          contentDigest: file.contentDigest, blobOid: file.blobSha }));
        const inputEvidence = intentEvidenceInputSchema.parse({ ...scope, head: context.revision, scopeInputDigest: input.scopeInputDigest,
          permissionsRevision: snapshot.permissionsRevision,
          retrievalConfigurationRevision: `${retrievalConfigurationRevision}:${hash(context.selections.map(s => s.value))}`,
          inventoryComplete: context.coverage.unresolvedCount === 0 && context.coverage.sourceGapCount === 0 && !context.coverage.readLimitReached,
          accessGapCount: context.coverage.accessGapCount, inventory,
          documents: context.semantic.slice(0, 50).map(file => ({ sourceId: `source:${digest(file.path)}`, content: file.content })) });
        const value: Collection = freeze({ evidence: inputEvidence, envelope: await buildIntentEvidenceEnvelope(inputEvidence),
          coverage: { scope: 'configured-repository-intent-and-items', ...context.coverage },
          authoritativeClearance: false, semanticReviewComplete: false });
        guard(); resolveEvidence(value);
        // The callback owns the entire dependent service phase. Its completion
        // alone is not publication: the graph subsequently closes every grant.
        await consumer; guard(); await current();
      }, signal);
      graphDrain = owned.drained; void graphDrain.catch(() => {});
      graphWork = owned.result.catch(() => { invalid = true; rejectEvidence(fail()); throw fail(); });
      void graphWork.catch(() => {});
    };
    const read = (): Promise<Collection> => {
      if (consumerEnded || reading || invalid || ended) { invalid = true; return Promise.reject(fail()); }
      reading = true;
      const task = Promise.resolve().then(async () => {
        await current(); if (!evidence) begin();
        const value = await evidence!; await current(); used = true; return value;
      }).catch(() => { invalid = true; throw fail(); });
      pending.add(task); void task.finally(() => { reading = false; pending.delete(task); }).catch(() => {});
      return task;
    };
    consumer = Promise.resolve().then(async () => {
      try {
        await current(); const result = await work(read); guard();
        if (!used || pending.size) { invalid = true; throw fail(); }
        await current(); return result;
      } catch { invalid = true; throw fail(); }
      finally { consumerEnded = true; }
    });
    const running = Promise.resolve().then(async () => {
      try {
        const result = await consumer; if (!graphWork) throw fail();
        await graphWork; guard(); return result;
      } finally {
        await Promise.allSettled([...pending, ...(graphWork ? [graphWork] : []), ...(graphDrain ? [graphDrain] : [])]);
      }
    });
    active.add(running); void running.finally(() => active.delete(running)).catch(() => {});
    let abort = () => {};
    try {
      return await Promise.race([running, new Promise<never>((_, reject) => {
        abort = () => reject(fail()); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
      })]);
    } catch { throw fail(); }
    finally { ended = true; signal.removeEventListener('abort', abort); }
  }
  return { scope: freeze(scope), withReadSession,
    collect: (input: unknown, current: () => Promise<void>) => withReadSession(input, current, read => read()),
    close() { closed = true; lifetime.abort(); graph.close(); },
    async shutdown() { closed = true; lifetime.abort(); graph.close(); await Promise.allSettled([...active]); await graph.shutdown(); },
  };
}
