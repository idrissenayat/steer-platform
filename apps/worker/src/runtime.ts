import { z } from 'zod';
import type { RepositoryReader } from '@steer/adapters/github';
import { createProjectionJob } from '@steer/adapters/projection-job';
import { createRuntimePool } from '@steer/data/runtime-pool';
import { readProjection } from '@steer/data';
import { ingestVerifiedArtifact, projectionKey } from '@steer/data/ingestion';
import { parseScope, type ReconciliationScope } from './contracts.ts';
import { createReconciliationActivities } from './activities.ts';

const databaseSchema = z.strictObject({ host: z.string(), port: z.number(), database: z.string(),
  transport: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('tls'), ca: z.string() }),
    z.strictObject({ kind: z.literal('isolated-loopback-test') })]),
});

/** Explicit production data composition; reader/authenticator are trusted prebound adapters, never workflow inputs. */
export async function createWorkerProjectionRuntime(options: { scope: ReconciliationScope; database: unknown; selector: unknown },
  secrets: { databasePassword: string }, dependencies: { reader: RepositoryReader; authenticate: () => Promise<unknown> }) {
  let pool: ReturnType<typeof createRuntimePool> | undefined;
  try {
    const scope = parseScope(options.scope); const database = databaseSchema.parse(options.database);
    if (scope.organizationId !== dependencies.reader.binding.organizationId || scope.repository !== `github:${dependencies.reader.binding.repositoryId}`) throw new Error();
    const owned = createRuntimePool({ ...database, user: 'steer_projector', password: secrets.databasePassword }); pool = owned;
    const job = createProjectionJob(dependencies.reader, options.selector, {
      authenticate: dependencies.authenticate, shutdownResources: () => owned.shutdown(), sink: (current) => ({
        currentRevision: async (repository, path) => (await readProjection(owned, await current(), projectionKey(repository, path)))?.sourceRevision ?? null,
        ingest: async (snapshot, expected) => ingestVerifiedArtifact(owned, await current(), snapshot, expected),
      }),
    });
    // Expose only the fixed-scope activity entry, never an unscoped runOnce to the worker.
    return { activities: createReconciliationActivities(scope, job), shutdown: job.shutdown,
      status: () => ({ ...job.status(), database: owned.status() }) };
  } catch {
    try { await pool?.shutdown(); } catch { throw new Error('Worker projection cleanup could not be confirmed.'); }
    throw new Error('Worker projection configuration could not be initialized.');
  }
}
