import assert from 'node:assert/strict';
import test from 'node:test';
import { scopeReviewFixture } from '../../tool-registry/test/intent-scope-review.fixture.ts';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import { verifyIntentScopeHistoryOutput, type IntentScopeHistoryReader } from '@steer/tool-registry/intent-scope-history-contracts';
import { withHistoricalScopeReadWindow as window } from '../src/historical-scope-read-window.ts';

async function fixture() {
  const f = await scopeReviewFixture(), input = { organizationId: f.scope.organizationId, productId: f.scope.productId,
    repository: f.scope.repository, reviewId: '00000000-0000-4000-8000-000000000274', preparationDigest: f.prepared.preparationDigest };
  const review = await validateIntentScopeBatchResults(f.evidence, f.prepared.batches.map(b => ({
    planDigest: f.prepared.plan.planDigest, batchId: b.metadata.batchId, assessment: f.result(b) })), f.profile.profileRevision);
  const output = await verifyIntentScopeHistoryOutput({ ...input, kind: 'steer-scope-review-history/v1', subject: 'human', historical: true, reviewExpired: false,
    source: { draftId: f.scope.draftId, revision: 1, revisionDigest: 'b'.repeat(64), scopeInputDigest: f.prepared.plan.scopeInputDigest, latestRevision: 2 },
    head: f.evidence.head, sourceSnapshotDigest: f.prepared.plan.sourceSnapshotDigest, inventory: f.evidence.inventory, review,
    batches: f.prepared.batches.map(b => ({ batchId: b.metadata.batchId, state: 'succeeded', resultDigest: 'c'.repeat(64) })),
    semanticQualityVerified: false, authoritativeClearance: false, savedToGit: false, gateSigned: false, executionAuthorized: false, retryAuthorized: false });
  const state = { calls: 0, current: 0, source: 0, allowed: true, sourceAllowed: true, recordsAllowed: true, output };
  const current = async () => { state.current++; if (!state.allowed) throw new Error('Private identity denial'); };
  const source = async () => { state.source++; if (!state.sourceAllowed) throw new Error('Private source denial'); };
  const reader: IntentScopeHistoryReader = { scope: { organizationId: input.organizationId, productId: input.productId, repository: input.repository, subject: 'human' },
    read: async (_input, recheck) => { state.calls++; await recheck(); if (!state.recordsAllowed) throw new Error('Private retained records/key/profile denial'); return state.output; } };
  return { input, output, state, reader, current, source };
}

test('one private history projection does two full reads, rechecks every reuse, freezes detached evidence and never shares across requests', async () => {
  const f = await fixture(); let retained: IntentScopeHistoryReader | undefined;
  const result = await window(f.reader, f.current, async port => {
    retained = port;
    for (let n = 0; n < 20; n++) {
      const before = f.state.source, value: any = await port!.read(f.input, f.source);
      assert.deepEqual(value, f.output); assert.equal(f.state.calls, 1); assert.ok(f.state.source > before);
      assert.notEqual(value, f.output); assert.throws(() => { value.source.latestRevision = 9; }, TypeError);
    }
    return 'private projection';
  });
  assert.equal(result, 'private projection'); assert.equal(f.state.calls, 2);
  await assert.rejects(retained!.read(f.input, f.source)); assert.equal(f.state.calls, 2);
  await window(f.reader, f.current, async port => port!.read(f.input, f.source)); assert.equal(f.state.calls, 4);
});

test('changed target, scope, binding or reader method poisons the entire read even when intermediate failure is caught', async () => {
  for (const failure of ['input', 'subject', 'scope-object', 'method', 'malformed']) {
    const f = await fixture();
    await assert.rejects(window(f.reader, f.current, async port => {
      await port!.read(f.input, f.source);
      if (failure === 'subject') (f.reader.scope as any).subject = 'other';
      if (failure === 'scope-object') (f.reader as any).scope = { ...f.reader.scope };
      if (failure === 'method') f.reader.read = async () => f.output;
      await assert.rejects(port!.read(failure === 'input' ? { ...f.input, preparationDigest: 'f'.repeat(64) }
        : failure === 'malformed' ? { ...f.input, approved: true } as any : f.input, f.source));
      return 'must not escape';
    }));
    assert.equal(f.state.calls, 1);
  }
});

test('final full read withholds the private result on records/key/profile loss or changed historical evidence', async () => {
  for (const failure of ['records', 'head', 'latest-revision', 'batch', 'source-digest', 'subject', 'review']) {
    const f = await fixture();
    await assert.rejects(window(f.reader, f.current, async port => {
      await port!.read(f.input, f.source);
      if (failure === 'records') f.state.recordsAllowed = false;
      else if (failure === 'head') f.output.head = 'f'.repeat(40);
      else if (failure === 'latest-revision') f.output.source.latestRevision++;
      else if (failure === 'batch') f.output.batches[0]!.resultDigest = 'f'.repeat(64);
      else if (failure === 'source-digest') f.output.source.revisionDigest = 'f'.repeat(64);
      else if (failure === 'subject') f.output.subject = 'other';
      else f.output.review.resultsDigest = 'f'.repeat(64);
      return 'must not escape';
    }), { message: 'Historical scope read is unavailable.' });
    assert.equal(f.state.calls, 2, failure);
  }
});

