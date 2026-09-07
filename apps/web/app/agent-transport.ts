import { agentInputSchema, agentOutputSchema, type AgentInput } from '@steer/tool-registry/agent-contracts';

/** Billable command transport is deliberately separate from read-only preview transport. No retries. */
export function createAgentTransport(origin: string, transport: typeof fetch = fetch) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new Error('Secure workspace required.');
  let active: AbortController | undefined; let closed = false;
  return {
    close() { closed = true; active?.abort(); },
    async develop(input: AgentInput) {
      if (closed || active) throw new Error('An agent request is already running or this session has closed.');
      const body = JSON.stringify(agentInputSchema.parse(input));
      if (new TextEncoder().encode(body).length > 16384) throw new Error('This message is too large. Shorten it before sending.');
      const controller = new AbortController(); active = controller;
      const timer = setTimeout(() => controller.abort(), 100000);
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const response = await transport(`${origin}/v1/tools/intent.agent.develop`, { method: 'POST', credentials: 'same-origin',
          mode: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
          headers: { accept: 'application/json', 'content-type': 'application/json' }, body });
        if (response.status === 401) throw new Error('Your session ended. Sign in again before continuing.');
        if (response.status === 403) throw new Error('Agent access is not enabled for your workspace account yet.');
        if (response.status === 503) throw new Error('The agent could not complete this request. Its connection or model budget may be unavailable. Your text is still here; no documents were saved.');
        if (response.status !== 200 || response.redirected || !response.body ||
            response.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw new Error('The agent returned an unexpected response. Your text is still here.');
        reader = response.body.getReader(); let bytes = 0; let count = 0; const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read(); controller.signal.throwIfAborted();
          if (done) break;
          bytes += value.length;
          if (bytes > 600000 || ++count > 10000) throw new Error('The agent response exceeded the allowed size.');
          chunks.push(value);
        }
        const joined = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
        return agentOutputSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)));
      } finally {
        clearTimeout(timer); controller.abort();
        if (reader) { void reader.cancel().catch(() => {}); }
        if (active === controller) active = undefined;
      }
    },
  };
}
