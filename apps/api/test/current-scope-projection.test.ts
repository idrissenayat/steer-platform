import assert from 'node:assert/strict';
import test from 'node:test';
import { scopeReviewFixture } from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import type { IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';
import { withCurrentScopeProjection as project } from '../src/current-scope-projection.ts';

async function fixture() {
  const f = await scopeReviewFixture(), input = { organizationId: f.scope.organizationId, productId: f.scope.productId,
    repository: f.scope.repository, reviewId: '00000000-0000-4000-8000-000000000320', preparationDigest: f.prepared.preparationDigest };
  const review = await validateIntentScopeBatchResults(f.evidence, f.prepared.batches.map(b => ({
    planDigest: f.prepared.plan.planDigest, batchId: b.metadata.batchId, assessment: f.result(b) })), f.profile.profileRevision);
  const output = { ...input, kind: 'steer-scope-review-read/v1', subject: 'human', status: 'review-available',
    source: { draftId: f.scope.draftId, revision: 1, revisionDigest: 'b'.repeat(64), scopeInputDigest: f.prepared.plan.scopeInputDigest, latestRevision: 1 },
    batches: f.prepared.batches.map(b => ({ batchId: b.metadata.batchId, state: 'succeeded', resultDigest: 'c'.repeat(64) })), review,
    semanticQualityVerified: false, authoritativeClearance: false, savedToGit: false, gateSigned: false, executionAuthorized: false, retryAuthorized: false };
  let permitted = true, valid = true; const events: string[] = [];
  return { input, output, events, revoke: () => { permitted = false; }, expire: () => { valid = false; },
    current: async () => { events.push('current'); if (!permitted) throw new Error('PRIVATE caller'); },
    check: () => { if (!valid) throw new Error('PRIVATE lease'); },
    source: async () => { events.push('source'); } };
}

test('current projection pins exact immutable output, reruns caller/source checks and closes the borrowed port', async () => {
  const f = await fixture(); let escaped: IntentScopeReader | undefined;
  await project(f.output, f.current, f.check, async reader => {
    escaped = reader; assert.equal(Object.isFrozen(reader), true); assert.equal(Object.isFrozen(reader.scope), true);
    for (let n = 0; n < 3; n++) {
      const offset = f.events.length, result = await reader.read(f.input, f.source);
      assert.deepEqual(result, f.output); assert.deepEqual(f.events.slice(offset), ['current', 'source', 'current']);
      assert.throws(() => { (result as typeof f.output).source.revision = 2; }, TypeError);
    }
  });
  const count = f.events.length; await assert.rejects(escaped!.read(f.input, f.source)); assert.equal(f.events.length, count);
});

test('current projection rejects history, expiry, supersession and malformed results before consumption', async () => {
  for (const mode of ['history', 'expired', 'superseded', 'malformed']) {
    const f = await fixture(); let consumed = false;
    if (mode === 'history') f.output.kind = 'steer-scope-review-history/v1';
    else if (mode === 'expired') f.output.status = 'expired';
    else if (mode === 'superseded') f.output.source.latestRevision = 2;
    else f.output.review = { ...f.output.review, resultsDigest: 'f'.repeat(64) };
    await assert.rejects(project(f.output, f.current, f.check, async () => { consumed = true; })); assert.equal(consumed, false);
  }
});

test('current projection denies malformed caller, policy-time revocation and changed lease before output', async () => {
  for (const mode of ['entry', 'caller-nonvoid', 'policy', 'policy-nonvoid', 'lease']) {
    const f = await fixture(); let effects = 0;
    if (mode === 'entry') f.revoke();
    const current = mode === 'caller-nonvoid' ? async () => true as never : f.current;
    await assert.rejects(project(f.output, current, f.check, async reader => {
      await reader.read(f.input, async () => {
        if (mode === 'policy') f.revoke(); if (mode === 'lease') f.expire();
        if (mode === 'policy-nonvoid') return true as never;
      }); effects++;
    })); assert.equal(effects, 0);
  }
});

test('foreign or caught failed reads, unconsumed work and nonvoid work cannot finalize a current projection', async () => {
  for (const mode of ['foreign', 'unconsumed', 'nonvoid']) {
    const f = await fixture();
    await assert.rejects(project(f.output, f.current, f.check, async reader => {
      if (mode === 'unconsumed') return;
      if (mode === 'foreign') { await assert.rejects(reader.read({ ...f.input, productId: 'foreign' }, f.source)); return; }
      await reader.read(f.input, f.source); return true as never;
    }));
  }
});

test('unawaited or concurrent current reads deny finalization and drain the actual held callback', async () => {
  for (const concurrent of [false, true]) {
    const f = await fixture(); let release!: () => void, entered!: () => void, workDone!: () => void, completed = false;
    const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
    const returned = new Promise<void>(resolve => { workDone = resolve; });
    const result = project(f.output, f.current, f.check, async reader => {
      const read = reader.read(f.input, async () => { entered(); await held; }); void read.catch(() => {});
      await reached; if (concurrent) await assert.rejects(reader.read(f.input, f.source)); workDone();
    }).finally(() => { completed = true; }); void result.catch(() => {});
    await returned; await new Promise(resolve => setImmediate(resolve)); assert.equal(completed, false);
    release(); await assert.rejects(result); assert.equal(completed, true);
  }
});

test('final caller or lease loss rejects a consumed projection before the producer finalizes records', async () => {
  for (const mode of ['caller', 'lease']) {
    const f = await fixture();
    await assert.rejects(project(f.output, f.current, f.check, async reader => {
      await reader.read(f.input, f.source); if (mode === 'caller') f.revoke(); else f.expire();
    }));
  }
});
