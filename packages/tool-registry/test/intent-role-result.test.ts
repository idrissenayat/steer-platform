import assert from 'node:assert/strict';
import test from 'node:test';
import { intentRoleResultSchema } from '../src/intent-role-result.ts';
test('captured role outputs preserve exact Unicode and never accept extra authority or another role document', () => {
  const result = { role: 'architect', output: { message: ' Ready 🌸 ', questions: [], brief: ' # Brief\r\n', spec: '# Spec\n ' } };
  assert.deepEqual(intentRoleResultSchema.parse(result), result);
  for (const patch of [{ approved: true }, { output: { ...result.output, exam: '# Exam' } },
    { output: { ...result.output, brief: '\ud800' } }, { output: { ...result.output, brief: ' ' } }])
    assert.throws(() => intentRoleResultSchema.parse({ ...result, ...patch }));
  assert.throws(() => intentRoleResultSchema.parse({ role: 'test-agent', output: result.output }));
});
test('Architect clarification has no fabricated documents and a completed response needs both drafts', () => {
  const result = { role: 'architect', output: { message: 'One question', questions: ['Which users?'], brief: null, spec: null } };
  assert.deepEqual(intentRoleResultSchema.parse(result), result);
  for (const patch of [{ brief: '# Brief' }, { questions: [] }, { questions: Array(4).fill('Question') }])
    assert.throws(() => intentRoleResultSchema.parse({ ...result, output: { ...result.output, ...patch } }));
});
