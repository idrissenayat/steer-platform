/** Mutation-only transport. A timeout/abort is uncertainty, never evidence of rollback. */
export function createBriefSubmitTransport(origin: string, transport: typeof fetch = globalThis.fetch) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new Error('Invalid submission origin.');
  let closed = false, active: AbortController | undefined;
  return {
    async submit(input: unknown): Promise<unknown> {
      if (closed || active) throw new Error('Submission unavailable.');
      const body = JSON.stringify(input);
      if (new TextEncoder().encode(body).byteLength > 16384) throw new Error('Submission unavailable.');
      const controller = new AbortController(); active = controller;
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, reject!: () => void;
      const aborted = new Promise<never>((_, fail) => { reject = () => fail(new Error('Submission outcome unavailable.')); });
      const cancel = () => { reject(); void reader?.cancel().catch(() => {}); };
      controller.signal.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(() => controller.abort(), 10000);
      const work = async () => {
        const response = await transport(`${origin}/v1/tools/intent.brief.save`, { method: 'POST', credentials: 'same-origin', mode: 'same-origin',
          redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
          headers: { accept: 'application/json', 'content-type': 'application/json' }, body });
        if (controller.signal.aborted || response.status !== 200 || response.redirected || !response.body ||
          response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
          void response.body?.cancel().catch(() => {}); throw new Error();
        }
        reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0, count = 0;
        while (true) {
          const { done, value } = await reader.read(); if (controller.signal.aborted) throw new Error(); if (done) break;
          bytes += value.byteLength; if (++count > 1024 || bytes > 65536) throw new Error(); chunks.push(value);
        }
        const result = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(result)) as unknown;
      };
      try { return await Promise.race([work(), aborted]); }
      catch { throw new Error('Submission outcome unavailable.'); }
      finally {
        clearTimeout(timer); controller.signal.removeEventListener('abort', cancel); controller.abort();
        if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
        if (active === controller) active = undefined;
      }
    },
    close() { closed = true; active?.abort(); },
  };
}