test('identity/source loss and nonvoid callbacks during final IO deny rather than returning a retained projection', async () => {
  for (const failure of ['identity', 'source', 'nonvoid-current', 'nonvoid-source', 'late-identity', 'late-source']) {
    const f = await fixture(); let completed = false;
    const original = f.reader.read;
    f.reader.read = async (...args) => {
      const value = await original(...args);
      if (f.state.calls === 2 && failure === 'late-identity') f.state.allowed = false;
      if (f.state.calls === 2 && failure === 'late-source') f.state.sourceAllowed = false;
      return value;
    };
    const current = async () => { await f.current(); if (completed && failure === 'nonvoid-current') return true as any; };
    const source = async () => { await f.source(); if (completed && failure === 'nonvoid-source') return true as any; };
    await assert.rejects(window(f.reader, current, async port => {
      await port!.read(f.input, source); completed = true;
      if (failure === 'identity') f.state.allowed = false;
      if (failure === 'source') f.state.sourceAllowed = false;
      return 'must not escape';
    }));
  }
});

test('enclosing cancellation during a held final read prevents late delivery and closes the retained port', async () => {
  const f = await fixture(); let cancelled = false, retained: IntentScopeHistoryReader | undefined;
  let finish!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; }), finalStarted = new Promise<void>(resolve => { reached = resolve; });
  const read = f.reader.read;
  f.reader.read = async (...args) => { const result = await read(...args); if (f.state.calls === 2) { reached(); await held; } return result; };
  const pending = window(f.reader, async () => { if (cancelled) throw new Error('Enclosing read closed or timed out'); await f.current(); },
    async port => { retained = port; return port!.read(f.input, f.source); });
  await finalStarted; cancelled = true; finish();
  await assert.rejects(pending, { message: 'Historical scope read is unavailable.' });
  await assert.rejects(retained!.read(f.input, f.source)); assert.equal(f.state.calls, 2);
});

test('an overlapping initial read fails the private window closed without issuing another authoritative read', async () => {
  const f = await fixture(); let finish!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; }), started = new Promise<void>(resolve => { reached = resolve; });
  const read = f.reader.read;
  f.reader.read = async (...args) => { const result = await read(...args); reached(); await held; return result; };
  await assert.rejects(window(f.reader, f.current, async port => {
    const first = port!.read(f.input, f.source); await started;
    await assert.rejects(port!.read(f.input, f.source)); finish(); await assert.rejects(first);
  }));
  assert.equal(f.state.calls, 1);
});

test('unawaited private work cannot return a projection ahead of its authoritative read', async () => {
  const f = await fixture(); let finish!: () => void, reached!: () => void, pending!: Promise<unknown>;
  const held = new Promise<void>(resolve => { finish = resolve; }), started = new Promise<void>(resolve => { reached = resolve; });
  const read = f.reader.read;
  f.reader.read = async (...args) => { const result = await read(...args); reached(); await held; return result; };
  await assert.rejects(window(f.reader, f.current, async port => {
    pending = port!.read(f.input, f.source); void pending.catch(() => {}); await started; return 'unverified';
  }));
  finish(); await assert.rejects(pending); assert.equal(f.state.calls, 1);
});

test('historical execution expiry can pass without becoming renewed execution authority', async () => {
  const f = await fixture();
  const result = await window(f.reader, f.current, async port => { const value = await port!.read(f.input, f.source); f.output.reviewExpired = true; return value; });
  assert.equal((result as any).executionAuthorized, false); assert.equal(f.state.calls, 2);
  await assert.rejects(window(f.reader, f.current, async port => { await port!.read(f.input, f.source); f.output.reviewExpired = false; }));
});

test('failed private work closes captured ports; absent or unused history does not invent scope authority', async () => {
  const f = await fixture(); let captured: IntentScopeHistoryReader | undefined;
  await assert.rejects(window(f.reader, f.current, async port => { captured = port; await port!.read(f.input, f.source); throw new Error('Private error'); }),
    { message: 'Historical scope read is unavailable.' });
  await assert.rejects(captured!.read(f.input, f.source)); assert.equal(f.state.calls, 1);
  assert.equal(await window(undefined, f.current, async port => { assert.equal(port, undefined); return 'legacy'; }), 'legacy');
  assert.equal(await window(f.reader, f.current, async () => 'empty corpus'), 'empty corpus'); assert.equal(f.state.calls, 1);
});
