import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateWatchId, parseGateTarget, parseGateWatchPlan, parseGateObservation } from '../src/contracts.ts';
import { createGateWatchActivities } from '../src/activities.ts';
const target = { scope: { organizationId: 'org-a', repository: 'github:1', itemId: 'intent/0041' }, gate: 2 as const, artifactRevision: 'a'.repeat(40) };
const observation = { sourceRevision: 'b'.repeat(40), artifactRevision: target.artifactRevision, decisionDigest: null };

test('gate watch identity includes scope, gate and exact revision and rejects unbounded or approval-bearing inputs', () => {
  assert.deepEqual(parseGateTarget(target), target);
  for (const other of [{ ...target, gate: 1 }, { ...target, artifactRevision: 'c'.repeat(40) }, { ...target, scope: { ...target.scope, organizationId: 'foreign' } }]) assert.notEqual(gateWatchId(target), gateWatchId(other));
  const plan = { target, rounds: 2, intervalMs: 1000 }; assert.deepEqual(parseGateWatchPlan(plan), plan);
  for (const invalid of [{ ...plan, approval: true }, { ...plan, rounds: 101 }, { ...plan, intervalMs: 999 },
    { ...plan, target: { ...target, gate: 0 } }, { ...plan, target: { ...target, artifactRevision: 'main' } }, { ...plan, target: { ...target, signer: 'private' } }]) assert.throws(() => parseGateWatchPlan(invalid));
});
test('gate observations contain references only and reject approval, signature, private payload and malformed digests', () => {
  assert.deepEqual(parseGateObservation(observation), observation);
  for (const invalid of [{ ...observation, approved: true }, { ...observation, signer: 'private' }, { ...observation, content: 'private' },
    { ...observation, decisionDigest: 'short' }, { ...observation, sourceRevision: 'main' }, { ...observation, artifactRevision: '' }]) assert.throws(() => parseGateObservation(invalid));
});
test('fixed gate reader rejects foreign targets before access, refuses overlap and sanitizes source errors', async () => {
  let calls = 0, release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const activities = createGateWatchActivities(target, { observe: async () => { calls++; await blocked; throw new Error('private provider failure'); } });
  for (const other of [{ ...target, gate: 1 as const }, { ...target, artifactRevision: 'c'.repeat(40) }, { ...target, scope: { ...target.scope, organizationId: 'foreign' } }]) await assert.rejects(activities.observeGate(other));
  assert.equal(calls, 0); const pending = activities.observeGate(target);
  await assert.rejects(activities.observeGate(target), /already active/); assert.equal(calls, 1);
  release(); await assert.rejects(pending, /^Error: Gate observation did not complete\.$/);
});
