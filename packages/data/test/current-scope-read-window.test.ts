import assert from 'node:assert/strict';
import test from 'node:test';
import { scopeReviewFixture } from '../../tool-registry/test/intent-scope-review.fixture.ts';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import { verifyIntentScopeReadOutput, type IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';
import { withCurrentScopeReadWindow as window } from '../src/current-scope-read-window.ts';
import { bracketCurrentReadAuthority as bracket, bracketCurrentReadPolicyAuthority as metadata,
  forwardCurrentReadAuthority as forward } from '../src/current-read-authority.ts';
import { bracketHistoricalReadAuthority as historical } from '../src/historical-read-authority.ts';

async function fixture() {
  const f = await scopeReviewFixture(), input = { organizationId: f.scope.organizationId, productId: f.scope.productId,
    repository: f.scope.repository, reviewId: '00000000-0000-4000-8000-000000000276', preparationDigest: f.prepared.preparationDigest };
  const review = await validateIntentScopeBatchResults(f.evidence, f.prepared.batches.map(b => ({
    planDigest: f.prepared.plan.planDigest, batchId: b.metadata.batchId, assessment: f.result(b) })), f.profile.profileRevision);
  const output = await verifyIntentScopeReadOutput({ ...input, kind: 'steer-scope-review-read/v1', subject: 'human', status: 'review-available',
    source: { draftId: f.scope.draftId, revision: 1, revisionDigest: 'b'.repeat(64), scopeInputDigest: f.prepared.plan.scopeInputDigest, latestRevision: 1 },
    batches: f.prepared.batches.map(b => ({ batchId: b.metadata.batchId, state: 'succeeded', resultDigest: 'c'.repeat(64) })), review,
    semanticQualityVerified: false, authoritativeClearance: false, savedToGit: false, gateSigned: false, executionAuthorized: false, retryAuthorized: false });
  const state = { reads: 0, caller: 0, source: 0, permitted: true, sourcePermitted: true, recordsPermitted: true, output: output as unknown };
  const current = async () => { state.caller++; if (!state.permitted) throw new Error('PRIVATE current identity'); };
  const source = async () => { state.source++; if (!state.sourcePermitted) throw new Error('PRIVATE original authority'); };
  const reader: IntentScopeReader = { scope: { organizationId: input.organizationId, productId: input.productId, repository: input.repository, subject: 'human' },
    read: async (_input, recheck) => { state.reads++; await recheck(); if (!state.recordsPermitted) throw new Error('PRIVATE scope records/key/profile'); return state.output; } };
  return { input, output, state, reader, current, source };
}

test('pre-effect validation makes two full reads, keeps each caller check and cannot retain permission across scheduler boundaries', async () => {
  const f = await fixture(); let port: IntentScopeReader | undefined, effects = 0;
  const validate = () => window(f.reader, f.current, async reader => {
    port = reader;
    for (let n = 0; n < 6; n++) { const before = f.state.source, result: any = await reader!.read(f.input, f.source);
      assert.deepEqual(result, f.output); assert.ok(f.state.source > before); assert.notEqual(result, f.output);
      assert.throws(() => { result.source.revisionDigest = 'f'.repeat(64); }, TypeError); }
  });
  await validate(); effects++; assert.equal(f.state.reads, 2);
  await assert.rejects(port!.read(f.input, f.source)); assert.equal(f.state.reads, 2);
  f.state.recordsPermitted = false;
  await assert.rejects((async () => { await validate(); effects++; })());
  assert.equal(effects, 1); assert.equal(f.state.reads, 3);
});

test('final full current validation blocks the effect on records loss, edits, changed observations or altered results', async () => {
  for (const failure of ['records', 'source', 'batch', 'review', 'identity', 'source-authority']) {
    const f = await fixture(); let effects = 0;
    await assert.rejects((async () => {
      await window(f.reader, f.current, async port => {
        await port!.read(f.input, f.source);
        if (failure === 'records') f.state.recordsPermitted = false;
        else if (failure === 'source') f.output.source.revisionDigest = 'f'.repeat(64);
        else if (failure === 'batch') f.output.batches![0]!.resultDigest = 'f'.repeat(64);
        else if (failure === 'review') f.output.review!.resultsDigest = 'f'.repeat(64);
        else if (failure === 'identity') f.state.permitted = false;
        else f.state.sourcePermitted = false;
      }); effects++;
    })(), { message: 'Current scope validation is unavailable.' });
    assert.equal(effects, 0, failure);
  }
});

test('expired, superseded and historical evidence cannot satisfy current validation, initially or at the final barrier', async () => {
  for (const late of [false, true]) for (const kind of ['expired', 'superseded', 'history']) {
    const f = await fixture(); const changed = kind === 'expired' ? { ...f.output, status: 'expired', batches: null, review: null }
      : kind === 'superseded' ? { ...f.output, status: 'superseded', source: { ...f.output.source, latestRevision: 2 } }
        : { ...f.output, kind: 'steer-scope-review-history/v1', historical: true };
    if (!late) f.state.output = changed;
    await assert.rejects(window(f.reader, f.current, async port => { await port!.read(f.input, f.source); if (late) f.state.output = changed; }));
    assert.equal(f.state.reads, late ? 2 : 1);
  }
});

test('target, reader identity and methods are pinned, and caught intermediate failures still poison validation', async () => {
  for (const kind of ['input', 'subject', 'scope-object', 'method', 'extra-field']) {
    const f = await fixture();
    await assert.rejects(window(f.reader, f.current, async port => {
      await port!.read(f.input, f.source);
      if (kind === 'subject') (f.reader.scope as any).subject = 'foreign';
      else if (kind === 'scope-object') (f.reader as any).scope = { ...f.reader.scope };
      else if (kind === 'method') f.reader.read = async () => f.output;
      await assert.rejects(port!.read(kind === 'input' ? { ...f.input, preparationDigest: 'f'.repeat(64) }
        : kind === 'extra-field' ? { ...f.input, authorized: true } as any : f.input, f.source));
    }));
    assert.equal(f.state.reads, 1);
  }
});

test('missing or nonvoid current callbacks never authorize private reuse or a subsequent effect', async () => {
  for (const kind of ['caller', 'source', 'missing']) {
    const f = await fixture(); let done = false;
    const current = async () => { await f.current(); if (done && kind === 'caller') return true as any; };
    const source = async () => { await f.source(); if (done && kind === 'source') return true as any; };
    await assert.rejects(window(f.reader, current, async port => { await port!.read(f.input, kind === 'missing' ? undefined as any : source); done = true; }));
  }
});

test('enclosing cancellation during final IO withholds completion and closes the captured port', async () => {
  const f = await fixture(); let cancelled = false, retained: IntentScopeReader | undefined, release!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { reached = resolve; });
  const read = f.reader.read;
  f.reader.read = async (...args) => { const value = await read(...args); if (f.state.reads === 2) { reached(); await held; } return value; };
  const pending = window(f.reader, async () => { if (cancelled) throw new Error('Enclosing start closed'); },
    async port => { retained = port; await port!.read(f.input, f.source); });
  await started; cancelled = true; release(); await assert.rejects(pending);
  await assert.rejects(retained!.read(f.input, f.source)); assert.equal(f.state.reads, 2);
});

