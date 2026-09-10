import assert from 'node:assert/strict';
import test from 'node:test';
import { registerCallerBracketedReviewReadSession, registerReviewReadSession, withReviewReadSession } from '../src/review-read-session.ts';

const current = async () => {};
const track = <T>(pending: Promise<T>) => pending;
const guard = () => {};
const reader = () => ({ scope: { subject: 'human', repository: 'github:1' },
  review: async (_input: unknown, check: () => Promise<void>) => { await check(); return 'ordinary'; } });

test('unregistered or marker-bearing readers retain ordinary invocation and receiver', async () => {
  const port = reader(); let calls = 0;
  Object.assign(port, { readSession: true });
  port.review = async function (_input, check) { assert.equal(this, port); calls++; await check(); return 'ordinary'; };
  await withReviewReadSession(port, {}, current, async read => {
    assert.equal(await read(current), 'ordinary'); assert.equal(await read(current), 'ordinary');
  }, track, guard);
  assert.equal(calls, 2);
});
test('only the exact constructed method and scope can share a read-only session', async () => {
  const port = reader(); let windows = 0;
  registerReviewReadSession(port.review, port.scope, async (_input, check, work) => {
    windows++; await check(); await work(async present => { await present(); return 'shared'; }); await check();
  });
  const wrapper = { scope: port.scope, review: port.review };
  for (let i = 0; i < 2; i++) await withReviewReadSession(wrapper, {}, current, async read => {
    assert.equal(await read(current), 'shared'); assert.equal(await read(current), 'shared');
  }, track, guard);
  assert.equal(windows, 2, 'separate requests must not reuse the enclosing session');
  const copied = { ...port, review: port.review.bind(port) };
  await withReviewReadSession(copied, {}, current, async read => { assert.equal(await read(current), 'ordinary'); }, track, guard);
  assert.equal(windows, 2);
  await assert.rejects(withReviewReadSession({ ...port, scope: { ...port.scope, subject: 'other' } }, {}, current,
    async read => { await read(current); }, track, guard));
  assert.throws(() => registerReviewReadSession(port.review, port.scope, async () => {}));
});
test('changed scope, method, caller and owner state invalidate the whole session', async () => {
  for (const mode of ['scope', 'method', 'caller', 'owner', 'nonvoid-caller']) {
    const port = reader(); let valid = true;
    const check = async () => { if (!valid) throw new Error('revoked'); };
    await assert.rejects(withReviewReadSession(port, {}, check, async read => {
      await read(current);
      if (mode === 'scope') port.scope.subject = 'other';
      if (mode === 'method') port.review = async () => 'replacement';
      if (mode === 'caller' || mode === 'owner') valid = false;
      if (mode === 'nonvoid-caller') await read(async () => 'forged' as unknown as void);
    }, track, () => { if (mode === 'owner' && !valid) throw new Error('closed'); }));
  }
});
test('skipped, empty, replayed, premature and nonvoid constructed windows cannot release results', async () => {
  for (const mode of ['skip', 'empty', 'replay', 'early', 'nonvoid']) {
    const port = reader(); let later: Promise<void> | undefined;
    registerReviewReadSession(port.review, port.scope, async (_input, _check, work) => {
      if (mode === 'skip') return;
      if (mode === 'early') { later = work(async () => 'shared'); return; }
      await work(async () => 'shared');
      if (mode === 'replay') await work(async () => 'shared').catch(() => {});
      if (mode === 'nonvoid') return 'forged' as unknown as void;
    });
    await assert.rejects(withReviewReadSession(port, {}, current, async read => {
      if (mode !== 'empty') await read(current);
    }, track, guard));
    if (later) await later.catch(() => {});
  }
});
test('swallowed read errors, overlapping reads and unawaited reads poison the session', async () => {
  for (const mode of ['swallowed', 'overlap', 'unawaited', 'nonvoid-work']) {
    const port = reader(); let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let pending: Promise<unknown> | undefined;
    port.review = async (_input, check) => { await check(); if (mode === 'swallowed') throw new Error('denied'); await held; return 'ordinary'; };
    const result = withReviewReadSession(port, {}, current, async read => {
      pending = read(current);
      if (mode === 'swallowed') { await pending.catch(() => {}); return; }
      if (mode === 'overlap') { await read(current).catch(() => {}); release(); await pending.catch(() => {}); return; }
      if (mode === 'unawaited') return;
      release(); await pending; return 'forged' as unknown as void;
    }, track, guard);
    await assert.rejects(result); release(); if (pending) await pending.catch(() => {});
  }
});
test('early or forged trackers cannot substitute for actual dependency completion', async () => {
  const port = reader(); let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  port.review = async () => { entered(); await held; return 'real'; };
  let done = false;
  const result = withReviewReadSession(port, {}, current, async read => { assert.equal(await read(current), 'real'); },
    async <T>(_pending: Promise<T>) => undefined as T, guard).then(() => { done = true; });
  await started; await Promise.resolve(); assert.equal(done, false); release(); await result;
  await assert.rejects(withReviewReadSession(reader(), {}, current, async read => { await read(current); },
    async <T>(pending: Promise<T>) => { await pending; return 'forged' as T; }, guard));
});
test('tracker rejection closes the window while its owner retains the actual held task', async () => {
  const port = reader(); let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const owned = new Set<Promise<unknown>>(); let alive = true;
  port.review = async (_input, check) => { entered(); await held; await check(); return 'late'; };
  const result = withReviewReadSession(port, {}, current, async read => { await read(current); },
    async <T>(pending: Promise<T>) => {
      owned.add(pending); void pending.finally(() => owned.delete(pending)).catch(() => {});
      await started; if (!alive) throw new Error('closed'); alive = false; throw new Error('closed');
    }, guard);
  await assert.rejects(result); assert.ok(owned.size > 0);
  release(); await Promise.allSettled([...owned]); assert.equal(owned.size, 0);
});

