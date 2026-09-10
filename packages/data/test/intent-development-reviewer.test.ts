import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntentDevelopmentReviewer } from '../src/intent-development-reviewer.ts';
import { developmentFixture } from '../../tool-registry/test/intent-development.fixture.ts';
import { withReviewReadSession } from '../src/review-read-session.ts';

async function setup() {
  const f = await developmentFixture(), state = { reads: 0, evidenceReads: 0, authorizations: 0 };
  const config = { ...f.scope, subject: 'human', branch: f.evidence.branch, configurationRevision: f.review.configurationRevision, recordsPolicyDigest: 'a'.repeat(64) };
  const deps: Parameters<typeof createIntentDevelopmentReviewer>[1] = {
    drafts: { scope: { ...f.scope, subject: config.subject }, create: async () => assert.fail('read-only'), append: async () => assert.fail('read-only'),
      async read() { state.reads++; return { draftId: f.input.draftId, revision: 1, latestRevision: 1, sourceRevision: 1,
        revisionDigest: f.input.revisionDigest, scopeInputDigest: f.input.scopeInputDigest, content: f.content, savedToGit: false }; } },
    evidenceFor: async () => { state.evidenceReads++; return f.evidence; }, authorizeReview: async () => { state.authorizations++; },
  };
  return { f, state, config, deps, service: createIntentDevelopmentReviewer(config, deps) };
}
test('review reads latest exact draft and unchanged source bytes twice, without modifying drafts or creating operations', async () => {
  const { f, state, service } = await setup();
  assert.deepEqual(await service.review(f.input, async () => {}), f.review);
  assert.deepEqual(state, { reads: 2, evidenceReads: 2, authorizations: 2 }); service.close();
  await assert.rejects(service.review(f.input, async () => {}));
});
test('held/changed drafts, foreign scopes, changed evidence and missing provenance authority never release review', async () => {
  for (const mode of ['draft', 'source', 'authority', 'scope', 'read-body'] as const) {
    const { f, state, service, deps } = await setup();
    if (mode === 'draft') deps.drafts.read = async () => { throw new Error('PRIVATE'); };
    if (mode === 'source') deps.evidenceFor = async () => ({ ...f.evidence, head: ++state.evidenceReads === 1 ? f.evidence.head : 'f'.repeat(40) });
    if (mode === 'authority') deps.authorizeReview = async () => { throw new Error('PRIVATE'); };
    if (mode === 'scope') deps.drafts = { ...deps.drafts, scope: { ...deps.drafts.scope, subject: 'other' } };
    if (mode === 'read-body') { const read = deps.drafts.read; deps.drafts.read = async (input, current) => ({ ...await read(input, current) as object, latestRevision: 2 }); }
    await assert.rejects(service.review(f.input, async () => {}), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; }); service.close();
  }
});
test('incomplete source review remains incomplete, never creates evidence of newness', async () => {
  const { f, deps, service } = await setup(); deps.evidenceFor = async () => ({ ...f.evidence, inventoryComplete: false, accessGapCount: 1 });
  const result = await service.review(f.input, async () => {});
  assert.equal(result.evidence.inventoryComplete, false); assert.equal(result.evidence.accessGapCount, 1); assert.equal(result.authoritativeClearance, false);
});
test('pending dependencies retain bounded admission and late closure cannot release content', async () => {
  const { f, deps, service } = await setup(); const releases: Array<() => void> = [];
  deps.evidenceFor = async () => { await new Promise<void>(resolve => releases.push(resolve)); return f.evidence; };
  const current = async () => {};
  const reads = Array.from({ length: 4 }, () => service.review(f.input, current));
  await assert.rejects(service.review(f.input, current));
  for (let i = 0; i < 20 && releases.length < 4; i++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(releases.length, 4); service.close(); releases.forEach(release => release());
  await Promise.all(reads.map(read => assert.rejects(read)));
});
test('trusted evidence session encloses only source review and keeps both draft and provenance checks', async () => {
  const { f, state, service, deps } = await setup(); let sessions = 0;
  deps.evidenceFor = async () => assert.fail('Session path must own evidence');
  deps.withEvidenceRead = async (input, current, work) => {
    sessions++; assert.deepEqual(input, f.input); await current();
    const result = await work(async () => { state.evidenceReads++; return f.evidence; }); await current(); return result;
  };
  assert.deepEqual(await service.review(f.input, async () => {}), f.review);
  assert.equal(sessions, 1); assert.deepEqual(state, { reads: 2, evidenceReads: 2, authorizations: 2 }); service.close();
});
test('session path preserves exact draft, evidence, authority and late-caller rejection', async () => {
  for (const mode of ['draft', 'source', 'authority', 'late-current', 'closed'] as const) {
    const { f, deps, service } = await setup(); let valid = true, sources = 0;
    const read = deps.drafts.read;
    if (mode === 'draft') deps.drafts.read = async (...args) => ({ ...await read(...args) as object, latestRevision: 2 });
    if (mode === 'authority') deps.authorizeReview = async () => { throw new Error('PRIVATE'); };
    deps.withEvidenceRead = async (_input, current, work) => {
      const result = await work(async () => ({ ...f.evidence, head: mode === 'source' && ++sources > 1 ? 'f'.repeat(40) : f.evidence.head }));
      if (mode === 'late-current') valid = false;
      if (mode === 'closed') service.close();
      await current(); return result;
    };
    await assert.rejects(service.review(f.input, async () => { if (!valid) throw new Error('PRIVATE'); }), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; }); service.close();
  }
});
test('constructed source phase lazily shares initial review and reopens complete final state and exact draft', async () => {
  const { f, state, service, deps } = await setup(); let windows = 0;
  deps.withEvidenceRead = async (_input, current, work) => {
    windows++; await current(); const value = await work(async () => { state.evidenceReads++; await current(); return f.evidence; });
    await current(); return value;
  };
  for (let i = 0; i < 2; i++) await withReviewReadSession(service, f.input, async () => {}, async read => {
    assert.equal(state.reads, i * 3); assert.equal(state.evidenceReads, i * 2);
    assert.deepEqual(await read(async () => {}), f.review);
    assert.equal(state.reads, i * 3 + 1); assert.equal(state.evidenceReads, i * 2 + 1);
    assert.deepEqual(await read(async () => {}), f.review);
    assert.equal(state.reads, i * 3 + 1); assert.equal(state.evidenceReads, i * 2 + 1);
  }, pending => pending, () => {});
  assert.equal(windows, 2);
  assert.deepEqual(state, { reads: 6, evidenceReads: 4, authorizations: 6 }); service.close();
});