test('overlapping and unawaited private reads cannot return validation before verification drains', async () => {
  for (const overlap of [false, true]) {
    const f = await fixture(); let release!: () => void, reached!: () => void, first!: Promise<unknown>;
    const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { reached = resolve; });
    const read = f.reader.read; f.reader.read = async (...args) => { const value = await read(...args); reached(); await held; return value; };
    await assert.rejects(window(f.reader, f.current, async port => {
      first = port!.read(f.input, f.source); void first.catch(() => {}); await started;
      if (overlap) { await assert.rejects(port!.read(f.input, f.source)); release(); await assert.rejects(first); }
    }));
    release(); await assert.rejects(first); assert.equal(f.state.reads, 1);
  }
});

test('failed private work closes the port and absent/unused scope does not invent an assessment', async () => {
  const f = await fixture(); let retained: IntentScopeReader | undefined;
  await assert.rejects(window(f.reader, f.current, async port => { retained = port; await port!.read(f.input, f.source); throw new Error('PRIVATE'); }));
  await assert.rejects(retained!.read(f.input, f.source)); assert.equal(f.state.reads, 1);
  await window(undefined, f.current, async port => assert.equal(port, undefined));
  await window(f.reader, f.current, async () => {}); assert.equal(f.state.reads, 1);
});

test('constructed identical caller barriers remove only the redundant pair with two full current reads', async () => {
  const measured = async (kind: 'recognized' | 'wrapped' | 'different' | 'historical') => {
    const f = await fixture(), track = <T>(pending: Promise<T>) => pending, guard = () => {};
    let independent = 0;
    const caller = kind === 'different' ? async () => { independent++; } : f.current;
    const made = kind === 'historical' ? historical(caller, f.source, track, guard) : bracket(caller, f.source, track, guard);
    const source = forward(kind === 'wrapped' ? async () => made() : made, [], track, guard);
    await window(f.reader, f.current, async port => { for (let i = 0; i < 6; i++) assert.deepEqual(await port!.read(f.input, source), f.output); });
    assert.equal(f.state.reads, 2); return { ...f.state, independent };
  };
  const fast = await measured('recognized'), full = await measured('wrapped'), other = await measured('different'), old = await measured('historical');
  assert.equal(fast.source, full.source); assert.equal(fast.source, old.source); assert.equal(fast.source, other.source);
  assert.equal(full.caller - fast.caller, 2 * fast.source); assert.equal(old.caller, full.caller);
  assert.equal(other.independent, 2 * fast.source); assert.equal(other.caller, fast.caller);
});

