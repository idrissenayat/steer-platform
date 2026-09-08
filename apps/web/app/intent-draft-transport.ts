import {
  intentDraftCreateInputSchema, intentDraftCreateOutputSchema,
  intentDraftAppendInputSchema, intentDraftAppendOutputSchema,
  intentDraftReadInputSchema, intentDraftReadOutputSchema,
  type IntentDraftCreateInput, type IntentDraftAppendInput, type IntentDraftReadInput,
} from '@steer/tool-registry/intent-draft-contracts';
import { fingerprintIntentScope } from '@steer/tool-registry/intent-revision-contracts';
import { intentDraftDiscoveryInputSchema, intentDraftDiscoveryOutputSchema, type IntentDraftDiscoveryInput } from '@steer/tool-registry/intent-draft-discovery-contracts';

const failure = () => new Error('Draft request could not be verified. Your current text has not been replaced.');
/** Same-origin authenticated storage only. No model calls, retries, browser storage or credentials. */
export function createIntentDraftTransport(origin: string, transport: typeof fetch = fetch) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw failure();
  let active: AbortController | null = null, closed = false;
  async function request(tool: string, input: unknown, maximum: number): Promise<unknown> {
    if (closed || active) throw failure();
    const body = JSON.stringify(input);
    if (new TextEncoder().encode(body).length > maximum) throw new Error('This draft exceeds the request size limit. Shorten it before preserving it.');
    const controller = new AbortController(); active = controller;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let response: Response | undefined;
    const abort = () => { void reader?.cancel().catch(() => {}); };
    controller.signal.addEventListener('abort', abort, { once: true });
    let rejectAbort: () => void = () => {};
    const interrupted = new Promise<never>((_, reject) => { rejectAbort = () => reject(failure()); });
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), 40000);
    try {
      return await Promise.race([interrupted, (async () => {
        response = await transport(`${origin}/v1/tools/intent.draft.${tool}`, { method: 'POST', credentials: 'same-origin',
          mode: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
          headers: { accept: 'application/json', 'content-type': 'application/json' }, body });
        controller.signal.throwIfAborted();
        // A denial after a write is not rollback proof. The controller retains the exact request for recovery.
        if (response.status === 401 || response.status === 403) throw new Error('Draft access needs reauthorization. A sent revision may have been preserved; do not create a replacement request.');
        if (response.status !== 200 || response.redirected || !response.body ||
          response.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw failure();
        reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0, count = 0;
        while (true) {
          const { done, value } = await reader.read(); controller.signal.throwIfAborted();
          if (done) break;
          bytes += value.length;
          if (bytes > 600000 || ++count > 10000) throw failure();
          chunks.push(value);
        }
        const joined = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)) as unknown;
      })()]);
    } finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', rejectAbort);
      if (!reader) void response?.body?.cancel().catch(() => {});
      controller.abort(); if (active === controller) active = null;
    }
  }
  return {
    close() { closed = true; active?.abort(); },
    async discover(raw: IntentDraftDiscoveryInput) {
      const input = intentDraftDiscoveryInputSchema.parse(raw);
      const output = intentDraftDiscoveryOutputSchema.parse(await request('discover', input, 16384));
      if (closed || (['organizationId', 'productId', 'repository', 'cursor'] as const).some(k => JSON.stringify(input[k]) !== JSON.stringify(output[k]))) throw failure();
      return output;
    },
    async create(raw: IntentDraftCreateInput) {
      const input = intentDraftCreateInputSchema.parse(raw);
      const output = intentDraftCreateOutputSchema.parse(await request('create', input, 16384));
      if (closed) throw failure();
      if (output.outcome === 'created' && (output.requestId !== input.requestId ||
        Date.parse(output.createdAt) >= Date.parse(output.useUntil) || Date.parse(output.useUntil) > Date.parse(output.retentionDeadline))) throw failure();
      return output;
    },
    async append(raw: IntentDraftAppendInput) {
      const input = intentDraftAppendInputSchema.parse(raw);
      const output = intentDraftAppendOutputSchema.parse(await request('append', input, 262144));
      if (output.outcome === 'acknowledged') {
        const scope = await fingerprintIntentScope({ organizationId: input.organizationId, productId: input.productId,
          repository: input.repository, draftId: input.draftId, sourceRevision: output.sourceRevision,
          originalText: input.content.originalText, clarificationTurns: input.content.clarificationTurns,
          documents: input.content.documents ? { brief: input.content.documents.brief, spec: input.content.documents.spec } : null,
        });
        if (output.draftId !== input.draftId || output.mutationId !== input.mutationId || output.revision !== input.expectedRevision + 1 || output.scopeInputDigest !== scope.scopeInputDigest) throw failure();
      }
      if (closed) throw failure(); return output;
    },
    async read(raw: IntentDraftReadInput) {
      const input = intentDraftReadInputSchema.parse(raw);
      const output = intentDraftReadOutputSchema.parse(await request('read', input, 16384));
      const scope = await fingerprintIntentScope({ organizationId: input.organizationId, productId: input.productId,
        repository: input.repository, draftId: input.draftId, sourceRevision: output.sourceRevision,
        originalText: output.content.originalText, clarificationTurns: output.content.clarificationTurns,
        documents: output.content.documents ? { brief: output.content.documents.brief, spec: output.content.documents.spec } : null });
      if (closed || output.draftId !== input.draftId || (input.revision !== 'latest' && output.revision !== input.revision) || output.scopeInputDigest !== scope.scopeInputDigest) throw failure();
      return output;
    },
  };
}
export type IntentDraftTransport = ReturnType<typeof createIntentDraftTransport>;
