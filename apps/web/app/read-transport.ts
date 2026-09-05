const tools = ['projection.snapshot.read', 'projection.changes.read', 'intent.brief.catalog', 'intent.brief.read'] as const;
const TIMEOUT_MS = 10000;
/** Fixed, read-only same-origin endpoints. Scope is input, never authority or a URL. */
export function createReadTransport(origin: string, transport: typeof fetch = globalThis.fetch) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new Error('Invalid browser origin.');
  let closed = false; let active: AbortController | undefined;
  const request = async (name: (typeof tools)[number], input: unknown): Promise<unknown> => {
    if (closed || active || !tools.includes(name)) throw new Error('Reference request unavailable.');
    const controller = new AbortController(); active = controller;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const failure = () => new Error('References could not be verified. Refresh access and try again.');
    let rejectAbort!: (reason: Error) => void;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const abort = () => { rejectAbort(failure()); void reader?.cancel().catch(() => {}); };
    controller.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const work = async () => {
      const body = JSON.stringify(input);
      if (new TextEncoder().encode(body).byteLength > 16384) throw failure();
      const response = await transport(`${origin}/v1/tools/${name}`, { method: 'POST', credentials: 'same-origin',
        mode: 'same-origin', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
        headers: { accept: 'application/json', 'content-type': 'application/json' }, body });
      if (controller.signal.aborted || response.status !== 200 || response.redirected || !response.body ||
          response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
        void response.body?.cancel().catch(() => {}); throw failure();
      }
      reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let bytes = 0; let count = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (controller.signal.aborted) throw failure();
        if (done) break;
        bytes += value.byteLength;
        // A Brief response contains original content and section bodies, with JSON escaping.
        if (++count > 16384 || bytes > (name === 'intent.brief.read' ? 8 : 4) * 1024 * 1024) throw failure();
        if (value.byteLength) chunks.push(value);
      }
      const value = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { value.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value)) as unknown;
    };
    try { return await Promise.race([work(), aborted]); }
    catch { throw failure(); }
    finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', abort); controller.abort();
      if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (active === controller) active = undefined;
    }
  };
  return { request, close() { closed = true; active?.abort(); } };
}
