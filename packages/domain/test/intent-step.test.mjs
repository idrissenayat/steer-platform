import assert from 'node:assert/strict';
import test from 'node:test';
import { newIntentStep, assertIntentStepBinding, planIntentStepTransition, intentDevelopmentWorkflowId } from '../src/intent-step.ts';

const binding = { organizationId: 'org', subject: 'human', operationId: 'operation', stepId: 'architect',
  draftId: 'draft', draftRevision: 1, inputDigest: 'a'.repeat(64), configurationRevision: 'r1' };
const initial = () => newIntentStep(binding, 0);
const claim = (record = initial(), now = 1, owner = 'worker-1', reservationId = 'reservation') =>
  planIntentStepTransition(record, binding, { type: 'claim', owner, reservationId, leaseMs: 100 }, now);
const dispatch = (record = claim(), now = 2) => planIntentStepTransition(record, binding,
  { type: 'commit-dispatch', owner: record.owner, fencingToken: record.fencingToken }, now);

test('immutable claims bind caller/input/configuration and preserve the initial record', () => {
  const original = initial(), claimed = claim(original);
  assert.equal(original.state, 'unclaimed'); assert.equal(claimed.state, 'claimed');
  assert.ok(Object.isFrozen(claimed)); assert.ok(Object.isFrozen(claimed.binding));
  for (const key of Object.keys(binding)) {
    const different = { ...binding, [key]: key === 'draftRevision' ? 2 : 'different' };
    assert.throws(() => assertIntentStepBinding(claimed, different), /binding changed/);
    assert.throws(() => planIntentStepTransition(claimed, different, { type: 'outcome-unknown', fencingToken: 1 }, 2));
  }
});

test('a lease takeover before dispatch increments fencing and reuses the same charged reservation', () => {
  const first = claim();
  assert.throws(() => claim(first, 100, 'worker-2'), /cannot be claimed/);
  assert.throws(() => claim(first, 101, 'worker-2', 'new-reservation'), /reuse its reservation/);
  const next = claim(first, 101, 'worker-2');
  assert.equal(next.fencingToken, 2); assert.equal(next.reservationId, first.reservationId);
  assert.throws(() => planIntentStepTransition(next, binding, { type: 'commit-dispatch', owner: 'worker-1', fencingToken: 1 }, 102), /Stale step owner/);
  assert.equal(dispatch(next, 102).state, 'dispatch-committed');
});

test('only an unexpired owner can plan the one-way dispatch boundary; repeated dispatch rejects', () => {
  const first = claim();
  assert.throws(() => dispatch(first, 101), /cannot cross/);
  assert.throws(() => planIntentStepTransition(first, binding, { type: 'commit-dispatch', owner: 'worker-2', fencingToken: 1 }, 2), /Stale step owner/);
  const sent = dispatch(first);
  assert.throws(() => dispatch(sent, 3), /cannot cross/);
  assert.throws(() => claim(sent, 1000, 'worker-2'), /cannot be claimed/);
  assert.equal(sent.reservationId, 'reservation');
});

test('uncertain dispatch remains charged and cannot be retried, reassigned or turned into success without separate resolution', () => {
  const sent = dispatch();
  const unknown = planIntentStepTransition(sent, binding, { type: 'outcome-unknown', fencingToken: 1 }, 3);
  assert.equal(unknown.state, 'outcome-unknown'); assert.equal(unknown.reservationId, 'reservation');
  for (const event of [
    { type: 'claim', owner: 'worker-2', reservationId: 'reservation', leaseMs: 100 },
    { type: 'commit-dispatch', owner: 'worker-1', fencingToken: 1 },
    { type: 'checkpoint', owner: 'worker-1', fencingToken: 1, resultDigest: 'b'.repeat(64) },
    { type: 'known-failure', owner: 'worker-1', fencingToken: 1 },
  ]) assert.throws(() => planIntentStepTransition(unknown, binding, event, 1000));
});

test('validated role result digest checkpoints before advance; terminal roles cannot run again', () => {
  const sent = dispatch();
  const result = planIntentStepTransition(sent, binding, { type: 'checkpoint', owner: 'worker-1', fencingToken: 1, resultDigest: 'b'.repeat(64) }, 3);
  assert.equal(result.state, 'succeeded'); assert.equal(result.resultDigest, 'b'.repeat(64));
  assert.throws(() => claim(result, 1000), /cannot be claimed/);
  const failed = planIntentStepTransition(sent, binding, { type: 'known-failure', owner: 'worker-1', fencingToken: 1 }, 3);
  assert.equal(failed.state, 'failed-known'); assert.throws(() => claim(failed, 1000));
  assert.throws(() => planIntentStepTransition(claim(), binding, { type: 'checkpoint', owner: 'worker-1', fencingToken: 1, resultDigest: 'b'.repeat(64) }, 2));
  // An explicit authorized reattempt must be a different linked step/operation.
});

test('invalid and regressed clocks and malformed metadata reject', () => {
  assert.throws(() => claim(claim(), 0), /clock regressed/);
  for (const leaseMs of [0, -1, 0.5, Infinity, 300001]) {
    assert.throws(() => planIntentStepTransition(initial(), binding, { type: 'claim', owner: 'w', reservationId: 'r', leaseMs }, 1));
  }
  assert.throws(() => newIntentStep({ ...binding, inputDigest: 'not-a-digest' }, 0));
  assert.throws(() => newIntentStep({ ...binding, draftRevision: 0 }, 0));
  assert.throws(() => newIntentStep({ ...binding, organizationId: '\ud800' }, 0));
  assert.throws(() => newIntentStep({ ...binding, sourceText: 'must not enter workflow metadata' }, 0));
});

test('workflow identifiers escape slash, percent and Unicode without colliding scopes', () => {
  assert.equal(intentDevelopmentWorkflowId('org/a', 'draft', 'operation'), 'steer-intent-development/v1/org%2Fa/draft/operation');
  assert.notEqual(intentDevelopmentWorkflowId('org/a', 'draft', 'operation'), intentDevelopmentWorkflowId('org%2Fa', 'draft', 'operation'));
  assert.notEqual(intentDevelopmentWorkflowId('org', 'a/draft', 'operation'), intentDevelopmentWorkflowId('org/a', 'draft', 'operation'));
  assert.match(intentDevelopmentWorkflowId('سازمان', 'draft', 'operation'), /%/);
});
