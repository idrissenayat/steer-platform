# API request resource limits

The default loopback CLI and `createGitBackedBrowserApi` use a fixed-size,
per-process admission boundary. Lower-level `createApi` and `createBrowserApi`
remain composition primitives, not complete public ingress runtimes.

| Layer | Implemented default |
| --- | --- |
| Admission | 32 in-flight handlers; burst 120; refill 2 requests/s, global per instance |
| Request shape | URL 8 KiB; parsed headers 16 KiB |
| Body | 16 KiB tool JSON; zero-byte login/logout; 5 s total read; at most 16,384 chunks |
| Local HTTP parser | 16 KiB raw header limit, no silent header-count truncation |
| Local HTTP receive | 5 s headers, 10 s request, 1 s deadline checking interval |
| Local HTTP sockets | 5 s keep-alive, 100 requests/socket, 128 concurrent sockets |

Concurrency is released only when the actual handler settles, not when a cosmetic
response deadline fires. Source/DB work cannot escape the limit by running behind
an already returned timeout. There is no per-IP cache, trusted forwarding identity
or distributed limiter. Limits apply to all routes, including health and login;
readiness remains 503 even after the identity composition is constructed.

Rate rejection is 429, concurrency unavailable 503, oversized URL 414 and headers
431. Admission errors are generic/no-store with Retry-After for overload.
Application tool-body size errors are 413; stalled/disconnected bodies 408;
invalid UTF-8/JSON 400. Auth mutation body failures remain generic 400.
Node parser/receive errors are transport-generated and contain no application
credentials. Header/request timeouts cover receiving, not database execution.

These limits are not proof of production capacity or fleet-level abuse resistance.
Before activation, configure/verify trusted TLS ingress and canonical URL handling,
fleet/client rate controls, socket receive limits, callback/cookie/credential log
redaction, bounded DB pools/statements/locks, operational health recovery and the
approved runtime membership/key binding. Do not invent an IP address from request
headers or silently add a distributed cache contrary to the architecture triggers.
The current response handlers are buffered; future SSE/streaming needs its own
connection/backpressure budget and cancellation lifecycle before being enabled.

Increment 0022 supplies bounded database acquisition plus server-side statement,
lock and idle-transaction limits; see `DATABASE-RUNTIME-LIMITS.md`. Active network
failure and total transaction/shutdown budgets still require separate proof.

Evidence: `intent/0021/EVIDENCE.md`. These defaults authorize no deployment,
spending, actual membership, provider writes or gate decision.
