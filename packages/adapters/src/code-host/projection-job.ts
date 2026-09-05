import { z } from 'zod';
import { principalSchema, artifactProjectionInputSchema, type Principal } from '@steer/tool-registry';
import { artifactSelectionSchema, type RepositoryReader } from './github.ts';
import { reconcileArtifacts, reconcileRepository, type SnapshotProjectionSink, type ProjectionOutcome } from './reconcile.ts';

const selectorSchema = z.strictObject({ paths: z.array(artifactProjectionInputSchema.shape.path).min(1).max(100).optional(),
  selection: artifactSelectionSchema.optional(),
}).refine((value) => Boolean(value.paths) !== Boolean(value.selection));

/** Shared authorized job lifecycle, independent of SQL, HTTP and Temporal. */
export function createProjectionJob(reader: RepositoryReader, rawSelector: unknown, dependencies: {
  authenticate: () => Promise<unknown>;
  sink: (current: () => Promise<Principal>) => SnapshotProjectionSink<ProjectionOutcome>;
  shutdownResources: () => Promise<void>;
}) {
  const parsed = selectorSchema.safeParse(rawSelector);
  if (!parsed.success || (parsed.data.paths && new Set(parsed.data.paths).size !== parsed.data.paths.length)) throw new Error('Invalid projection selector.');
  const selector = parsed.data;
  let stopping = false, active: Promise<Awaited<ReturnType<typeof reconcileArtifacts>>> | undefined, closing: Promise<void> | undefined;
  let controller: AbortController | undefined;
  const authorize = async () => {
    try {
      const principal = principalSchema.parse(await dependencies.authenticate());
      if (principal.type !== 'agent' || principal.hats.length || principal.organizationId !== reader.binding.organizationId ||
        !principal.toolGrants.includes('projection.ingest') || Date.parse(principal.expiresAt) <= Date.now()) throw new Error();
      return principal;
    } catch { throw new Error('Projection identity is not authorized.'); }
  };
  return {
    runOnce() {
      if (stopping || active) return Promise.reject(new Error('Projection runtime is not accepting work.'));
      controller = new AbortController(); const signal = controller.signal;
      active = (async () => {
        const identity = await authorize();
        const current = async () => {
          const next = await authorize(); if (next.subject !== identity.subject) throw new Error('Projection identity changed.'); return next;
        };
        const sink = dependencies.sink(current);
        const result = selector.selection ? await reconcileRepository(reader, selector.selection, sink, signal) : await reconcileArtifacts(reader, selector.paths!, sink, signal);
        await current(); return result;
      })().finally(() => { active = undefined; controller = undefined; });
      return active;
    },
    shutdown() {
      if (!closing) {
        stopping = true; controller?.abort(); const pending = active;
        closing = (async () => {
          try { await pending; } catch { /* The run caller receives its outcome. */ }
          try { await dependencies.shutdownResources(); } catch { throw new Error('Projection resource shutdown failed.'); }
        })();
      }
      return closing;
    },
    status: () => ({ stopping, active: Boolean(active) }),
  };
}
