export class RequestBodyError extends Error {
  readonly reason: 'size' | 'timeout' | 'aborted';
  constructor(reason: 'size' | 'timeout' | 'aborted') { super('Request body rejected.'); this.reason = reason; }
}

/** Bound actual bytes and total read time, including empty or stalled streams. */
export async function readRequestBody(request: Request, maxBytes: number, timeoutMs = 5000): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > 16384 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('Invalid request body limit.');
  if (request.signal.aborted) throw new RequestBodyError('aborted');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  let rejectStop: (cause: Error) => void = () => {};
  const stop = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
  const aborted = () => rejectStop(new RequestBodyError('aborted'));
  request.signal.addEventListener('abort', aborted, { once: true });
  if (request.signal.aborted) aborted();
  const deadline = performance.now() + timeoutMs;
  const timer = setTimeout(() => rejectStop(new RequestBodyError('timeout')), timeoutMs);
  const chunks: Uint8Array[] = []; let bytes = 0; let chunkCount = 0;
  try {
    while (true) {
      if (performance.now() >= deadline) throw new RequestBodyError('timeout');
      const next = await Promise.race([reader.read(), stop]);
      if (next.done) break;
      if (++chunkCount > 16384) throw new RequestBodyError('size');
      bytes += next.value.byteLength;
      if (bytes > maxBytes) throw new RequestBodyError('size');
      if (next.value.byteLength) chunks.push(next.value);
    }
    const result = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } finally {
    clearTimeout(timer); request.signal.removeEventListener('abort', aborted);
    // A malicious stream's cancel promise may never settle; never await it.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
