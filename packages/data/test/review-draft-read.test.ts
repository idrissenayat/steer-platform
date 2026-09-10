import assert from 'node:assert/strict';
import test from 'node:test';
import { lendReviewDraftRead, forwardReviewDraftRead, readReviewDraft, type ReviewDraftRead } from '../src/review-draft-read.ts';
import { registerCallerBracketedReviewReadSession, withReviewReadSession } from '../src/review-read-session.ts';

const input = { organizationId: 'org', productId: 'product', repository: 'github:52', draftId: '11111111-1111-4111-8111-111111111111', revision: 1 };
const current = async () => {};
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('review draft loans require exact service identity and input; other services, revisions and forged tokens retain fallback', async () => {
  let borrowed = 0, ordinary = 0;
  const reader = { scope: { ...input, subject: 'human' }, read: async () => ++ordinary };
  const loan = lendReviewDraftRead(reader, input, async () => { borrowed++; return 'snapshot'; }, () => {});
  const read = (token = loan, service = reader, raw = input) => readReviewDraft(token, service, raw, () => service.read());
  assert.equal(await read(), 'snapshot'); assert.equal(await read(loan, reader, { ...input }), 'snapshot');
  assert.equal(await read(loan, { ...reader }), 1);
  assert.equal(await read(loan, reader, { ...input, revision: 2 }), 2);
  assert.equal(await read({ ...loan } as ReviewDraftRead), 3);
  assert.equal(forwardReviewDraftRead({} as ReviewDraftRead, async () => 'forged'), undefined);
  assert.equal(borrowed, 2); assert.equal(ordinary, 3); assert.deepEqual(Object.keys(loan), []);
});

test('review draft loans reject late owner, scope and method changes and forwarding keeps every owner guard', async () => {
  for (const mode of ['close', 'scope', 'method', 'after']) {
    let closed = false, parent = 0, child = 0;
    const reader = { scope: { owner: 'human' }, read: async () => 'ordinary' };
    const loan = lendReviewDraftRead(reader, input, async () => { if (mode === 'after') closed = true; return 'snapshot'; }, () => { parent++; if (closed) throw new Error(); });
    const nested = forwardReviewDraftRead(loan, async work => { child++; const result = await work(); child++; return result; });
    if (mode === 'close') closed = true;
    if (mode === 'scope') reader.scope.owner = 'foreign';
    if (mode === 'method') reader.read = async () => 'changed';
    await assert.rejects(readReviewDraft(nested, reader, input, () => reader.read()));
    assert.ok(parent >= 1); assert.equal(child, 1);
  }
});

function fixture(readDraft: () => Promise<unknown> = async () => 'snapshot') {
  const drafts = { scope: { organizationId: 'org', subject: 'human' }, read: async () => 'ordinary' };
  const review = { scope: drafts.scope, review: async () => 'ordinary-review' };
  let ended = false, workEnded = false;
  const loan = lendReviewDraftRead(drafts, input, readDraft, () => { if (ended) throw new Error(); });
  registerCallerBracketedReviewReadSession(review.review, review.scope, async (_input, _current, work) => {
    try { await work(async present => { await present(); await present(); return 'reviewed'; }, loan); workEnded = true; }
    finally { ended = true; }
  });
  return { drafts, review, get ended() { return ended; }, get workEnded() { return workEnded; } };
}

test('review sessions forward an exact draft loan, keep review caller brackets and close escaped reads', async () => {
  let reads = 0, callers = 0;
  const f = fixture(async () => { reads++; return 'snapshot'; }); let escaped: ReviewDraftRead | undefined;
  const caller = async () => { callers++; };
  await withReviewReadSession(f.review, {}, caller, async (read, draft) => {
    escaped = draft;
    for (let i = 0; i < 3; i++) assert.equal(await readReviewDraft(draft, f.drafts, input, f.drafts.read), 'snapshot');
    assert.equal(await read(caller), 'reviewed');
  }, task => task, () => {});
  assert.equal(reads, 3); assert.ok(callers >= 4); assert.equal(f.ended, true);
  await assert.rejects(readReviewDraft(escaped, f.drafts, input, f.drafts.read));
});

test('caught draft-loan failures poison the whole review and cannot become successful validation', async () => {
  const f = fixture(async () => { throw new Error('PRIVATE'); });
  await assert.rejects(withReviewReadSession(f.review, {}, current, async (read, draft) => {
    await read(current); await readReviewDraft(draft, f.drafts, input, f.drafts.read).catch(() => {});
  }, task => task, () => {}));
  assert.equal(f.workEnded, false);
});

test('unawaited and overlapping loan reads retain actual tracking and deny review completion', async () => {
  for (const mode of ['forgotten', 'draft-overlap', 'review-overlap']) {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const f = fixture(async () => { await held; return 'snapshot'; }), owned = new Set<Promise<unknown>>();
    let later: Promise<unknown> | undefined;
    const result = withReviewReadSession(f.review, {}, current, async (read, draft) => {
      await read(current);
      later = readReviewDraft(draft, f.drafts, input, f.drafts.read); void later.catch(() => {});
      await tick();
      if (mode === 'draft-overlap') await readReviewDraft(draft, f.drafts, input, f.drafts.read).catch(() => {});
      if (mode === 'review-overlap') await read(current).catch(() => {});
    }, task => { owned.add(task); void task.finally(() => owned.delete(task)).catch(() => {}); return task; }, () => {});
    await assert.rejects(result); assert.ok(owned.size > 0); assert.equal(f.workEnded, false);
    release(); await assert.rejects(later!); await tick(); assert.equal(owned.size, 0);
  }
});

test('draft loans close at consumer return even while producer final verification is still running', async () => {
  const drafts = { scope: { owner: 'human' }, read: async () => 'ordinary' }, review = { scope: drafts.scope, review: async () => 'ordinary' };
  let escaped: ReviewDraftRead | undefined, lateDenied = false;
  const loan = lendReviewDraftRead(drafts, input, async () => 'snapshot', () => {});
  registerCallerBracketedReviewReadSession(review.review, review.scope, async (_input, _current, work) => {
    await work(async caller => { await caller(); await caller(); return 'reviewed'; }, loan);
    try { await readReviewDraft(escaped, drafts, input, drafts.read); } catch { lateDenied = true; }
  });
  await assert.rejects(withReviewReadSession(review, {}, current, async (read, draft) => { escaped = draft; await read(current); }, task => task, () => {}));
  assert.equal(lateDenied, true);
});
