# Resource contract

Use an explicit per-process boundary around default CLI requests and the
Git-backed browser/bearer composition. Default admission limits: 32 active
handlers, global token bucket burst 120/refill 2 requests per second, URL 8 KiB,
parsed headers 16 KiB. Refuse excess concurrency with 503, rate with 429, URL with
414 and headers with 431 before dispatch. Include generic no-store responses and
Retry-After on overload. Never derive caller identity from forwarded headers.
No per-client map or unbounded limiter keys. Validate trusted startup limits.

Use monotonic time; invalid/backwards clocks deny. Hold concurrency until actual
handler completion, including errors. Do not release a lease merely because a
response timeout fired while provider or database work continues. Streaming
response resource management and distributed admission are not supplied here.

Bound actual request-body bytes, not Content-Length: tool JSON 16 KiB; native
login/logout require zero bytes. Read deadline is five seconds total, with
disconnect handling. Cap chunks at 16,384, avoid storing empty chunks and check
elapsed monotonic time inside the loop, so endlessly ready empty chunks cannot
starve the deadline or create unbounded retained promises. Cancel rejected streams
without waiting on an untrusted cancellation promise; release listeners/locks.
Tool size errors remain 413, timeout/disconnect 408, malformed UTF-8/JSON 400.
Login/logout body failures stay generic 400 and create no auth state.

Default loopback HTTP server explicitly sets parser headers to 16 KiB, header
deadline 5 s, request receive deadline 10 s, checking interval 1 s, keep-alive
5 s, 100 requests/socket and 128 concurrent sockets. Disable silent header-count
truncation; the parser byte limit is the bound. Do not mistake Node's receive
deadline for an application/database execution deadline.

Test active-work accounting, rate refill, invalid clocks/configuration, no
forwarding bypass, URL/header rejection, body overflow/stall/disconnect/empty
chunks, generic errors and a spawned local server's actual 431/408 responses.
Re-run real browser/provider/session/Git integration and root checks.

These are instance safety defaults, not load-tested pilot capacity or a fleet
abuse-prevention service. A trusted public ingress must enforce TLS, canonical
origin, fleet/client rates, socket limits and sensitive-log redaction. Backend
pool/statement/lock deadlines and approved runtime settings remain prerequisites.
No live activation, spending, real membership or signed-gate change.
