import { migrationGraphExecutionCase, migrationGraphVariants } from './execution-fixtures.mjs';
import { makeMigrationEvidence } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { migrationDecision as legacyMigration } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
export function migrationGraphExecutionHook(required) {
  if (required.id !== 'R5:PREFLIGHT-R3-R5-003:reproduction:1') return null;
  return { executor: 'intent/0062/migration-graph.candidate.mjs#createStagedMigrationGraphVerifier',
    scope: 'full staged v3 graph with exact-time, shared action, actual before/after/backup bytes and contract human composition; frozen target-free boolean-winner baseline is separate; not the 3600-case compatibility matrix or a real database/store',
    run(check) {
      const legacy = makeMigrationEvidence();
      check(jcs({ legacyModelOnly: true, bytes: legacy }), () => {
        const graph = JSON.parse(legacy), result = legacyMigration(legacy);
        return { state: result.state, hypotheticalLegacyEffects: result.effects, hypotheticalJournalEffects: result.journalEffects,
          casWinner: graph.casWinner, missing: ['targetExamRevision', 'targetExamDigest', 'implementationRevision', 'authorizationPolicyBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes'].filter((key) => !Object.hasOwn(graph, key)) };
      }, { state: 'journaled', hypotheticalLegacyEffects: { ...zeroEffects(), migration: 1 }, hypotheticalJournalEffects: 1, casWinner: true,
        missing: ['targetExamRevision', 'targetExamDigest', 'implementationRevision', 'authorizationPolicyBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes'] });
      for (const phase of ['expand', 'backfill', 'contract']) {
        for (const variant of migrationGraphVariants(phase)) {
          const value = migrationGraphExecutionCase(phase, variant), positive = ['positive', 'replay', 'before-effect', 'after-effect', 'rollback'].includes(variant);
          const expected = positive ? {
            state: variant === 'replay' ? 'replay-noop' : variant === 'before-effect' ? 'validated-safe-non-result' : 'validated-migration-candidate', firstError: null,
            action: `migration.${phase}`, observedEffectCount: variant === 'before-effect' ? 0 : 1,
            configDigest: sha256(value.configBytes), policyDigest: value.verifier.policyDigest,
            evidenceDigest: sha256(jcs(['beforeProofBytes', 'afterProofBytes', 'journalBytes', 'resultBytes'].map((field) => JSON.parse(value.graph[field]).recordDigest))),
          } : { state: 'blocked', firstError: 'MIGRATION_GRAPH_INVALID' };
          check(value.input, () => value.verifier.verify(value.bytes, value.evaluationTime), { ...expected, journalEffects: 0, executionAuthorized: false });
          if (variant === 'positive') check(jcs({ configBytes: value.configBytes, bytes: legacy, evaluatedAt: value.evaluationTime }),
            () => value.verifier.verify(legacy, value.evaluationTime), { state: 'blocked', firstError: 'MIGRATION_GRAPH_INVALID', journalEffects: 0, executionAuthorized: false });
        }
      }
    } };
}
