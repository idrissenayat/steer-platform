import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyAuthorAnswers } from '../app/brief-author-client.ts';
import { localDraftPrefix, localIntentLimit, draftIntent, parseLocalDraft, readLocalDrafts, saveLocalDraft, removeLocalDraft, missingLocalFields } from '../app/local-drafts.ts';

const sample = (title = 'Sample') => ({ version: 1, id: 'local-11111111-1111-4111-8111-111111111111', updatedAt: '2026-09-07T12:00:00.000Z', answers: { ...emptyAuthorAnswers(), title } });
function storage() {
  const values = new Map();
  return { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test('local draft saves, reopens and updates exact content without introducing authority', () => {
  const store = storage(), first = sample('<script>sample</script>');
  const raw = saveLocalDraft(store, first, null);
  assert.deepEqual(readLocalDrafts(store), { drafts: [first], skipped: 0 });
  assert.deepEqual(parseLocalDraft(raw), first); assert.equal(missingLocalFields(first.answers).length, 7);
  const revised = { ...first, answers: { ...first.answers, outcome: 'Corrected outcome' } };
  saveLocalDraft(store, revised, raw);
  assert.deepEqual(readLocalDrafts(store).drafts, [revised]);
  assert.deepEqual(Object.keys(revised).sort(), ['answers', 'id', 'updatedAt', 'version']);
});
test('malformed, oversized, unknown-version, forged-authority and mis-keyed drafts stay untouched', () => {
  const store = storage();
  const bad = ['{', JSON.stringify({ ...sample(), version: 3 }), JSON.stringify({ ...sample(), signed: true }),
    JSON.stringify({ ...sample(), id: [sample().id] }), JSON.stringify({ ...sample(), updatedAt: 'invalid' }),
    JSON.stringify({ ...sample(), answers: { ...sample().answers, title: 'x'.repeat(1001) } }),
    JSON.stringify({ ...sample(), answers: { title: 'missing fields' } }), ' '.repeat(800001)];
  bad.forEach((raw, i) => { store.setItem(localDraftPrefix + i, raw); assert.throws(() => parseLocalDraft(raw)); });
  store.setItem(localDraftPrefix + 'wrong-id', JSON.stringify(sample()));
  store.setItem('unrelated-app', 'do not touch');
  assert.deepEqual(readLocalDrafts(store), { drafts: [], skipped: bad.length + 1 });
  assert.equal(store.length, bad.length + 2);
});
test('free-text format preserves long exact intent and old Brief answers without automatic migration', () => {
  const store = storage(), old = sample();
  const oldRaw = saveLocalDraft(store, old, null);
  assert.equal(draftIntent(readLocalDrafts(store).drafts[0]), '');
  assert.equal(store.getItem(localDraftPrefix + old.id), oldRaw);
  const intent = 'Ideas, not a questionnaire.\n\n<script>literal</script> 🧭\t'.repeat(1000);
  const next = { ...old, version: 2, intent };
  const raw = saveLocalDraft(store, next, oldRaw);
  assert.equal(draftIntent(parseLocalDraft(raw)), intent);
  assert.deepEqual(parseLocalDraft(raw).answers, old.answers);
  assert.throws(() => saveLocalDraft(store, next, oldRaw), /another tab/);
  for (const invalid of [{ ...next, intent: undefined }, { ...next, intent: 2 }, { ...next, intent: 'x'.repeat(localIntentLimit + 1) }, { ...next, signed: true }]) {
    assert.throws(() => parseLocalDraft(JSON.stringify(invalid)));
  }
  assert.equal(draftIntent(parseLocalDraft(JSON.stringify({ ...next, intent: 'x'.repeat(localIntentLimit) }))).length, localIntentLimit);
});
test('stale writes and removals reject; distinct drafts and unrelated keys are preserved', () => {
  const store = storage(), first = sample();
  const before = saveLocalDraft(store, first, null);
  const second = { ...sample('Second'), id: 'local-22222222-2222-4222-8222-222222222222' };
  const secondRaw = saveLocalDraft(store, second, null);
  const current = saveLocalDraft(store, sample('Other tab edit'), before);
  assert.throws(() => saveLocalDraft(store, first, before), /another tab/);
  assert.throws(() => removeLocalDraft(store, first.id, before), /another tab/);
  store.setItem('unrelated-app', 'kept');
  removeLocalDraft(store, first.id, current);
  assert.equal(store.getItem(localDraftPrefix + second.id), secondRaw);
  assert.equal(store.getItem('unrelated-app'), 'kept');
});
test('quota, denied reads and unconfirmed writes never report successful persistence', () => {
  const store = storage();
  assert.throws(() => saveLocalDraft({ ...store, setItem() { throw new Error('quota'); } }, sample(), null));
  assert.throws(() => saveLocalDraft({ ...store, setItem() {} }, sample(), null), /could not confirm/);
  assert.throws(() => readLocalDrafts({ get length() { throw new Error('denied'); } }));
});