test('identical caller composition removes duplicate invocation without changing source, draft or policy work', async () => {
  const measure = async (shared: boolean) => {
    const { f, state, service, deps } = await setup(); let parentCalls = 0, childCalls = 0;
    const parent = async () => { parentCalls++; }, child = async () => { childCalls++; await parent(); };
    deps.withEvidenceRead = async (_input, current, work) => {
      await current(); const value = await work(async () => { state.evidenceReads++; await current(); return f.evidence; });
      await current(); return value;
    };
    try {
      await withReviewReadSession(service, f.input, parent, async read => {
        for (let n = 0; n < 3; n++) assert.deepEqual(await read(shared ? parent : child), f.review);
      }, pending => pending, () => {});
      return { parentCalls, childCalls, state };
    } finally { service.close(); }
  };
  const shared = await measure(true), independent = await measure(false);
  assert.deepEqual(shared.state, independent.state); assert.deepEqual(shared.state, { reads: 3, evidenceReads: 2, authorizations: 4 });
  assert.equal(shared.childCalls, 0); assert.ok(independent.childCalls > 0);
  assert.ok(shared.parentCalls < independent.parentCalls);
  assert.equal(independent.parentCalls - shared.parentCalls, independent.childCalls,
    'The source owner retains both caller boundaries; no extra session-wrapper checks remain to subtract');
});

