// Offline executable model composition. Never executes SQL, provider calls or journals.
import { readFileSync } from 'node:fs';
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createMigrationTimeVerifier, policyDigest as migrationPolicyDigest } from '../0090/migration-time.candidate.mjs';
import { createDualColumnModel } from './dual-column.candidate.mjs';
export const modelDigest = sha256(readFileSync(new URL('./dual-column.candidate.mjs', import.meta.url), 'utf8'));
const supportedVersions = [
  { schemaFrom: 'schema-v1', schemaTo: 'schema-v2', oldAppVersion: 'app-v1', newAppVersion: 'app-v2' },
  { schemaFrom: 'schema-v2', schemaTo: 'schema-v3', oldAppVersion: 'app-v2', newAppVersion: 'app-v3' },
];
export const manifestBytes = jcs({ version: 'steer-migration-model-manifest/v1', modelDigest, supportedVersions,
  model: 'both clients use the explicit dual-column compatibility shim; version labels name model coordinates, not production binaries' });
export const policyDigest = sha256(jcs({ version: 'steer-migration-compatibility/v1', migrationPolicyDigest, modelDigest,
  manifestDigest: sha256(manifestBytes),
  cases: 'every row in both signed states; all 24 old/new read/write permutations; both competing-snapshot winner orders, stale loser, retry and exact/key-drift replay',
  boundary: 'synthetic dual-column shim; no live application/database compatibility or execution authority' }));
