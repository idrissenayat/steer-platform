import { z } from 'zod';

// Exact captured role output; do not trim bytes before preservation or hashing.
const text = (max: number) => z.string().min(1).max(max)
  .refine(v => v.trim().length > 0 && !/[\uD800-\uDFFF]/u.test(v), 'Invalid role output.');
export const intentRoleResultSchema = z.discriminatedUnion('role', [
  z.strictObject({ role: z.literal('architect'), output: z.strictObject({ message: text(2000),
    questions: z.array(text(500)).max(3), brief: text(30000).nullable(), spec: text(30000).nullable(),
  }).superRefine((v, ctx) => {
    if (v.questions.length ? v.brief !== null || v.spec !== null : v.brief === null || v.spec === null)
      ctx.addIssue({ code: 'custom', message: 'Contradictory Architect result.' });
  }) }),
  z.strictObject({ role: z.literal('test-agent'), output: z.strictObject({ exam: text(30000) }) }),
]);
export type IntentRoleResult = z.infer<typeof intentRoleResultSchema>;
