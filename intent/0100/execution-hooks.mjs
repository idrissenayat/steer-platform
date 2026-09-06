import { authorizationExecutionCase, spendExecutionCase, costExecutionCase, privacyExecutionCase } from './execution-fixtures.mjs';
import { expectedAuthorizationRecordIds } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { checkedAdd, checkedMultiply, jcs } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const acceptedCosts = ['forecast-allow', 'invoice-at-close', 'invoice-after-close', 'invoice-two-lines-reordered', 'reconcile-at-24h', 'subcent-aggregate-before-round'];
const costPositive = (kind, plural) => ({ decision: plural ? 'ALLOW' : 'VERIFIED', ...(plural ? { reconciledLineCount: 1 } : { recordedDecision: 'ALLOW', executionAuthorized: false }),
  ...({ 'forecast-allow': { aggregateNanoUsd: '4900000', roundedCents: '0', timedRecordCount: 5, observedAsOfCount: 2 },
    'invoice-two-lines-reordered': { aggregateNanoUsd: '9800000', roundedCents: '1', timedRecordCount: 10, observedAsOfCount: 3 },
    'subcent-aggregate-before-round': { aggregateNanoUsd: '14700000', roundedCents: '1', timedRecordCount: 7, observedAsOfCount: 4 },
    'reconcile-at-24h': { aggregateNanoUsd: '4900000', roundedCents: '0', timedRecordCount: 9, observedAsOfCount: 2 } }[kind]) });
export function authorizationMoneyPrivacyExecutionHook(required) {
  const kind = required.coordinate?.kind;
  if (required.family === 'AUTHORIZATION') return { executor: 'intent/0066/authorization-time.candidate.mjs#createAuthorizationTimeVerifier',
    scope: 'complete ten-record original authorization audit and independent observation; not the separate 0060 lifecycle/migration shared-action contract or a write capability', run(check) {
      const value = authorizationExecutionCase(kind), valid = { decision: 'VERIFIED', recordedDecision: 'ALLOW', timedRecordCount: 10, observedAsOfCount: 1,
        consumedRecordIds: expectedAuthorizationRecordIds, executionAuthorized: false };
      check(value.positiveBytes, () => value.verifier.verify(value.positiveBytes), valid);
      check(value.bytes, () => value.verifier.verify(value.bytes), ['positive', 'retry'].includes(kind) ? { ...valid, recordedDecision: kind === 'retry' ? 'REPLAY_NOOP' : 'ALLOW' } :
        { decision: 'DENY', firstError: 'AUTHORIZATION_TIME_INVALID', executionAuthorized: false });
    } };
  if (required.family === 'SPEND') return { executor: 'intent/0064/money-time.candidate.mjs#createMoneyTimeVerifier',
    scope: 'complete original spend evidence, native/current store timing and independent observation; verification never authorizes spending', run(check) {
      const value = spendExecutionCase(kind), valid = { decision: 'VERIFIED', recordedDecision: 'ALLOW', timedRecordCount: 8, observedAsOfCount: 0, executionAuthorized: false };
      check(value.positiveBytes, () => value.positiveVerifier.verify(value.positiveBytes), valid);
      check(value.bytes, () => value.verifier.verify(value.bytes), ['positive', 'replay'].includes(kind) ? { ...valid, recordedDecision: kind === 'replay' ? 'REPLAY_NOOP' : 'ALLOW' } :
        { decision: 'DENY', firstError: 'MONEY_TIME_INVALID', executionAuthorized: false });
    } };
  if (required.family === 'COST') {
    const plural = ['reconcile-before-invoice', 'reconcile-at-24h', 'reconcile-after-24h', 'predecessor-gap', 'predecessor-fork', 'provider-unavailable-late'].includes(kind);
    return { executor: plural ? 'intent/0063/privacy-cost-time.candidate.mjs#createPrivacyCostTimeVerifier' : 'intent/0064/money-time.candidate.mjs#createMoneyTimeVerifier',
      scope: plural ? 'exact original scalar lineage lifted byte-for-byte into plural arrays and complete timed observation; one-line cases do not prove multi-line reconciliation' :
        'complete original forecast/invoice/aggregate observation; overflow additionally executes exact declared arithmetic operands; no purchase or production billing', run(check) {
        const value = costExecutionCase(kind);
        check(value.positiveBytes, () => value.positiveVerifier.verify(value.positiveBytes), costPositive(value.positiveKind, value.plural));
        if (kind.startsWith('overflow-')) {
          const fn = kind === 'overflow-add' ? checkedAdd : checkedMultiply, operands = ['9000000000000000000', kind === 'overflow-add' ? '1' : '2'];
          check(jcs(operands), () => { try { return { value: fn(...operands).toString() }; } catch (error) { return { error: error.message }; } }, { error: 'NANOUSD_OVERFLOW' });
        }
        const expected = acceptedCosts.includes(kind) ? { decision: value.plural ? 'ALLOW' : 'VERIFIED', ...(value.plural ? { reconciledLineCount: 1 } : { recordedDecision: 'ALLOW', executionAuthorized: false }),
          aggregateNanoUsd: kind === 'subcent-aggregate-before-round' ? '14700000' : kind === 'invoice-two-lines-reordered' ? '9800000' : '4900000',
          roundedCents: ['subcent-aggregate-before-round', 'invoice-two-lines-reordered'].includes(kind) ? '1' : '0' } :
          { decision: 'DENY', firstError: value.plural ? 'TIME_EVIDENCE_INVALID' : 'MONEY_TIME_INVALID', ...(value.plural ? {} : { executionAuthorized: false }) };
        check(value.bytes, () => value.verifier.verify(value.bytes), expected);
      } };
  }
  if (required.family === 'PRIVACY-GRAPH') return { executor: 'intent/0063/privacy-cost-time.candidate.mjs#createPrivacyCostTimeVerifier',
    scope: '0063 complete original-registry privacy graph with independent ten-record observation and native/current time; not production corpus or later trust eras', run(check) {
      const value = privacyExecutionCase(kind), valid = { decision: 'ACCEPT', timedRecordCount: 10, observedAsOfCount: 6 };
      check(value.positiveBytes, () => value.verifier.verify(value.positiveBytes), valid);
      check(value.bytes, () => value.verifier.verify(value.bytes), kind === 'positive' ? valid : { decision: 'DENY', firstError: 'TIME_EVIDENCE_INVALID' });
    } };
  return null;
}
