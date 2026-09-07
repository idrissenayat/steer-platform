import { z } from 'zod';
import type { RepositoryReader, ArtifactReader } from '@steer/adapters/github';
import { createProjectionJob, createRecordedBriefProjectionJob } from '@steer/adapters/projection-job';
import { createGitGateObserver } from '@steer/adapters/gate-observation';
import { createRuntimePool } from '@steer/data/runtime-pool';
import { readProjection } from '@steer/data';
import { ingestVerifiedArtifact, projectionKey } from '@steer/data/ingestion';
import { parseScope, parseGateTarget, parseRecordedBriefTarget, type ReconciliationScope } from './contracts.ts';
import { createReconciliationActivities, createGateWatchActivities, createRecordedBriefActivities } from './activities.ts';
import { createRecordedBriefRecoveryActivities } from './activities.ts';
import { parseRecordedBriefRecoveryPlan, recordedBriefRecoveryWorkflowId } from './contracts.ts';

const databaseSchema = z.strictObject({ host: z.string(), port: z.number(), database: z.string(),
  transport: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('tls'), ca: z.string() }),
    z.strictObject({ kind: z.literal('isolated-loopback-test') })]),
});

/** Recovery reuses exact receipt/SQL reconciliation. Failed-parent guard must be a separately
 * owned trusted adapter; no caller-selected authority, automatic admission or reset. */
export async function createWorkerRecordedBriefRecoveryRuntime(rawOptions: unknown, rawSecrets: unknown,
  dependencies: Parameters<typeof createWorkerRecordedBriefRuntime>[2] & { parent: { plan: unknown; verify(): Promise<void> } }) {
  let owned: Awaited<ReturnType<typeof createWorkerRecordedBriefRuntime>> | undefined;
  try {
    const options = z.strictObject({ plan: z.unknown(), database: databaseSchema,
      source: z.strictObject({ branch: z.string(), path: z.string(), subject: z.string() }) }).parse(rawOptions);
    const plan = parseRecordedBriefRecoveryPlan(options.plan), expected = recordedBriefRecoveryWorkflowId(plan);
    const parent = dependencies.parent, verify = parent.verify.bind(parent);
    const bound = () => { if (recordedBriefRecoveryWorkflowId(parent.plan) !== expected) throw new Error(); };
    bound();
    owned = await createWorkerRecordedBriefRuntime({ target: plan.target, database: options.database, source: options.source }, rawSecrets, {
      reader: dependencies.reader, readReceipt: dependencies.readReceipt,
      authenticate: async () => { bound(); await verify(); bound(); const principal = await dependencies.authenticate(); bound(); await verify(); bound(); return principal; },
    });
    const runtime = owned;
    return { activities: createRecordedBriefRecoveryActivities(plan, { runOnce: () => runtime.activities.projectRecordedBrief(plan.target) }),
      shutdown: runtime.shutdown, status: runtime.status };
  } catch {
    try { await owned?.shutdown(); } catch { throw new Error('Recorded Brief recovery cleanup could not be confirmed.'); }
    throw new Error('Recorded Brief recovery runtime could not be initialized.');
  }
}

/** Exact operation binding and current receipt callback stay outside serialized workflow history.
 * Callback owner must establish readback provenance; this composition never signs or saves. */
export async function createWorkerRecordedBriefRuntime(rawOptions: unknown, rawSecrets: unknown,
  dependencies: { reader: ArtifactReader; authenticate: () => Promise<unknown>; readReceipt: () => Promise<unknown> }) {
  let pool: ReturnType<typeof createRuntimePool> | undefined;
  try {
    const options = z.strictObject({ target: z.unknown(), database: databaseSchema,
      source: z.strictObject({ branch: z.string(), path: z.string(), subject: z.string() }) }).parse(rawOptions);
    const target = parseRecordedBriefTarget(options.target);
    const secrets = z.strictObject({ databasePassword: z.string().min(1) }).parse(rawSecrets);
    const reference = { organizationId: target.scope.organizationId, repository: target.scope.repository,
      ...options.source, idempotencyKey: target.idempotencyKey };
    if (reference.path !== `${target.scope.itemId}/BRIEF.md`) throw new Error();
    const owned = createRuntimePool({ ...options.database, user: 'steer_projector', password: secrets.databasePassword }); pool = owned;
    const job = createRecordedBriefProjectionJob(dependencies.reader,
      { organizationId: reference.organizationId, repository: reference.repository, branch: reference.branch, paths: [reference.path] }, {
        authenticate: dependencies.authenticate, readReceipt: dependencies.readReceipt, expectedReference: reference,
        shutdownResources: () => owned.shutdown(), sink: current => ({
          currentRevision: async (repository, path) => (await readProjection(owned, await current(), projectionKey(repository, path)))?.sourceRevision ?? null,
          ingest: async (snapshot, expected) => ingestVerifiedArtifact(owned, await current(), snapshot, expected),
        }),
      });
    return { activities: createRecordedBriefActivities(target, job), shutdown: job.shutdown,
      status: () => ({ ...job.status(), database: owned.status() }) };
  } catch {
    try { await pool?.shutdown(); } catch { throw new Error('Recorded Brief worker cleanup could not be confirmed.'); }
    throw new Error('Recorded Brief worker configuration could not be initialized.');
  }
}

/** Read-only Git observation composition; no database, signer, public endpoint or live binding. */
export function createWorkerGateObservationRuntime(rawTarget: unknown, source: { artifactPaths: string[]; recordPath: string; recordItem: string },
  dependencies: { reader: RepositoryReader; authenticate: () => Promise<unknown> }) {
  try {
    const target = parseGateTarget(rawTarget);
    const selected = z.strictObject({ artifactPaths: z.array(z.string()), recordPath: z.string(), recordItem: z.string() }).parse(source);
    const observer = createGitGateObserver(dependencies.reader, { ...target, ...selected }, dependencies.authenticate);
    return { activities: createGateWatchActivities(target, observer), shutdown: observer.shutdown, status: observer.status };
  } catch { throw new Error('Worker gate source configuration could not be initialized.'); }
}

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
