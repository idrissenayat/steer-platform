import { z } from 'zod';
import { intentDraftScopeSchema } from './intent-draft-contracts.ts';
import { intentRoleResultSchema } from './intent-role-result.ts';

const uuid = z.uuid().length(36).refine(v => v === v.toLowerCase());
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/), revision = z.number().int().min(1).max(1000);
export const intentDevelopmentReadInputSchema = intentDraftScopeSchema.extend({ operationId: uuid, inputDigest: digest });
const role = z.enum(['architect', 'test-agent']);
const step = z.strictObject({ role, state: z.enum(['pending', 'claimed', 'dispatch-committed', 'outcome-unknown', 'succeeded', 'failed-known']) });
const result = z.strictObject({ resultRef: uuid, resultDigest: digest, result: intentRoleResultSchema });
export const intentDevelopmentReadOutputSchema = intentDevelopmentReadInputSchema.extend({
  kind: z.literal('steer-development-read/v1'),
  source: z.strictObject({ draftId: uuid, revision, revisionDigest: digest, scopeInputDigest: digest, latestRevision: revision }),
  status: z.enum(['pending', 'needs-clarification', 'candidates-ready', 'attention-required', 'superseded', 'expired']),
  steps: z.tuple([step.extend({ role: z.literal('architect') }), step.extend({ role: z.literal('test-agent') })]).nullable(),
  results: z.array(result).max(2),
  savedToGit: z.literal(false), gateSigned: z.literal(false), executionAuthorized: z.literal(false), retryAuthorized: z.literal(false),
}).superRefine((v, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Inconsistent development observation.' });
  if (v.source.latestRevision < v.source.revision) fail();
  if (v.status === 'expired') { if (v.steps !== null || v.results.length) fail(); return; }
  if (!v.steps) { fail(); return; }
  const roles = v.results.map(r => r.result.role);
  if (new Set(roles).size !== roles.length || (roles.includes('test-agent') && roles[0] !== 'architect')) fail();
  for (const s of v.steps) if ((s.state === 'succeeded') !== roles.includes(s.role)) fail();
  if (v.steps[1].state !== 'pending' && v.steps[0].state !== 'succeeded') fail();
  const architect = v.results.find(r => r.result.role === 'architect')?.result;
  const questions = architect?.role === 'architect' && architect.output.questions.length > 0;
  if (questions && v.steps[1].state !== 'pending') fail();
  const expected = v.source.latestRevision !== v.source.revision ? 'superseded'
    : v.steps.some(s => ['outcome-unknown', 'failed-known'].includes(s.state)) ? 'attention-required'
      : questions ? 'needs-clarification' : roles.length === 2 ? 'candidates-ready' : 'pending';
  if (v.status !== expected) fail();
});
export type IntentDevelopmentReadInput = z.infer<typeof intentDevelopmentReadInputSchema>;
export type IntentDevelopmentReadOutput = z.infer<typeof intentDevelopmentReadOutputSchema>;
/** Trusted current-authority query service. Reading cannot start/retry development. */
export interface IntentDevelopmentReader {
  readonly scope: Readonly<z.infer<typeof intentDraftScopeSchema> & { subject: string }>;
  read(input: IntentDevelopmentReadInput, revalidate: () => Promise<void>): Promise<unknown>;
}
