import { briefPreviewInputSchema, briefPreviewOutputSchema, type BriefPreview } from '@steer/tool-registry/brief-contracts';
import { createReadTransport } from './read-transport.ts';

/** Bound display identity is a comparison, never a grant. Every request authenticates server-side. */
export function createBriefAuthorClient(scope: { organizationId: string; subject: string }, origin: string, transport: typeof fetch = globalThis.fetch) {
  const organizationId = scope.organizationId, subject = scope.subject;
  if (![organizationId, subject].every((value) => typeof value === 'string' && value.length > 0 && value.length <= 200)) throw new Error('Invalid draft scope.');
  const reader = createReadTransport(origin, transport); let closed = false;
  return {
    async preview(draft: unknown): Promise<BriefPreview> {
      try {
        const input = briefPreviewInputSchema.parse({ organizationId, draft });
        const result = briefPreviewOutputSchema.parse(await reader.request('intent.brief.preview', input));
        if (closed || result.organizationId !== organizationId || result.subject !== subject) throw new Error();
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(result.markdown));
        if (closed || [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('') !== result.contentDigest) throw new Error();
        return result;
      } catch { throw new Error('Draft preview could not be verified. Refresh access and try again.'); }
    },
    close() { closed = true; reader.close(); },
  };
}

export const authorFields = [
  { key: 'title', label: 'Working title', help: 'A short label. You can change it.', max: 1000 },
  { key: 'problem', label: 'What is happening now?', help: 'Describe the observed problem.', max: 4000 },
  { key: 'outcome', label: 'What should become true?', help: 'Describe one measurable change.', max: 4000 },
  { key: 'users', label: 'Who is affected?', help: 'One person or group per line.', max: 4000 },
  { key: 'systems', label: 'Which systems are involved?', help: 'One name per line. Names are not verified yet.', max: 4000 },
  { key: 'successMeasure', label: 'How will you know it worked?', help: 'Name a signal, metric or observable evidence.', max: 1000 },
  { key: 'constraints', label: 'What are the constraints?', help: 'One real constraint or deadline per line.', max: 4000 },
  { key: 'openQuestions', label: 'What remains uncertain?', help: 'One open question per line. Leave unknown facts open.', max: 4000 },
] as const;
export type AuthorAnswers = Record<(typeof authorFields)[number]['key'], string>;
export const emptyAuthorAnswers = (): AuthorAnswers => ({ title: '', problem: '', outcome: '', users: '', systems: '', successMeasure: '', constraints: '', openQuestions: '' });
export function authorDraft(answers: AuthorAnswers) {
  const lines = (value: string) => value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  return { ...answers, users: lines(answers.users), systems: lines(answers.systems), constraints: lines(answers.constraints), openQuestions: lines(answers.openQuestions) };
}
