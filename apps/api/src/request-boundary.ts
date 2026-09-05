/** Per-process admission only; trusted ingress must also enforce fleet/socket limits. */
export function createRequestBoundary(handler: (request: Request) => Response | Promise<Response>,
  options: { maxInFlight?: number; burst?: number; requestsPerSecond?: number; clock?: () => number } = {}) {
  const maxInFlight = options.maxInFlight ?? 32;
  const burst = options.burst ?? 120;
  const rate = options.requestsPerSecond ?? 2;
  if (!Number.isSafeInteger(maxInFlight) || maxInFlight < 1 || maxInFlight > 1024 ||
      !Number.isSafeInteger(burst) || burst < 1 || burst > 10000 ||
      !Number.isFinite(rate) || rate <= 0 || rate > 1000) throw new Error('Invalid request limit configuration.');
  const clock = options.clock ?? (() => performance.now());
  let previous = clock(); let tokens = burst; let inFlight = 0;
  if (!Number.isFinite(previous)) throw new Error('Invalid request limit clock.');
  const encoder = new TextEncoder();
  const fail = (status: number, code: string, retry = false) => Response.json({ error: { code, message: 'The request could not be accepted.' } }, {
    status, headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff',
      ...(retry ? { 'retry-after': '1' } : {}) },
  });
  return async (request: Request): Promise<Response> => {
    if (encoder.encode(request.url).byteLength > 8192) return fail(414, 'URI_TOO_LONG');
    let headerBytes = 0;
    for (const [name, value] of request.headers) headerBytes += encoder.encode(name).byteLength + encoder.encode(value).byteLength + 4;
    if (headerBytes > 16384) return fail(431, 'HEADERS_TOO_LARGE');
    const current = clock();
    if (!Number.isFinite(current) || current < previous) return fail(503, 'CAPACITY_UNAVAILABLE', true);
    tokens = Math.min(burst, tokens + (current - previous) * rate / 1000); previous = current;
    if (inFlight >= maxInFlight) return fail(503, 'CAPACITY_UNAVAILABLE', true);
    if (tokens < 1) return fail(429, 'RATE_LIMITED', true);
    if (request.signal.aborted) return fail(408, 'REQUEST_ABORTED');
    tokens--; inFlight++;
    // Keep the lease until actual work settles; a response timeout must not hide running work.
    try { return await handler(request); }
    catch { return fail(500, 'INTERNAL_ERROR'); }
    finally { inFlight--; }
  };
}
