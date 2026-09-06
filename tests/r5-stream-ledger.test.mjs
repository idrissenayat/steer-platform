import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeWithStreamSeal } from '../intent/0104/stream-seal.mjs';
import { sameRunPrerequisites } from '../intent/0104/execution-prerequisites.mjs';
import { accessibilityExecutionHook } from '../intent/0104/execution-hooks.mjs';
import { executionHook } from '../intent/0098/execution-hooks.mjs';
import { runCorrectedCoverage, runCoverageForCompletion } from '../intent/0098/execution-ledger.mjs';
import { loadRequiredCases } from '../intent/0098/required-cases.mjs';
import { jcs, sha256 } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

test('0104: actual stream sealing retains UTF-8 bytes, unambiguous row boundaries and a separate legacy row digest', () => {
  const rows = ['{"value":"é"}', '{"value":"second"}'], value = consumeWithStreamSeal(rows, (input) => [...input]);
  assert.deepEqual(value.result, rows); assert.equal(value.stream.count, 2);
  assert.equal(value.stream.bytes, rows.reduce((sum, row) => sum + Buffer.byteLength(row), 0));
  assert.equal(value.stream.rowsDigest, sha256(rows.join('\n') + '\n')); assert.equal(value.stream.exhausted, true); assert.equal(value.stream.closed, true);
  const first = consumeWithStreamSeal(['a\nb', 'c'], (input) => [...input]).stream, second = consumeWithStreamSeal(['a', 'b\nc'], (input) => [...input]).stream;
  assert.equal(first.rowsDigest, second.rowsDigest); assert.notEqual(first.digest, second.digest, 'Length framing prevents ambiguous negative-input transcripts.');
  assert.deepEqual(consumeWithStreamSeal(rows, (input) => [...input]), value);
});

test('0104: early rejection seals only consumed rows and closes the iterator without reading the tail', () => {
  let yielded = 0, closed = false;
  function* source() { try { yielded++; yield 'first'; yielded++; yield 'second'; } finally { closed = true; } }
  const value = consumeWithStreamSeal(source(), (rows) => rows.next().value);
  assert.equal(value.result, 'first'); assert.equal(value.stream.count, 1); assert.equal(value.stream.rowsDigest, sha256('first\n'));
  assert.equal(value.stream.exhausted, false); assert.equal(value.stream.closed, true); assert.equal(yielded, 1); assert.equal(closed, true);
  const empty = consumeWithStreamSeal(source(), () => 'metadata denied'); assert.equal(empty.stream.count, 0); assert.equal(empty.stream.exhausted, false);
});

test('0104: consumer, non-byte row, cleanup and bounded stream failures cannot produce successful evidence', () => {
  let closed = false;
  function* source() { try { yield 'one'; } finally { closed = true; } }
  assert.throws(() => consumeWithStreamSeal(source(), (rows) => { rows.next(); throw new Error('CONSUMER_FAILED'); }), /CONSUMER_FAILED/); assert.equal(closed, true);
  assert.throws(() => consumeWithStreamSeal([null], (rows) => [...rows]), /STREAM_ROW_NOT_BYTES/);
  const broken = { [Symbol.iterator]() { return { next: () => ({ done: true }), return: () => { throw new Error('CLOSE_FAILED'); } }; } };
  assert.throws(() => consumeWithStreamSeal(broken, (rows) => [...rows]), /CLOSE_FAILED/);
  assert.throws(() => consumeWithStreamSeal(Array(32902).fill('x'), (rows) => [...rows]), /STREAM_SEAL_LIMIT/);
});

test('0104: negative accessibility hooks require one passed observed positive from the current run', () => {
  const cases = loadRequiredCases().cases.filter((row) => row.family === 'ACCESSIBILITY'); assert.equal(cases.length, 16);
  for (const row of cases) {
    assert.equal(executionHook(row), null);
    assert.deepEqual(accessibilityExecutionHook(row).requires, row.coordinate.kind === 'positive' ? [] : ['ACCESSIBILITY:positive']);
  }
  const prior = { id: 'ACCESSIBILITY:positive', status: 'passed', observationCount: 1, observationsDigest: sha256('actual') };
  assert.deepEqual(sameRunPrerequisites([prior.id], [prior]), [{ id: prior.id, executionDigest: sha256(jcs(prior)) }]);
  for (const entries of [[], [{ ...prior, status: 'failed' }], [{ ...prior, observationCount: 0 }], [prior, prior]])
    assert.throws(() => sameRunPrerequisites([prior.id], entries), /SAME_RUN_PREREQUISITE_FAILED/);
  assert.throws(() => sameRunPrerequisites([prior.id, prior.id], [prior]), /DUPLICATE_PREREQUISITE/);
});

test('0104: quick and strict preflight truthfully retain heavy unexecuted cases and never claim completeness', () => {
  const quick = runCorrectedCoverage(), strict = runCoverageForCompletion();
  assert.equal(quick.profile, 'quick'); assert.equal(quick.version, 'steer-corrected-execution-ledger/v2');
  assert.equal(quick.executed, 310); assert.equal(quick.families.ACCESSIBILITY.executed, 0); assert.equal(quick.families.ACCESSIBILITY.uncovered, 16);
  assert.equal(strict.completeCoverage, false); assert.equal(strict.completionPreflight.fullRunDeferred, true);
  const missing = loadRequiredCases().cases.filter((row) => executionHook(row) === null && accessibilityExecutionHook(row) === null).map((row) => row.id);
  assert.equal(strict.completionPreflight.unmappedFullCaseCount, 3710); assert.equal(strict.completionPreflight.unmappedFullIdsDigest, sha256(jcs(missing)));
  assert.equal(quick.normativeAcceptanceComplete, false); assert.equal(quick.liveProviderUsed, false);
});