test('constructed sessions preserve exact guarded caller identity only for the identical original callback', async () => {
  const port = reader(); let shared = 0, separate = 0, calls = 0;
  const caller = async () => { calls++; };
  registerReviewReadSession(port.review, port.scope, async (_input, parent, work) => {
    assert.equal(Object.isFrozen(parent), true);
    await work(async child => { if (child === parent) shared++; else separate++; await child(); return 'shared'; });
  });
  await withReviewReadSession(port, {}, caller, async read => {
    await read(caller); await read(caller);
    for (const other of [async () => caller(), caller.bind(null), Object.assign(async () => caller(), { current: caller })]) await read(other);
  }, track, guard);
  assert.equal(shared, 2); assert.equal(separate, 3); assert.equal(calls, 17);
});

test('shared guarded caller is fresh after dependency IO and denies owner, method or caller changes', async () => {
  for (const mode of ['caller', 'owner', 'method', 'nonvoid']) {
    const port = reader(); let permitted = true, open = true;
    const caller = async () => { if (!permitted) throw new Error('revoked'); if (!open && mode === 'nonvoid') return true as never; };
    registerReviewReadSession(port.review, port.scope, async (_input, parent, work) => {
      await work(async child => {
        assert.equal(child, parent); await child();
        if (mode === 'caller') permitted = false;
        if (mode === 'method') port.review = async () => 'changed';
        open = false; await child(); return 'must not return';
      });
    });
    await assert.rejects(withReviewReadSession(port, {}, caller, async read => { await read(caller); }, track,
      () => { if (!open && mode === 'owner') throw new Error('closed'); }));
  }
});

test('shared caller cannot escape its completed owner or silently authorize an independent child', async () => {
  const port = reader(); let escaped: (() => Promise<void>) | undefined, independent = 0;
  registerReviewReadSession(port.review, port.scope, async (_input, parent, work) => {
    escaped = parent; await work(async child => { await child(); return 'shared'; });
  });
  await withReviewReadSession(port, {}, current, async read => { await read(current); }, track, guard);
  await assert.rejects(escaped!());
  await assert.rejects(withReviewReadSession(port, {}, current, async read => {
    await read(async () => { independent++; throw new Error('Independent authority denied'); });
  }, track, guard)); assert.equal(independent, 1);
});

test('constructed caller-bracket owners remove only redundant wrappers, retaining fresh before/after IO checks', async () => {
  for (const bracketed of [false, true]) {
    const port = reader(), events: string[] = [];
    const caller = async () => { events.push('caller'); };
    (bracketed ? registerCallerBracketedReviewReadSession : registerReviewReadSession)(port.review, port.scope,
      async (_input, parent, work) => {
        await work(async child => {
          assert.equal(child, parent); await child(); events.push('IO'); await child(); return 'same';
        });
      });
    await withReviewReadSession(port, {}, caller, async read => {
      assert.equal(await read(caller), 'same'); assert.equal(await read(caller), 'same');
    }, track, guard);
    assert.equal(events.filter(event => event === 'caller').length, bracketed ? 6 : 10);
    for (let i = 0; i < events.length; i++) if (events[i] === 'IO') {
      assert.equal(events[i - 1], 'caller'); assert.equal(events[i + 1], 'caller');
    }
  }
});

