import { intentScopePrepareInputSchema, intentScopePrepareOutputSchema, type IntentScopePrepareInput } from '@steer/tool-registry/intent-scope-prepare-contracts';
import { intentScopeStartInputSchema, intentScopeStartOutputSchema, type IntentScopeStartInput } from '@steer/tool-registry/intent-scope-start-contracts';
import { intentScopeReadInputSchema, verifyIntentScopeReadOutput, type IntentScopeReadInput } from '@steer/tool-registry/intent-scope-read-contracts';
import { intentScopeDiscoveryInputSchema, intentScopeDiscoveryOutputSchema, type IntentScopeDiscoveryInput } from '@steer/tool-registry/intent-scope-discovery-contracts';
import { intentScopeHistoryInputSchema, verifyIntentScopeHistoryOutput, type IntentScopeHistoryInput } from '@steer/tool-registry/intent-scope-history-contracts';

const failure = () => new Error('Scope review could not be verified. Your draft is unchanged.');
/** Fixed authenticated scope tools only. No source bytes, provider access,
 * browser storage, implicit retries or alternate application endpoint. */
export function createIntentScopeTransport(origin: string, transport: typeof fetch = fetch) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw failure();
  let closed = false, active: AbortController | null = null;
  async function request(tool: 'prepare' | 'start' | 'read' | 'discover' | 'history', input: unknown): Promise<unknown> {
    if (closed || active) throw failure();
    const body = JSON.stringify(input);
    if (new TextEncoder().encode(body).length > 16384) throw failure();
    const controller = new AbortController(); active = controller;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, response: Response | undefined, complete = false;
    let cleanup: Promise<unknown> | undefined;
    const cancel = () => cleanup ??= (reader ? reader.cancel() : response?.body?.cancel() ?? Promise.resolve()).catch(() => {});
    let interrupt!: () => void;
    const interrupted = new Promise<never>((_, reject) => { interrupt = () => { if (reader || response) void cancel(); reject(failure()); }; });
    controller.signal.addEventListener('abort', interrupt, { once: true });
    const timer = setTimeout(() => controller.abort(), 40000);
    const work = (async () => {
      try {
        response = await transport(`${origin}/v1/tools/intent.scope.${tool}`, { method: 'POST', body,
          credentials: 'same-origin', mode: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
          signal: controller.signal, headers: { accept: 'application/json', 'content-type': 'application/json' } });
        controller.signal.throwIfAborted();
        if (response.status !== 200 || response.redirected || !response.body
          || response.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw failure();
        reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0, count = 0;
        while (true) {
          const next = await reader.read(); controller.signal.throwIfAborted();
          if (next.done) { complete = true; break; }
          bytes += next.value.length;
          if (bytes > (tool === 'read' || tool === 'history' ? 4100000 : 16384) || ++count > 10000) throw failure();
          chunks.push(next.value);
        }
        const joined = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)) as unknown;
      } finally {
        if (!complete) await cancel();
      }
    })();
    void work.finally(() => { if (active === controller) active = null; }).catch(() => {});
    try { return await Promise.race([work, interrupted]); }
    catch { throw failure(); }
    finally { clearTimeout(timer); controller.signal.removeEventListener('abort', interrupt); controller.abort(); }
  }
  function bound<I extends object, O extends I>(input: I, output: O): O {
    if (closed || (Object.keys(input) as Array<keyof I>).some(k => output[k] !== input[k])) throw failure();
    return output;
  }
  return {
    close() { closed = true; active?.abort(); },
    async history(raw: IntentScopeHistoryInput) {
      const input = intentScopeHistoryInputSchema.parse(raw);
      return bound(input, await verifyIntentScopeHistoryOutput(await request('history', input)));
    },
    async discover(raw: IntentScopeDiscoveryInput) {
      const input = intentScopeDiscoveryInputSchema.parse(raw);
      return bound(input, intentScopeDiscoveryOutputSchema.parse(await request('discover', input)));
    },
    async prepare(raw: IntentScopePrepareInput) {
      const input = intentScopePrepareInputSchema.parse(raw);
      return bound(input, intentScopePrepareOutputSchema.parse(await request('prepare', input)));
    },
    async start(raw: IntentScopeStartInput) {
      const input = intentScopeStartInputSchema.parse(raw);
      return bound(input, intentScopeStartOutputSchema.parse(await request('start', input)));
    },
    async read(raw: IntentScopeReadInput) {
      const input = intentScopeReadInputSchema.parse(raw);
      return bound(input, await verifyIntentScopeReadOutput(await request('read', input)));
    },
  };
}
export type IntentScopeTransport = ReturnType<typeof createIntentScopeTransport>;
