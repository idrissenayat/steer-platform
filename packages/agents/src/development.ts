import { agentInputSchema, agentOutputSchema, agentScopeText, architectOutputSchema, examOutputSchema,
  type IntentAgentService } from '@steer/tool-registry/agent-contracts';
import { recheckIntentDisposition } from '@steer/tool-registry/intent-overlap-contracts';

export interface DevelopmentRuntime {
  generate(role: 'architect' | 'test-agent', source: string, signal: AbortSignal): Promise<unknown>;
}
export interface DevelopmentPermit {
  /** Must atomically reserve the configured worst-case cost before EACH call.
   * A reservation is consumed even after timeout/failure. No refunds or blind retry. */
  reserve(input: { organizationId: string; subject: string; configurationRevision: string; role: 'architect' | 'test-agent' }): Promise<boolean>;
}

/** No memory, filesystem, Git writes or model access at construction. Separate Test Agent context. */
export function createIntentDevelopment(options: {
  organizationId: string; configurationRevision: string; runtime: DevelopmentRuntime; permit: DevelopmentPermit;
}): IntentAgentService {
  if (!options.organizationId || !options.configurationRevision) throw new Error('Agent configuration required.');
  let busy = false;
  return { organizationId: options.organizationId, async develop(raw, subject, revalidate, scopeReview) {
    const input = agentInputSchema.parse(raw);
    const disposition = recheckIntentDisposition(input.disposition, scopeReview);
    if (input.organizationId !== options.organizationId || scopeReview.organizationId !== input.organizationId || !subject || busy) throw new Error('Agent unavailable.');
    busy = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    let abort!: () => void;
    const stopped = new Promise<never>((_, reject) => { abort = () => reject(new Error('Agent request expired.')); });
    controller.signal.addEventListener('abort', abort, { once: true });
    const source = JSON.stringify({ intent: input.intent, clarification: input.clarification, disposition,
      scopeEvidence: scopeReview });
    const call = async (role: 'architect' | 'test-agent', data: string) => {
      controller.signal.throwIfAborted();
      await revalidate();
      if (!await options.permit.reserve({ organizationId: input.organizationId, subject,
        configurationRevision: options.configurationRevision, role })) throw new Error('Agent budget unavailable.');
      await revalidate(); controller.signal.throwIfAborted();
      const result = await options.runtime.generate(role, data, controller.signal);
      controller.signal.throwIfAborted(); await revalidate(); return result;
    };
    const work = async () => {
      const scopeDigest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(agentScopeText(input)))))]
        .map(n => n.toString(16).padStart(2, '0')).join('');
      if (scopeDigest !== scopeReview.sourceDigest) throw new Error('Scope review does not match this intent.');
      const drafted = architectOutputSchema.parse(await call('architect', source));
      const needsClarification = drafted.questions.length > 0;
      // Do not accept contradictory output or fabricate missing documents.
      if (needsClarification ? drafted.brief !== null || drafted.spec !== null : !drafted.brief || !drafted.spec) throw new Error('Invalid agent result.');
      const documents = needsClarification ? null : { brief: drafted.brief!, spec: drafted.spec!,
        exam: examOutputSchema.parse(await call('test-agent', JSON.stringify({ source: JSON.parse(source),
          brief: drafted.brief, spec: drafted.spec }))).exam };
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
      await revalidate(); controller.signal.throwIfAborted();
      return agentOutputSchema.parse({ kind: 'intent-agent-candidate', organizationId: input.organizationId, subject,
        sourceDigest: [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join(''),
        configurationRevision: options.configurationRevision, message: drafted.message, questions: drafted.questions,
        documents, saved: false, gateSigned: false, executionAuthorized: false });
    };
    try { return await Promise.race([work(), stopped]); }
    finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); controller.abort(); busy = false; }
  } };
}
