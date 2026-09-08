import { intentDevelopmentReviewInputSchema, verifyDevelopmentReview, type IntentDevelopmentReviewInput } from '@steer/tool-registry/intent-development-review-contracts';
import { intentDevelopmentPrepareInputSchema, intentDevelopmentPrepareOutputSchema, type IntentDevelopmentPrepareInput } from '@steer/tool-registry/intent-development-prepare-contracts';
import { intentDevelopmentStartInputSchema, intentDevelopmentStartOutputSchema, type IntentDevelopmentStartInput } from '@steer/tool-registry/intent-development-start-contracts';
import { intentDevelopmentReadInputSchema, intentDevelopmentReadOutputSchema, type IntentDevelopmentReadInput } from '@steer/tool-registry/intent-development-read-contracts';

const failure = () => new Error('The agent workflow response could not be verified. Your editor has not been replaced.');
/** Fixed authenticated tools. No browser credentials/storage, automatic writes,
 * provider calls or replacement requests after an uncertain response. */
export function createIntentDevelopmentTransport(origin: string, transport: typeof fetch = fetch) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw failure();
  let closed = false, active: AbortController | null = null;
  async function request(tool: 'review' | 'prepare' | 'start' | 'read', input: unknown): Promise<unknown> {
    if (closed || active) throw failure();
    const body = JSON.stringify(input);
    if (new TextEncoder().encode(body).length > 16384) throw failure();
    const controller = new AbortController(); active = controller;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, response: Response | undefined;
    let rejectAbort: () => void = () => {};
    const interrupted = new Promise<never>((_, reject) => { rejectAbort = () => reject(failure()); });
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    controller.signal.addEventListener('abort', () => { void reader?.cancel().catch(() => {}); }, { once: true });
    const timer = setTimeout(() => controller.abort(), 40000);
    try {
      return await Promise.race([interrupted, (async () => {
        response = await transport(`${origin}/v1/tools/intent.development.${tool}`, { method: 'POST', body,
          credentials: 'same-origin', mode: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
          signal: controller.signal, headers: { accept: 'application/json', 'content-type': 'application/json' } });
        controller.signal.throwIfAborted();
        if (response.status !== 200 || response.redirected || !response.body
          || response.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw failure();
        reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0, count = 0;
        while (true) {
          const { done, value } = await reader.read(); controller.signal.throwIfAborted(); if (done) break;
          bytes += value.length; if (bytes > 600000 || ++count > 10000) throw failure(); chunks.push(value);
        }
        const joined = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)) as unknown;
      })()]);
    } catch { throw failure(); }
    finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', rejectAbort);
      if (!reader) void response?.body?.cancel().catch(() => {});
      controller.abort(); if (active === controller) active = null;
    }
  }
  function bound<I extends object, O extends I>(input: I, output: O): O {
    if (closed || (Object.keys(input) as Array<keyof I>).some(k => JSON.stringify(input[k]) !== JSON.stringify(output[k]))) throw failure();
    return output;
  }
  return {
    close() { closed = true; active?.abort(); },
    async review(raw: IntentDevelopmentReviewInput) {
      const input = intentDevelopmentReviewInputSchema.parse(raw);
      const verified = await verifyDevelopmentReview(input, await request('review', input));
      if (closed) throw failure(); return verified;
    },
    async prepare(raw: IntentDevelopmentPrepareInput) {
      const input = intentDevelopmentPrepareInputSchema.parse(raw);
      return bound(input, intentDevelopmentPrepareOutputSchema.parse(await request('prepare', input)));
    },
    async start(raw: IntentDevelopmentStartInput) {
      const input = intentDevelopmentStartInputSchema.parse(raw);
      return bound(input, intentDevelopmentStartOutputSchema.parse(await request('start', input)));
    },
    async read(raw: IntentDevelopmentReadInput) {
      const input = intentDevelopmentReadInputSchema.parse(raw);
      return bound(input, intentDevelopmentReadOutputSchema.parse(await request('read', input)));
    },
  };
}
export type IntentDevelopmentTransport = ReturnType<typeof createIntentDevelopmentTransport>;
