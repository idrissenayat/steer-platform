// Trusted synthetic execution hooks, never user-supplied callbacks or provider credentials.
import { readFileSync } from 'node:fs';
import { createLifecycleEventVerifier } from '../0059/lifecycle-events.candidate.mjs';
import { inspectPrivacyPhoneText } from '../../packages/domain/src/privacy-phone.ts';
import { makeLifecycleEventBytes, mutateLifecycleEventBytes } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { lifecycleEventDecision as legacyEvents, detectIdentifiers as legacyDetector } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { recoveryHumanExecutionHook } from '../0099/execution-hooks.mjs';
import { authorizationMoneyPrivacyExecutionHook } from '../0100/execution-hooks.mjs';
import { detectorMultilineExecutionHook } from '../0101/execution-hooks.mjs';
import { trustDomainExecutionHook } from '../0102/execution-hooks.mjs';
import { schemaExecutionHook } from '../0103/execution-hooks.mjs';
import { sharedActionExecutionHook } from '../0105/execution-hooks.mjs';
import { migrationGraphExecutionHook } from '../0106/execution-hooks.mjs';
import { lifecycleGraphExecutionHook } from '../0107/execution-hooks.mjs';
import { lifecycleNegativeExecutionHook } from '../0108/execution-hooks.mjs';
import { specialLifecycleExecutionHook } from '../0109/execution-hooks.mjs';
import { shortRetentionExecutionHook } from '../0110/execution-hooks.mjs';
import { longRetentionExecutionHook } from '../0111/execution-hooks.mjs';
import { lifecycleReadinessExecutionHook } from '../0112/execution-hooks.mjs';
import { immutableRetentionExecutionHook } from '../0113/execution-hooks.mjs';
const registry = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const events = createLifecycleEventVerifier(registry), now = '2026-09-04T13:00:00Z';
const eventEnvelope = (eventBytes, historyBytes = []) => jcs({ version: 'steer-r5-001-events/v1', policyDigest: events.policyDigest,
  scope: { organization: 'steer-platform', itemId: '0001-flight-deck-foundation', environmentId: null }, eventBytes, historyBytes, evaluationTime: now });
const eventHook = (run) => ({ executor: 'intent/0059/lifecycle-events.candidate.mjs#createLifecycleEventVerifier',
  scope: 'complete selected original-registry event/history audit with explicit clock; not lifecycle disposition', run });
export function executionHook(caseItem) {
  if (caseItem.family === 'LIFECYCLE') return eventHook((check) => {
    const bytes = eventEnvelope(makeLifecycleEventBytes(caseItem.coordinate.type, 1));
    check(bytes, () => events.verify(bytes, now), { state: 'validated-trigger', verifiedHistoryCount: 0 });
  });
  if (caseItem.family === 'LIFECYCLE-NEGATIVE') return eventHook((check) => {
    const base = makeLifecycleEventBytes('record-committed', 1), positive = eventEnvelope(base);
    check(positive, () => events.verify(positive, now), { state: 'validated-trigger' });
    const bytes = eventEnvelope(mutateLifecycleEventBytes(base, caseItem.coordinate.kind));
    check(bytes, () => events.verify(bytes, now), { state: 'blocked-policy-conflict' });
  });
  if (caseItem.family === 'PRIVACY-DETECTOR' && caseItem.coordinate.class === 'phone') return {
    executor: 'packages/domain/src/privacy-phone.ts#inspectPrivacyPhoneText', scope: 'pure phone classification only, not full corpus acceptance', run(check) {
      const text = caseItem.coordinate.text;
      check(text, () => ({ hit: inspectPrivacyPhoneText(text) === 'phone' }), { hit: caseItem.coordinate.expectedHit });
    } };
  if (caseItem.id === 'R5:PREFLIGHT-R3-R5-001:reproduction:2') return eventHook((check) => {
    const prior = makeLifecycleEventBytes('record-committed', 1), current = makeLifecycleEventBytes('record-committed', 2);
    const positive = eventEnvelope(current, [prior]); check(positive, () => events.verify(positive, now), { state: 'validated-trigger', verifiedHistoryCount: 1 });
    const bad = mutateLifecycleEventBytes(prior, 'bad-provider-proof');
    // Baseline reproduction is separate and never credits another required ID.
    check(jcs([current, bad]), () => legacyEvents(current, jcs([bad])), { state: 'validated-trigger' });
    const bytes = eventEnvelope(current, [bad]); check(bytes, () => events.verify(bytes, now), { state: 'blocked-policy-conflict' });
  });
  if (caseItem.id === 'R5:PREFLIGHT-R3-R5-005:reproduction:1') return {
    executor: 'packages/domain/src/privacy-phone.ts#inspectPrivacyPhoneText', scope: 'documented Unicode detector reproduction and required boundaries, not full corpus/time evidence', run(check) {
      for (const text of ['+٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨', '٠٠٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨']) {
        check(text, () => ({ legacyHit: legacyDetector(text).includes('phone') }), { legacyHit: false });
        check(text, () => ({ hit: inspectPrivacyPhoneText(text) === 'phone' }), { hit: true });
      }
      for (const text of ['+४४ २० ७९४६ ०९५८', '००४४ २० ७९४६ ०९५८', '+44 20 7946 0958', '0044 20 7946 0958'])
        check(text, () => ({ hit: inspectPrivacyPhoneText(text) === 'phone' }), { hit: true });
      for (const digit of ['٤', '४']) for (const count of [6, 7, 15, 16]) {
        const text = '+' + digit.repeat(count); check(text, () => ({ hit: inspectPrivacyPhoneText(text) === 'phone' }), { hit: count === 7 || count === 15 });
      }
      for (const text of ['A+' + '٤'.repeat(7), '+' + '٤'.repeat(7) + 'Z', '界+' + '४'.repeat(7), '+' + '४'.repeat(7) + '界'])
        check(text, () => ({ hit: inspectPrivacyPhoneText(text) === 'phone' }), { hit: false });
    } };
  return recoveryHumanExecutionHook(caseItem) ?? authorizationMoneyPrivacyExecutionHook(caseItem) ?? detectorMultilineExecutionHook(caseItem) ?? trustDomainExecutionHook(caseItem) ?? schemaExecutionHook(caseItem) ?? sharedActionExecutionHook(caseItem) ?? migrationGraphExecutionHook(caseItem) ?? lifecycleGraphExecutionHook(caseItem) ?? lifecycleNegativeExecutionHook(caseItem) ?? specialLifecycleExecutionHook(caseItem) ?? shortRetentionExecutionHook(caseItem) ?? longRetentionExecutionHook(caseItem) ?? lifecycleReadinessExecutionHook(caseItem) ?? immutableRetentionExecutionHook(caseItem);
}
