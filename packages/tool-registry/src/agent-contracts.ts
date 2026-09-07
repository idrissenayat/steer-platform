import { z } from 'zod';
import { intentDispositionProposalSchema, type IntentOverlapOutput } from './intent-overlap-contracts.ts';

/** Portable contracts: source is untrusted data; generated artifacts are never gate evidence. */
export const agentInputSchema = z.strictObject({
  organizationId: z.string().min(1).max(200),
  intent: z.string().min(1).max(10000).refine(value => value.trim().length > 0),
  clarification: z.string().max(3000).default(''),
  disposition: intentDispositionProposalSchema,
});
export function agentScopeText(input: { intent: string; clarification: string }) {
  return input.clarification ? `${input.intent}\n\nClarification:\n${input.clarification}` : input.intent;
}
const markdown = z.string().trim().min(1).max(30000);
export const architectOutputSchema = z.strictObject({
  message: z.string().min(1).max(2000),
  questions: z.array(z.string().min(1).max(500)).max(3),
  brief: markdown.nullable(),
  spec: markdown.nullable(),
});
export const examOutputSchema = z.strictObject({ exam: markdown });
export const agentOutputSchema = z.strictObject({
  kind: z.literal('intent-agent-candidate'),
  organizationId: z.string().min(1).max(200), subject: z.string().min(1).max(200),
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/), configurationRevision: z.string().min(1).max(200),
  message: z.string().min(1).max(2000), questions: z.array(z.string().min(1).max(500)).max(3),
  documents: z.strictObject({ brief: markdown, spec: markdown, exam: markdown }).nullable(),
  saved: z.literal(false), gateSigned: z.literal(false), executionAuthorized: z.literal(false),
});
export type AgentInput = z.infer<typeof agentInputSchema>;
export type AgentOutput = z.infer<typeof agentOutputSchema>;
export interface IntentAgentService {
  readonly organizationId: string;
  develop(input: AgentInput, subject: string, revalidate: () => Promise<void>, scopeReview: IntentOverlapOutput): Promise<AgentOutput>;
}