const ensure = (value) => { if (!value) throw new Error('MIGRATION_COMPATIBILITY_INVALID'); };
const permutations = (values) => values.length === 0 ? [[]] : values.flatMap((value, index) => permutations(values.filter((_, position) => position !== index)).map((tail) => [value, ...tail]));
const orders = permutations(['old-read', 'old-write', 'new-read', 'new-write']);
const byteBound = (value, maximum) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maximum;
export function createMigrationCompatibilityVerifier(contextBytes) {
  let context, migration;
  try {
    ensure(byteBound(contextBytes, 32768)); context = parseCanonical(contextBytes);
    ensure(exactKeys(context, ['version', 'modelDigest', 'migrationConfigBytes', 'sourceColumn', 'targetColumn']) &&
      context.version === 'steer-migration-compatibility-context/v1' && context.modelDigest === modelDigest && hex(context.modelDigest, 64));
    // Independently selected migration configuration carries approved plan and before pins.
    migration = createMigrationTimeVerifier(context.migrationConfigBytes);
    createDualColumnModel(jcs({ schemaVersion: 'shape-check', columns: [context.sourceColumn, context.targetColumn].sort(),
      rows: [{ rowId: 'shape-check', values: { [context.sourceColumn]: null, [context.targetColumn]: null } }] }), context.sourceColumn, context.targetColumn);
  } catch { throw new Error('MIGRATION_COMPATIBILITY_CONFIGURATION_INVALID'); }
  const configDigest = sha256(contextBytes);
  return Object.freeze({ configDigest, policyDigest,
    verify(serialized, evaluationTime) {
      try {
        ensure(byteBound(serialized, 16777216)); const envelope = parseCanonical(serialized);
        ensure(exactKeys(envelope, ['version', 'configDigest', 'policyDigest', 'graphBytes']) && envelope.version === 'steer-migration-compatibility/v1' &&
          envelope.configDigest === configDigest && envelope.policyDigest === policyDigest);
        const verified = migration.verify(envelope.graphBytes, evaluationTime);
        ensure(['validated-migration-candidate', 'validated-safe-non-result', 'replay-noop'].includes(verified.state));
        const graph = parseCanonical(envelope.graphBytes), definition = parseCanonical(graph.planBytes).definition;
        ensure(supportedVersions.some((version) => Object.entries(version).every(([field, value]) => definition[field] === value)));
        const { sourceColumn, targetColumn } = context;
        const operation = definition.phase === 'expand' ? { kind: 'add-column', column: targetColumn, defaultValue: null } :
          definition.phase === 'backfill' ? { kind: 'copy-column', sourceColumn, targetColumn } : { kind: 'drop-column', column: sourceColumn };
        ensure(jcs(definition.dataOperations) === jcs([operation]));
        const traces = []; let originalLogicalRows;
        for (const [position, truthBytes] of [['before', graph.beforeTruthBytes], ['after', graph.afterTruthBytes]]) {
          const dataBytes = parseCanonical(truthBytes).dataBytes, initial = parseCanonical(dataBytes);
          const initialModel = createDualColumnModel(dataBytes, sourceColumn, targetColumn);
          const logicalRows = jcs(initial.rows.map(({ rowId }) => ({ rowId, value: initialModel.originalValue(rowId) })));
          if (position === 'before') originalLogicalRows = logicalRows;
          else ensure(logicalRows === originalLogicalRows);
          for (const { rowId } of initial.rows) {
            const otherRows = jcs(initial.rows.filter((row) => row.rowId !== rowId));
            const check = (model, expected, revision) => {
              for (const client of ['old', 'new']) ensure(jcs(model.read(client, rowId)) === jcs({ value: expected, revision }));
              const snapshot = parseCanonical(model.snapshot());
              ensure(jcs(snapshot.rows.filter((row) => row.rowId !== rowId)) === otherRows && jcs(snapshot.columns) === jcs(initial.columns) && snapshot.schemaVersion === initial.schemaVersion);
              const original = initial.rows.find((row) => row.rowId === rowId), current = snapshot.rows.find((row) => row.rowId === rowId);
              for (const key of initial.columns.filter((key) => ![sourceColumn, targetColumn].includes(key))) ensure(current.values[key] === original.values[key]);
            };
            for (const order of orders) {
              const model = createDualColumnModel(dataBytes, sourceColumn, targetColumn), observations = [];
              let expected = model.originalValue(rowId), revision = 0;
              check(model, expected, revision);
              for (const step of order) {
                const [client, action] = step.split('-');
                if (action === 'read') observations.push({ step, ...model.read(client, rowId) });
                else {
                  expected = client === 'old' ? 'old-client-write' : 'new-client-write';
                  const result = model.write(client, rowId, expected, revision, step); revision++;
                  ensure(jcs(result) === jcs({ status: 'committed', revision })); observations.push({ step, ...result });
                }
                check(model, expected, revision);
              }
              traces.push({ position, rowId, order, observations, finalStateDigest: sha256(model.snapshot()) });
            }
            for (const clients of [['old', 'new'], ['new', 'old']]) {
              const model = createDualColumnModel(dataBytes, sourceColumn, targetColumn), [winner, loser] = clients;
              const snapshots = clients.map((client) => model.read(client, rowId)), observations = [];
              ensure(snapshots.every((record) => record.revision === 0));
              observations.push(model.write(winner, rowId, 'winner', snapshots[0].revision, 'winner-command'));
              const committedBytes = model.snapshot();
              observations.push(model.write(loser, rowId, 'loser', snapshots[1].revision, 'loser-command'));
              ensure(observations[0].status === 'committed' && observations[1].status === 'rejected-stale-revision' && model.snapshot() === committedBytes);
              check(model, 'winner', 1);
              observations.push(model.write(winner, rowId, 'winner', 0, 'winner-command'));
              observations.push(model.write(winner, rowId, 'different', 0, 'winner-command'));
              ensure(observations[2].status === 'replay-noop' && observations[3].status === 'rejected-key-conflict' && model.snapshot() === committedBytes);
              observations.push(model.write(loser, rowId, 'retry', 1, 'retry-command'));
              ensure(observations[4].status === 'committed'); check(model, 'retry', 2);
              traces.push({ position, rowId, competingSnapshots: clients, observations, finalStateDigest: sha256(model.snapshot()) });
            }
          }
        }
        return { state: 'verified-migration-model-compatibility', firstError: null, executionAuthorized: false, factOnly: true, effects: zeroEffects(), journalEffects: 0,
          configDigest, policyDigest, modelDigest, graphDigest: sha256(envelope.graphBytes), migrationEvidenceDigest: verified.evidenceDigest,
          caseCount: traces.length, traceDigest: sha256(jcs(traces)), supportedClients: [definition.oldAppVersion, definition.newAppVersion], liveCompatibilityVerified: false };
      } catch { return { state: 'blocked', firstError: 'MIGRATION_COMPATIBILITY_INVALID', executionAuthorized: false, effects: zeroEffects(), journalEffects: 0 }; }
    },
  });
}
