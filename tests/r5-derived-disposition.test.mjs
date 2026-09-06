import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as fixtures from '../intent/0117/execution-fixtures.mjs';
import { createDerivedDispositionVerifier, policyDigest } from '../intent/0117/derived-disposition.candidate.mjs';
import { correctedLifecycleEventDecision, correctionPolicyDigest } from '../intent/0059/lifecycle-events.candidate.mjs';
import { jcs, sha256, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const make = fixtures.derivedDispositionExecutionCase;
const limits = r => { for (const f of ['executionAuthorized', 'deletionVerified', 'liveProviderUsed', 'futureArchiveVerified']) assert.equal(r[f], false); assert.deepEqual(r.effects, zeroEffects()); };
const deny = (v, bytes = v.bytes, time = v.evaluationTime) => { const r = v.verifier.verify(bytes, time); assert.equal(r.state, 'blocked'); assert.equal(r.fullChildEvidenceVerified, false); limits(r); };

test('0117: actual full child graphs and named receipt bytes yield bounded original-era facts only', () => {
  for (const variant of ['positive', 'replay']) {
    const v = make(variant), r = v.verifier.verify(v.bytes, v.evaluationTime);
    assert.equal(r.state, 'verified-derived-disposition-evidence'); assert.equal(r.factOnly, true); assert.equal(r.fullChildEvidenceVerified, true); limits(r);
    assert.equal(r.verifiedChildCount, 2); assert.equal(r.verifiedCopyCount, 4); assert.equal(r.policyDigest, policyDigest); assert.equal(r.configDigest, sha256(v.configBytes));
    assert.equal(r.inputDigest, sha256(jcs({ bytes: v.bytes, evaluatedAt: v.evaluationTime })));
    assert.deepEqual(r.requires, ['verified-parent-manifest-and-history', 'fresh-future-archive-revalidation', 'complete-parent-disposition-authority']);
    for (const c of v.full) { const full = c.verifier.verify(c.bytes, c.evaluationTime); assert.equal(full.state, 'validated-lifecycle-candidate'); assert.equal(full.copyCount, 2); assert.equal(full.protectedActionCount, 3); assert.equal(full.replayCount, variant === 'replay' ? 3 : 0); }
  }
});

test('0117: digest-only, omitted, partial, substituted and wrong-copy evidence cannot stand in for full child disposition', () => {
  for (const variant of ['missing-receipt', 'digest-only', 'missing-child-proof', 'partial-child-proof', 'wrong-copy', 'borrowed-receipt']) deny(make(variant));
});

test('0117: correctly signed but wrong parent, class, clock source or chronology fails composition', () => {
  for (const variant of ['wrong-parent', 'wrong-child-class', 'early-event', 'wrong-event-source']) {
    const v = make(variant);
    for (const child of v.envelope.children) assert.equal(correctedLifecycleEventDecision(jcs({ version: 'steer-r5-001-events/v1', policyDigest: correctionPolicyDigest,
      scope: v.config.scope, eventBytes: child.eventBytes, historyBytes: [], evaluationTime: v.evaluationTime })).state, 'validated-trigger');
    deny(v);
  }
});

test('0117: individually valid children cannot share physical objects or one-use credentials', () => {
  for (const variant of ['shared-objects', 'shared-credentials']) {
    const v = make(variant); for (const c of v.full) assert.equal(c.verifier.verify(c.bytes, c.evaluationTime).state, 'validated-lifecycle-candidate'); deny(v);
  }
});

test('0117: trusted context is closed, sorted, bounded, class-specific and original-scope only', () => {
  const v = make();
  for (const mutate of [c => { c.extra = true; }, c => { c.children = []; }, c => { c.children.reverse(); }, c => { c.children.push(c.children[0]); },
    c => { c.children[0].recordClass = 'RC-CORPUS-PROVENANCE'; }, c => { c.children[0].recordId = c.parent.recordId; }, c => { c.scope.organization = 'other'; },
    c => { c.children[0].graphBytesDigest = 'x'; }, c => { c.observedAt = 'invalid'; }, c => { c.children = Array(129).fill(c.children[0]); }]) {
    const c = structuredClone(v.config); mutate(c); assert.throws(() => createDerivedDispositionVerifier(jcs(c)), /CONFIGURATION_INVALID/);
  }
  for (const bytes of [null, '[]', ' '.repeat(131073), 'é'.repeat(65537)]) assert.throws(() => createDerivedDispositionVerifier(bytes), /CONFIGURATION_INVALID/);
});

test('0117: envelope pins, child ordering, proof bytes and explicit observation time are mandatory', () => {
  const v = make(); for (const variant of ['swapped-children', 'extra-field']) deny(make(variant));
  for (const mutate of [e => { e.configDigest = '0'.repeat(64); }, e => { e.policyDigest = '0'.repeat(64); }, e => { e.children.pop(); },
    e => { e.children[0].receiptBytes += ' '; }, e => { e.children[0].configBytes += ' '; }, e => { e.children[0].graphBytes += ' '; },
    e => { e.children[0].eventBytes = '{}'; }, e => { e.children[0].extra = true; }]) {
    const e = structuredClone(v.envelope); mutate(e); deny(v, jcs(e));
  }
  for (const clock of [undefined, 'invalid', '2026-09-04T12:00:01Z', '2033-09-04T12:00:02Z']) {
    const r = v.verifier.verify(v.bytes, clock); assert.equal(r.state, 'blocked'); limits(r);
  }
  for (const bytes of [null, '{}', ' '.repeat(16777217), 'é'.repeat(8388609)]) deny(v, bytes);
});

test('0117: fixture API is closed and never exposes a signing or mutation function', () => {
  assert.deepEqual(Object.keys(fixtures), ['derivedDispositionExecutionCase']); assert.throws(() => make('unknown'), /UNKNOWN_DERIVED_DISPOSITION_CASE/);
  assert.deepEqual(make().bytes, make().bytes);
});

test('0117: prerequisite work adds no ledger credit and preserves every previous mapped observation', () => {
  const report = runCorrectedCoverage(), prior = JSON.parse(readFileSync(new URL('../intent/0116/QUICK-EXECUTION-REPORT.json', import.meta.url))), current = new Map(report.executions.map(r => [r.id, r]));
  for (const old of prior.executions) for (const field of ['observationsDigest', 'observationCount', 'status']) assert.equal(current.get(old.id)[field], old[field], `${old.id}:${field}`);
  assert.equal(report.executed, 393); assert.equal(report.passed, 393); assert.equal(report.failed, 0); assert.equal(report.uncovered, 3643);
  assert.deepEqual(report.families['LIFECYCLE-GRAPH'], { required: 64, executed: 52, passed: 52, failed: 0, uncovered: 12 });
  for (const flag of ['completeCoverage', 'normativeAcceptanceComplete', 'independentAcceptance', 'executionAuthorized', 'liveProviderUsed']) assert.equal(report[flag], false);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../intent/0120/QUICK-EXECUTION-REPORT.json', import.meta.url))), report);
});
