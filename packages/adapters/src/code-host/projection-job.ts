import { z } from 'zod';
import { principalSchema, artifactProjectionInputSchema, type Principal } from '@steer/tool-registry';
import { briefDestinationScopeSchema, briefSaveReferenceSchema, briefSaveOutputSchema } from '@steer/tool-registry/brief-contracts';
import { artifactSelectionSchema, type ArtifactReader, type RepositoryReader } from './github.ts';
import { reconcileArtifacts, reconcileRepository, reconcileRecordedBrief, type SnapshotProjectionSink, type ProjectionOutcome } from './reconcile.ts';

type ProjectionDependencies = {
  authenticate: () => Promise<unknown>;
  sink: (current: () => Promise<Principal>) => SnapshotProjectionSink<ProjectionOutcome>;
  shutdownResources: () => Promise<void>;
};

const selectorSchema = z.strictObject({ paths: z.array(artifactProjectionInputSchema.shape.path).min(1).max(100).optional(),
  selection: artifactSelectionSchema.optional(),
}).refine((value) => Boolean(value.paths) !== Boolean(value.selection));

/** Shared authorized job lifecycle, independent of SQL, HTTP and Temporal. */
export function createProjectionJob(reader: RepositoryReader, rawSelector: unknown, dependencies: ProjectionDependencies) {
  const parsed = selectorSchema.safeParse(rawSelector);
  if (!parsed.success || (parsed.data.paths && new Set(parsed.data.paths).size !== parsed.data.paths.length)) throw new Error('Invalid projection selector.');
  const selector = parsed.data;
  return createAuthorizedProjectionJob(reader.binding.organizationId, dependencies, (current, signal) => {
    const sink = dependencies.sink(current);
    return selector.selection ? reconcileRepository(reader, selector.selection, sink, signal) : reconcileArtifacts(reader, selector.paths!, sink, signal);
  });
}

/** One owned readback job, not a public receipt submission API or a scheduler.
 * readReceipt must be prebound to authenticated store readback; parsing its output
 * cannot establish human provenance. The projector never impersonates that human. */
export function createRecordedBriefProjectionJob(reader: ArtifactReader, rawScope: unknown,
  dependencies: ProjectionDependencies & { readReceipt: () => Promise<unknown>; expectedReference?: unknown }) {
  const scope = briefDestinationScopeSchema.parse(rawScope);
  const reference = dependencies.expectedReference === undefined ? undefined : briefSaveReferenceSchema.parse(dependencies.expectedReference);
  if (reference && (reference.organizationId !== scope.organizationId || reference.repository !== scope.repository ||
      reference.branch !== scope.branch || scope.paths.length !== 1 || reference.path !== scope.paths[0])) throw new Error('Invalid recorded operation binding.');
  const binding = Object.freeze({ ...reader.binding });
  if (scope.organizationId !== binding.organizationId || scope.repository !== `github:${binding.repositoryId}` ||
      scope.branch !== binding.branch) throw new Error('Invalid recorded projection scope.');
  const pinnedReader: ArtifactReader = { binding, readHead: () => reader.readHead(), readArtifact: (path, revision) => reader.readArtifact(path, revision) };
  return createAuthorizedProjectionJob(scope.organizationId, dependencies, async (current, signal) => {
    const observation = briefSaveOutputSchema.parse(await dependencies.readReceipt());
    await current();
    if (reference && (Object.keys(reference) as (keyof typeof reference)[]).some(key => observation.result[key] !== reference[key])) {
      throw new Error('Recorded operation changed.');
    }
    const sink = dependencies.sink(current);
    return reconcileRecordedBrief(pinnedReader, scope, observation, {
      currentRevision: async (...args) => { await current(); return sink.currentRevision(...args); },
      ingest: async (...args) => { await current(); return sink.ingest(...args); },
    }, signal);
  });
}

/** Shared single-flight admission and owned draining shutdown for both job kinds. */
function createAuthorizedProjectionJob<T>(organizationId: string, dependencies: ProjectionDependencies,
  execute: (current: () => Promise<Principal>, signal: AbortSignal) => Promise<T>) {
  let stopping = false, active: Promise<T> | undefined, closing: Promise<void> | undefined;
  let controller: AbortController | undefined;
  const authorize = async () => {
    try {
      const principal = principalSchema.parse(await dependencies.authenticate());
      if (principal.type !== 'agent' || principal.hats.length || principal.organizationId !== organizationId ||
        !principal.toolGrants.includes('projection.ingest') || Date.parse(principal.expiresAt) <= Date.now()) throw new Error();
      return principal;
    } catch { throw new Error('Projection identity is not authorized.'); }
  };
  return {
    runOnce() {
      if (stopping || active) return Promise.reject(new Error('Projection runtime is not accepting work.'));
      controller = new AbortController(); const signal = controller.signal;
      active = (async () => {
        const checkAbort = () => { if (signal.aborted) throw new Error('Projection work was interrupted.'); };
        const identity = await authorize(); checkAbort();
        const current = async () => {
          checkAbort(); const next = await authorize(); checkAbort();
          if (next.subject !== identity.subject) throw new Error('Projection identity changed.'); return next;
        };
        const result = await execute(current, signal);
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
