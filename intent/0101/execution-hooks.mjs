import { detectIdentifiers, costDecision as legacyCost } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { inspectPrivacyPhoneText } from '../../packages/domain/src/privacy-phone.ts';
import { correctedCostDecision } from '../0057/cost-correction.candidate.mjs';
import { multilineCostExecutionCase } from './execution-fixtures.mjs';
export function detectorMultilineExecutionHook(required) {
  if (required.family === 'PRIVACY-IDENTIFIER' || required.family === 'PRIVACY-DETECTOR' && required.coordinate.class !== 'phone') {
    const phone = required.coordinate.class === 'phone';
    return { executor: phone ? 'packages/domain/src/privacy-phone.ts#inspectPrivacyPhoneText' : 'intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs#detectIdentifiers',
      scope: phone ? 'corrected pure phone classification on the exact declared identifier text; not full corpus acceptance' :
        'unchanged non-phone classifier retained inside the corrected privacy graph; exact declared class/text only, not new detector behavior or full corpus/time acceptance', run(check) {
        const { text, class: category } = required.coordinate;
        check(text, () => ({ hit: phone ? inspectPrivacyPhoneText(text) === 'phone' : detectIdentifiers(text).includes(category) }),
          { hit: required.family === 'PRIVACY-IDENTIFIER' ? true : required.coordinate.expectedHit });
      } };
  }
  if (required.id === 'R5:PREFLIGHT-R3-R5-004:reproduction:1') return {
    executor: 'intent/0063/privacy-cost-time.candidate.mjs#createPrivacyCostTimeVerifier',
    scope: 'two-line R5-004 reproduction, all three missing-pair variants and 32 orderings with complete independent-time evidence; not all cost line bounds or live billing', run(check) {
      const base = multilineCostExecutionCase('positive'), valid = { decision: 'ALLOW', reconciledLineCount: 2,
        aggregateNanoUsd: '9800000', roundedCents: '1', timedRecordCount: 14, observedAsOfCount: 3 };
      check(base.positiveBytes, () => base.verifier.verify(base.positiveBytes), valid);
      // Historical counterexample only; does not add a corrected required ID.
      check(base.legacyBytes, () => legacyCost(base.legacyBytes), { decision: 'ALLOW', aggregateNanoUsd: '9800000', roundedCents: '1' });
      for (const kind of ['missing-variance', 'missing-successor', 'missing-both']) {
        const value = multilineCostExecutionCase(kind);
        check(value.correctionBytes, () => correctedCostDecision(value.correctionBytes), { decision: 'DENY', firstError: 'LINEAGE_MULTIPLICITY_INVALID' });
        check(value.bytes, () => value.verifier.verify(value.bytes), { decision: 'DENY', firstError: 'TIME_EVIDENCE_INVALID' });
      }
      for (let permutation = 0; permutation < 32; permutation++) {
        const value = multilineCostExecutionCase('positive', permutation);
        check(value.bytes, () => value.verifier.verify(value.bytes), valid);
      }
    } };
  return null;
}