test('recognized current barriers still deny final revocation, changed records and expired scope before effects', async () => {
  for (const failure of ['caller', 'source', 'records', 'expired', 'changed', 'nonvoid']) {
    const f = await fixture(); let effects = 0, invalid = false;
    const source = bracket(f.current, async () => { await f.source(); if (invalid) return true; }, p => p, () => {});
    await assert.rejects((async () => {
      await window(f.reader, f.current, async port => {
        await port!.read(f.input, source);
        if (failure === 'caller') f.state.permitted = false;
        else if (failure === 'source') f.state.sourcePermitted = false;
        else if (failure === 'records') f.state.recordsPermitted = false;
        else if (failure === 'expired') f.state.output = { ...f.output, status: 'expired', batches: null, review: null };
        else if (failure === 'changed') f.output.source.revisionDigest = 'f'.repeat(64);
        else invalid = true;
      }); effects++;
    })()); assert.equal(effects, 0, failure);
  }
});

test('current scope reader invocation preserves its receiver and ignores a replaced call property', async () => {
  const f = await fixture(), read = f.reader.read;
  f.reader.read = async function (input, callback) { assert.equal(this, f.reader); return read(input, callback); };
  Object.defineProperty(f.reader.read, 'call', { value: async () => assert.fail('overridden call') });
  await window(f.reader, f.current, async port => { assert.deepEqual(await port!.read(f.input, f.source), f.output); });
  assert.equal(f.state.reads, 2);
});

test('immutable intermediate reuse makes exactly one fresh source barrier, while real reads stay fully bracketed', async () => {
  const f = await fixture(); const events: string[] = [], raw = f.reader.read;
  f.reader.read = async (...args) => { events.push('read'); const value = await raw(...args); events.push('read-done'); return value; };
  const source = bracket(f.current, async () => { events.push('source'); await f.source(); }, p => p, () => {});
  await window(f.reader, f.current, async port => {
    await port!.read(f.input, source);
    const before = events.length;
    assert.deepEqual(await port!.read(f.input, source), f.output);
    assert.deepEqual(events.slice(before), ['source']);
  });
  assert.deepEqual(events, ['source', 'read', 'source', 'read-done', 'source', 'source',
    'source', 'read', 'source', 'read-done', 'source']);
  assert.equal(f.state.reads, 2);
});

test('a single intermediate permission check still rejects fresh source loss without exposing reused content', async () => {
  for (const kind of ['source', 'caller', 'nonvoid']) {
    const f = await fixture(); let nonvoid = false, returned = 0;
    const source = bracket(f.current, async () => { await f.source(); if (nonvoid) return true; }, p => p, () => {});
    await assert.rejects(window(f.reader, f.current, async port => {
      await port!.read(f.input, source);
      if (kind === 'source') f.state.sourcePermitted = false;
      else if (kind === 'caller') f.state.permitted = false;
      else nonvoid = true;
      await port!.read(f.input, source); returned++;
    }));
    assert.equal(returned, 0); assert.equal(f.state.reads, 1);
  }
});

test('explicit current metadata source keeps every policy and full read while removing only its pre-policy caller traversal', async () => {
  const measured = async (optimized: boolean) => {
    const f = await fixture(), constructor = optimized ? metadata : bracket;
    const callback = forward(constructor(f.current, f.source, p => p, () => {}), [], p => p, () => {});
    await window(f.reader, f.current, async port => { for (let n = 0; n < 6; n++) assert.deepEqual(await port!.read(f.input, callback), f.output); });
    return f.state;
  };
  const full = await measured(false), fast = await measured(true);
  assert.equal(fast.reads, 2); assert.equal(full.reads, fast.reads);
  assert.equal(fast.source, full.source); assert.equal(full.caller - fast.caller, fast.source);
});

test('metadata scope queries authenticate entry and reject policy-time caller loss before any scope IO', async () => {
  for (const revoke of ['entry', 'policy', 'final-policy']) {
    const f = await fixture(); let final = false, policies = 0, effects = 0;
    const current = async () => { await f.current(); };
    const source = forward(metadata(current, async () => {
      policies++; await f.source(); if (revoke === 'policy' || final) f.state.permitted = false;
    }, p => p, () => {}), [], p => p, () => {});
    if (revoke === 'entry') f.state.permitted = false;
    await assert.rejects((async () => {
      await window(f.reader, current, async port => { await port!.read(f.input, source); final = true; }); effects++;
    })());
    assert.equal(effects, 0); assert.equal(f.state.reads, revoke === 'final-policy' ? 1 : 0);
    if (revoke === 'entry') assert.equal(policies, 0);
  }
});

test('metadata scope keeps final records/source/expiry checks and closes escaped current ports', async () => {
  for (const failure of ['records', 'source', 'expired', 'changed', 'history']) {
    const f = await fixture(); let escaped: IntentScopeReader | undefined;
    const callback = forward(metadata(f.current, f.source, p => p, () => {}), [], p => p, () => {});
    await assert.rejects(window(f.reader, f.current, async port => {
      escaped = port; await port!.read(f.input, callback);
      if (failure === 'records') f.state.recordsPermitted = false;
      else if (failure === 'source') f.state.sourcePermitted = false;
      else if (failure === 'expired') f.state.output = { ...f.output, status: 'expired', batches: null, review: null };
      else if (failure === 'history') f.state.output = { ...f.output, kind: 'steer-scope-review-history/v1', historical: true };
      else f.output.source.revisionDigest = 'f'.repeat(64);
    }));
    await assert.rejects(escaped!.read(f.input, callback));
  }
});
