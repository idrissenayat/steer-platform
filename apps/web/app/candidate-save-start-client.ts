import { candidateSaveStartInputSchema, verifyCandidateSaveStart, type CandidateSaveStartInput } from '@steer/tool-registry/candidate-save-start-contracts';

const fail = () => new Error('Save acknowledgement could not be verified. Check the original save status; do not create another submission.');
/** Dedicated command transport. Never added to the read-only tool allowlist.
 * No automatic retry, browser storage, credentials, provider calls or source text. */
export function createCandidateSaveStartClient(origin: string, transport: typeof fetch = fetch) {
  const home = new URL(origin);
  if (home.protocol !== 'https:' || home.origin !== origin || home.username || home.password) throw fail();
  let closed = false, active: AbortController | null = null;
  return {
    async start(raw: CandidateSaveStartInput) {
      const input = candidateSaveStartInputSchema.parse(raw), body = JSON.stringify(input);
      if (closed || active || new TextEncoder().encode(body).length > 20000) throw fail();
      const controller = new AbortController(); active = controller;
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, response: Response | undefined;
      let abort = () => {};
      const interrupted = new Promise<never>((_, reject) => { abort = () => reject(fail()); });
      controller.signal.addEventListener('abort', abort, { once: true });
      controller.signal.addEventListener('abort', () => { void reader?.cancel().catch(() => {}); }, { once: true });
      const timer = setTimeout(() => controller.abort(), 100000);
      try {
        const output = await Promise.race([interrupted, (async () => {
          response = await transport(`${origin}/v1/tools/intent.candidate.save.start`, { method: 'POST', body,
            credentials: 'same-origin', mode: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
            signal: controller.signal, headers: { accept: 'application/json', 'content-type': 'application/json' } });
          controller.signal.throwIfAborted();
          if (response.status !== 200 || response.redirected || !response.body
            || response.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw fail();
          reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0, count = 0;
          while (true) {
            const { done, value } = await reader.read(); controller.signal.throwIfAborted(); if (done) break;
            bytes += value.length; if (bytes > 50000 || ++count > 10000) throw fail(); chunks.push(value);
          }
          const joined = new Uint8Array(bytes); let offset = 0;
          for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
          return verifyCandidateSaveStart(input, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)));
        })()]);
        if (closed) throw fail(); return output;
      } catch { throw fail(); }
      finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abort);
        if (!reader) void response?.body?.cancel().catch(() => {}); controller.abort(); if (active === controller) active = null; }
    },
    close() { closed = true; active?.abort(); },
  };
}
