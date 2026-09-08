import assert from 'node:assert/strict';
import test from 'node:test';
import { describeIntentDraftRevision, intentDraftContentSchema } from '../src/intent-draft-content.ts';
const scope = { organizationId: 'org', productId: 'product', repository: 'github:52', draftId: '11111111-1111-4111-8111-111111111111' };
const initial = { originalText: '  Human intent 🌸\r\n', clarificationTurns: [' Keep this spacing. '], documents: { brief: '# Brief\n', spec: '# Spec\n', exam: '# Exam\n' } };
test('editable snapshots preserve exact source and documents without accepting review, authorship or save claims', () => {
  assert.deepEqual(intentDraftContentSchema.parse(initial), initial);
  for (const patch of [{ saved: true }, { gateSigned: true }, { originals: initial.documents }, { generationOperation: scope.draftId }])
    assert.throws(() => intentDraftContentSchema.parse({ ...initial, ...patch }));
  assert.throws(() => intentDraftContentSchema.parse({ ...initial, originalText: '\ud800' }));
  assert.deepEqual(intentDraftContentSchema.parse({ originalText: '', clarificationTurns: [], documents: null }), { originalText: '', clarificationTurns: [], documents: null });
});
test('source clocks change only for original/clarification edits while Brief/Spec bytes change scope and Exam bytes do not', async () => {
  const first = await describeIntentDraftRevision(scope, initial, null); assert.equal(first.sourceRevision, 1);
  const exam = await describeIntentDraftRevision(scope, { ...initial, documents: { ...initial.documents, exam: '# Edited Exam\n' } }, first);
  assert.equal(exam.sourceRevision, 1); assert.equal(exam.scopeInputDigest, first.scopeInputDigest);
  const spec = await describeIntentDraftRevision(scope, { ...initial, documents: { ...initial.documents, spec: '# Edited Spec\n' } }, first);
  assert.equal(spec.sourceRevision, 1); assert.notEqual(spec.scopeInputDigest, first.scopeInputDigest);
  const changed = await describeIntentDraftRevision(scope, { ...initial, clarificationTurns: [...initial.clarificationTurns, 'A reply'] }, first);
  assert.equal(changed.sourceRevision, 2);
  const undo = await describeIntentDraftRevision(scope, initial, changed); assert.equal(undo.sourceRevision, 3);
  assert.notEqual(undo.scopeInputDigest, first.scopeInputDigest);
});