test('identical source caller still rejects revocation during draft or evidence IO and at final closure', async () => {
  for (const mode of ['draft', 'evidence', 'final-corpus', 'between-consumptions']) {
    const { f, deps, service } = await setup(); let allowed = true, returned = false;
    const caller = async () => { if (!allowed) throw new Error('PRIVATE revoked exact caller'); };
    const draft = deps.drafts.read;
    deps.drafts.read = async (...args) => { const value = await draft(...args); if (mode === 'draft') allowed = false; return value; };
    deps.withEvidenceRead = async (_input, current, work) => {
      const value = await work(async () => { if (mode === 'evidence') allowed = false; await current(); return f.evidence; });
      if (mode === 'final-corpus') allowed = false; await current(); return value;
    };
    try {
      await assert.rejects(withReviewReadSession(service, f.input, caller, async read => {
        await read(caller); if (mode === 'between-consumptions') { allowed = false; await read(caller); }
      }, pending => pending, () => {}).then(() => { returned = true; })); assert.equal(returned, false);
    } finally { service.close(); }
  }
});
test('final corpus callback cannot hide a changed draft, key loss, hold, swapped port or revoked caller', async () => {
  for (const mode of ['draft', 'content', 'key', 'hold', 'draft-port', 'authority-port', 'hook', 'caller', 'closed']) {
    const { f, deps, service } = await setup(); let ended = false, valid = true;
    const read = deps.drafts.read;
    deps.drafts.read = async (...args) => {
      if (ended && (mode === 'key' || mode === 'hold')) throw new Error('PRIVATE');
      return { ...await read(...args) as object, latestRevision: ended && mode === 'draft' ? 2 : 1,
        ...(ended && mode === 'content' ? { content: { ...f.content, originalText: 'Changed during final source closure' } } : {}) };
    };
    deps.withEvidenceRead = async (_input, current, work) => {
      const result = await work(async () => f.evidence); ended = true;
      if (mode === 'draft-port') deps.drafts = { ...deps.drafts };
      if (mode === 'authority-port') deps.authorizeReview = async () => {};
      if (mode === 'hook') deps.withEvidenceRead = async (_i, _c, w) => w(async () => f.evidence);
      if (mode === 'caller') valid = false;
      if (mode === 'closed') service.close();
      await current(); return result;
    };
    await assert.rejects(withReviewReadSession(service, f.input, async () => { if (!valid) throw new Error('PRIVATE'); },
      async read => { await read(async () => {}); }, pending => pending, () => {})); service.close();
  }
});
test('constructed source sessions deny malformed evidence windows and swallowed child failure', async () => {
  for (const mode of ['skip', 'replay', 'early', 'nonvoid', 'swallowed']) {
    const { f, deps, service } = await setup(); let later: Promise<unknown> | undefined;
    deps.withEvidenceRead = async (_input, _current, work) => {
      if (mode === 'skip') return undefined as never;
      if (mode === 'early') { later = work(async () => f.evidence); return undefined as never; }
      const value = await work(async () => { if (mode === 'swallowed') throw new Error('PRIVATE'); return f.evidence; });
      if (mode === 'replay') await work(async () => f.evidence).catch(() => {});
      return mode === 'nonvoid' ? 'forged' as never : value;
    };
    await assert.rejects(withReviewReadSession(service, f.input, async () => {}, async read => {
      await read(async () => {}).catch(error => { if (mode !== 'swallowed') throw error; });
    }, pending => pending, () => {}));
    if (later) await later.catch(() => {}); service.close();
  }
});
test('a closed shared session retains actual held child work and source admission until drainage', async () => {
  const { f, deps, service } = await setup(); const releases: Array<() => void> = [];
  deps.withEvidenceRead = async (_input, _current, work) => work(async () => {
    await new Promise<void>(resolve => releases.push(resolve)); return f.evidence;
  });
  const sessions = Array.from({ length: 4 }, () => withReviewReadSession(service, f.input, async () => {},
    async read => { await read(async () => {}); }, pending => pending, () => {}));
  for (const session of sessions) void session.catch(() => {});
  for (let i = 0; i < 30 && releases.length < 4; i++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(releases.length, 4);
  await assert.rejects(service.review(f.input, async () => {}));
  service.close(); releases.forEach(release => release());
  await Promise.all(sessions.map(session => assert.rejects(session)));
});

test('source phase rechecks changed evidence and full draft content after dependent work', async () => {
  for (const mode of ['evidence', 'draft', 'policy', 'incomplete']) {
    const { f, deps, service } = await setup(); let changed = false;
    const draft = deps.drafts.read;
    deps.drafts.read = async (...args) => ({ ...await draft(...args) as object,
      ...(changed && mode === 'draft' ? { content: { ...f.content, originalText: 'Changed text with stale metadata' } } : {}) });
    deps.authorizeReview = async () => { if (changed && mode === 'policy') throw new Error('PRIVATE policy revoked'); };
    deps.withEvidenceRead = async (_input, _current, work) => work(async () => ({ ...f.evidence,
      ...(changed && mode === 'evidence' ? { head: 'f'.repeat(40) } : {}),
      ...(changed && mode === 'incomplete' ? { inventoryComplete: false, accessGapCount: 1 } : {}) }));
    try {
      await assert.rejects(withReviewReadSession(service, f.input, async () => {}, async read => {
        assert.deepEqual(await read(async () => {}), f.review); changed = true;
      }, pending => pending, () => {}));
    } finally { service.close(); }
  }
});

test('each source consumption reauthorizes and keeps its independent caller active during evidence IO', async () => {
  for (const mode of ['per-consumption', 'policy-consumption', 'during-io']) {
    const { f, deps, service } = await setup(); let allowed = true, entered = false, finished = false;
    const child = async () => { if (!allowed && mode !== 'policy-consumption') throw new Error('PRIVATE child caller revoked'); };
    deps.authorizeReview = async () => { if (!allowed && mode === 'policy-consumption') throw new Error('PRIVATE source policy revoked'); };
    deps.withEvidenceRead = async (_input, current, work) => work(async () => {
      entered = true;
      if (mode === 'during-io') allowed = false;
      await current(); finished = true; return f.evidence;
    });
    try {
      await assert.rejects(withReviewReadSession(service, f.input, async () => {}, async read => {
        await read(child);
        if (mode !== 'during-io') { allowed = false; await assert.rejects(read(child)); }
      }, pending => pending, () => {}));
      assert.equal(entered, true); if (mode === 'during-io') assert.equal(finished, false);
    } finally { service.close(); }
  }
});

test('source consumptions close before final validation and reject skipped, overlapping and escaped reads', async () => {
  for (const mode of ['skipped', 'parallel', 'during-final', 'after-phase']) {
    const { f, deps, service } = await setup(); let reads = 0, escaped: (() => Promise<unknown>) | undefined;
    deps.withEvidenceRead = async (_input, _current, work) => work(async () => {
      if (++reads === 2 && mode === 'during-final') await assert.rejects(escaped!());
      return f.evidence;
    });
    const work = () => withReviewReadSession(service, f.input, async () => {}, async read => {
      escaped = () => read(async () => {});
      if (mode === 'parallel') await Promise.allSettled([escaped(), escaped()]);
      else if (mode !== 'skipped') await escaped();
    }, pending => pending, () => {});
    try {
      if (mode === 'after-phase') { await work(); await assert.rejects(escaped!()); }
      else await assert.rejects(work());
    } finally { service.close(); }
  }
});

test('forgotten source consumption retains its owner until the actual independent caller drains', async () => {
  const { f, deps, service } = await setup(); let entered!: () => void, release!: () => void, settled = false;
  const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  deps.withEvidenceRead = async (_input, _current, work) => work(async () => f.evidence);
  const result = withReviewReadSession(service, f.input, async () => {}, async read => {
    await read(async () => {}); let calls = 0;
    void read(async () => { if (++calls === 2) { entered(); await gate; } }).catch(() => {});
    await started;
  }, pending => pending, () => {}).then(() => assert.fail('Forgotten read returned'), () => {}).finally(() => { settled = true; });
  try {
    await started; service.close(); await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(settled, false); release(); await result;
  } finally { release(); service.close(); await result; }
});
