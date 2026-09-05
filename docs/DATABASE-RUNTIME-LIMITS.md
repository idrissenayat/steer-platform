# Runtime database limits

Use `@steer/data/runtime-pool` for trusted runtime acquisition. Configure each
business app, projector and authentication role separately. The factory accepts
only explicit host, port, database, runtime role, password and transport. It does
not read a DSN or merge caller-selected driver options. Keep credentials outside
Git and request logs. The current integration supplies generated loopback-only
credentials; no real connection profile is activated.

| Resource | Fixed default |
| --- | --- |
| Connections | 8 per pool |
| Pending acquisitions | 32 per pool, overflow rejected |
| Connection/queue wait | 2 seconds |
| Idle connection / maximum lifetime | 10 seconds / 300 seconds |
| PostgreSQL statement | 5 seconds |
| PostgreSQL lock wait | 1 second |
| Idle transaction session | 5 seconds |

TLS mode requires a supplied CA and `rejectUnauthorized=true`. The only plaintext
mode is explicitly named `isolated-loopback-test` and accepts only `127.0.0.1`.
Production TLS connectivity is not evidenced by the disposable test. Fixed
nonempty startup options block ambient PGOPTIONS from replacing runtime policy;
the driver otherwise treats an empty option string as absent. UTF-8 is explicit.

Tenant and auth namespace helpers reapply the server limits before each
transaction. Existing role checks, RLS, identity expiry, namespace/tenant cleanup,
rollback and bad-client eviction are preserved. A successful COMMIT remains a
success if subsequent cleanup fails; evict that connection, never invent a failed
write to retry. An uncertain COMMIT is not permission for automatic replay.

Pool status is content-free: connection/idle/pending/error counts and closed state.
Monitor it through trusted operational wiring; it is not a public endpoint or
health-ready declaration. Closed pools reject new acquisitions and draining
requires active leases to be returned. Raw Pool injection remains available to
internal tests/adapters, but does not claim the factory's queue/transport bounds.

Server-side cancellation is not a total transaction or active-network deadline.
Many individually bounded statements can still form a long transaction; an
arbitrary trusted callback can stall; a dead network can hide a server result.
Before real activation, define and verify service shutdown, active connection
failure recovery, transaction budgets, safe handling of uncertain commits,
approved secret rotation and production TLS/ingress/capacity settings. Do not
claim client-side promise timeout as proof that PostgreSQL stopped work.

Evidence: `intent/0022/EVIDENCE.md`. No spending, deployment, real memberships,
database credentials or gate approval is authorized by these defaults.

## Connection failure and explicit shutdown (0023)

The bounded pool tracks active leases and attaches an error listener while each
client is borrowed. A failure between queries cannot escape through an unhandled
client error; the pool counts it and destroys that client on release. Status now
also reports active leases, active errors and forced-release counts, without
query/credential content.

`end()` shares a graceful drain promise. `shutdown()` is an explicit service-owner
operation: stop admission immediately, drain five seconds, then evict owned
remaining leases. Its shared promise follows the actual pool drain; late cleanup
after a forced release is safe. The five seconds is a grace interval, not proof
that every OS/network closure finishes within a universal deadline. Future
service startup/shutdown wiring must distinguish those states.

If business COMMIT was sent but cannot be confirmed, `withTenant` returns a
`DatabaseCommitOutcomeUnknownError`. A best-effort ROLLBACK cannot establish that
COMMIT failed. Do not retry automatically or present the write as rolled back.
Reconcile using the operation's exact durable/idempotent identity before deciding
what to do. A confirmed COMMIT remains successful if later cleanup fails.
Authentication storage retains generic failure and no automatic replay.

The integration test actually commits one synthetic row while a loopback relay
drops the server acknowledgement. Only the independent test observer sees that
row; the caller remains uncertain and is disconnected by explicit shutdown.
This proves the no-retry/unknown-outcome path, not a production network detector.
Evidence: `intent/0023/EVIDENCE.md`.