test('bracket ownership is private to the exact registered method, not marker, bound wrapper or ordinary registration', async () => {
  const port = reader(); let calls = 0, windows = 0;
  port.review = async function (_input, check) { assert.equal(this, copied); await check(); return 'ordinary'; };
  registerCallerBracketedReviewReadSession(port.review, port.scope, async (_input, _parent, work) => {
    windows++; await work(async child => { await child(); await child(); return 'owned'; });
  });
  const copied = { scope: port.scope, callerBracketed: true, review: port.review.bind(null) };
  copied.review = port.review.bind(copied);
  const caller = async () => { calls++; };
  await withReviewReadSession(copied, {}, caller, async read => { assert.equal(await read(caller), 'ordinary'); }, track, guard);
  assert.equal(windows, 0); assert.equal(calls, 5);
  await assert.rejects(withReviewReadSession({ ...port, scope: { ...port.scope, subject: 'other' } }, {}, caller,
    async read => { await read(caller); }, track, guard));
});

test('missing caller checks and unrelated parent checks cannot satisfy an independent borrowed caller', async () => {
  for (const mode of ['none', 'once', 'parent-only', 'nonvoid'] as const) {
    const port = reader(); let independent = 0;
    const caller = async () => {};
    const child = async () => { independent++; if (mode === 'nonvoid') return true as never; };
    registerCallerBracketedReviewReadSession(port.review, port.scope, async (_input, parent, work) => {
      await work(async present => {
        if (mode === 'parent-only') { await parent(); await parent(); }
        else if (mode !== 'none') await present();
        return 'unverified';
      });
    });
    await assert.rejects(withReviewReadSession(port, {}, caller, async read => { await read(child); }, track, guard));
    assert.equal(independent, mode === 'once' || mode === 'nonvoid' ? 1 : 0);
  }
});

test('owned brackets reject caller, method, owner and scope changes during IO without releasing the value', async () => {
  for (const mode of ['caller', 'method', 'owner', 'scope'] as const) {
    const port = reader(); let allowed = true, alive = true, values = 0;
    const caller = async () => { if (!allowed) throw new Error('revoked'); };
    registerCallerBracketedReviewReadSession(port.review, port.scope, async (_input, _parent, work) => {
      await work(async present => {
        await present();
        if (mode === 'caller') allowed = false;
        if (mode === 'method') port.review = async () => 'changed';
        if (mode === 'owner') alive = false;
        if (mode === 'scope') port.scope.subject = 'other';
        await present(); return 'must not return';
      });
    });
    await assert.rejects(withReviewReadSession(port, {}, caller, async read => { await read(caller); values++; }, track,
      () => { if (!alive) throw new Error('closed'); })); assert.equal(values, 0);
  }
});

test('owned brackets retain independent callback identity, denial, escaped-call closure and repeated freshness', async () => {
  const port = reader(); let original = 0, independent = 0, shared = 0, separate = 0;
  const caller = async () => { original++; }; let escaped: (() => Promise<void>) | undefined;
  registerCallerBracketedReviewReadSession(port.review, port.scope, async (_input, parent, work) => {
    await work(async present => {
      if (present === parent) shared++; else separate++;
      escaped = present; await present(); await present(); return 'owned';
    });
  });
  await withReviewReadSession(port, {}, caller, async read => {
    await read(caller); await read(async () => { independent++; });
  }, track, guard);
  assert.equal(shared, 1); assert.equal(separate, 1); assert.equal(original, 4); assert.equal(independent, 2);
  await assert.rejects(escaped!());
  await assert.rejects(withReviewReadSession(port, {}, caller, async read => {
    await read(async () => { throw new Error('independent denial'); });
  }, track, guard));
});

test('a swallowed caller denial permanently invalidates a constructed bracket owner', async () => {
  const port = reader(); let allowed = true, values = 0;
  const caller = async () => { if (!allowed) throw new Error('revoked'); };
  registerCallerBracketedReviewReadSession(port.review, port.scope, async (_input, _parent, work) => {
    await work(async present => {
      await present(); allowed = false; await present().catch(() => {}); allowed = true;
      await present().catch(() => {}); return 'must not return';
    });
  });
  await assert.rejects(withReviewReadSession(port, {}, caller, async read => { await read(caller); values++; }, track, guard));
  assert.equal(values, 0);
});

test('an unawaited caller check is not a completed bracket and cannot release a read', async () => {
  for (const completed of [1, 2]) {
  const port = reader(); let release!: () => void, checks = 0, values = 0;
  const held = new Promise<void>(resolve => { release = resolve; }); let late: Promise<void> | undefined;
  const caller = async () => { if (++checks === completed + 2) await held; };
  registerCallerBracketedReviewReadSession(port.review, port.scope, async (_input, _parent, work) => {
    await work(async present => {
      for (let i = 0; i < completed; i++) await present();
      late = present(); void late.catch(() => {}); return 'premature';
    });
  });
  await assert.rejects(withReviewReadSession(port, {}, caller, async read => { await read(caller); values++; }, track, guard));
  assert.equal(values, 0); release(); await assert.rejects(late!);
  }
});
