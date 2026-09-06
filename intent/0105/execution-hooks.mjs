import { readFileSync } from 'node:fs';
import { manifestBytes } from '../0060/protected-actions.candidate.mjs';
import { makeAuthorizationBundle } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { authorizationDecision } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { sharedActionVariants, sharedActionExecutionCase, legacyUnlistedActionCase } from './execution-fixtures.mjs';
const groups = {
  'R5:PREFLIGHT-R3-R5-001:reproduction:3': ['lifecycle.delete-copy', 'lifecycle.crypto-erase', 'lifecycle.commit-tombstone'],
  'R5:PREFLIGHT-R3-R5-003:reproduction:2': ['migration.expand', 'migration.backfill', 'migration.contract'],
};
export function sharedActionExecutionHook(required) {
  const actions = groups[required.id]; if (!actions) return null;
  return { executor: 'intent/0060/protected-actions.candidate.mjs#createProtectedActionVerifier',
    scope: 'complete 0060 shared-action proof stack for the three exact omitted actions, including installed selectors and replay/CAS; legacy omission reproduced separately; not full lifecycle/migration graph execution or permission to act',
    run(check) {
      const baseline = makeAuthorizationBundle();
      // The frozen oracle is a pure model whose ALLOW describes hypothetical effects.
      // Preserve and assert those counters under an explicit legacy label, not real effects.
      check(jcs({ legacyModelOnly: true, bundle: baseline }), () => {
        const result = authorizationDecision(baseline); return { decision: result.decision, hypotheticalLegacyEffects: result.effects };
      }, { decision: 'ALLOW', hypotheticalLegacyEffects: { credentialAccess: 1, installationToken: 1, providerRequest: 1, gitWrite: 1,
        lifecycle: 0, migration: 0, gate: 0, release: 0, paidResource: 0 } });
      const legacyManifestBytes = readFileSync(new URL('../0001/reviews/domain/round-3/remediation/PERMISSIONS-MANIFEST.candidate.json', import.meta.url), 'utf8');
      check(jcs({ legacyManifestBytes, manifestBytes, actions }), () => ({
        legacy: JSON.parse(legacyManifestBytes).actions.map((row) => row.action),
        corrected: JSON.parse(manifestBytes).actions.filter((row) => actions.includes(row.action)).map((row) => row.action),
      }), { legacy: ['github.exam.candidate.commit'], corrected: actions });
      for (const action of actions) {
        const old = legacyUnlistedActionCase(action);
        check(jcs(old), () => authorizationDecision(old), { decision: 'DENY', firstError: 'ACTION_UNLISTED' });
        // Every action starts with its own complete positive; all variants invoke the same verifier.
        for (const variant of sharedActionVariants(action)) {
          const value = sharedActionExecutionCase(action, variant), positive = ['positive', 'replay'].includes(variant);
          check(value.input, () => value.verifier.verify(value.bytes, value.evaluatedAt), positive ? {
            decision: variant === 'replay' ? 'REPLAY_NOOP' : 'AUTHORIZED_CANDIDATE', firstError: null, action,
            requestDigest: value.records.request.recordDigest, resourcesDigest: sha256(jcs(JSON.parse(value.installedContextBytes).grants[0].resources)),
            evaluatedAt: value.evaluatedAt, resultDigest: variant === 'replay' ? 'd'.repeat(64) : null,
          } : { decision: 'DENY', firstError: 'PROTECTED_ACTION_INVALID' });
        }
      }
    } };
}
