# Runtime database contract

Expose `createRuntimePool` from `@steer/data/runtime-pool`. Accept strict trusted
host/port/database/password, an exact runtime role (`steer_app`,
`steer_projector`, `steer_auth_runtime`) and explicit transport. TLS requires
supplied CA with certificate verification enabled. Non-TLS mode must be explicitly
`isolated-loopback-test` and only accepts numeric `127.0.0.1`. No arbitrary DSN,
pool settings, SQL options or privileged role is accepted. Errors do not reflect
credentials or supplied configuration. TLS production connectivity remains untested.

Fixed settings: maximum eight connections, at most 32 concurrent pending
acquisitions, two-second driver connection/queue wait, ten-second idle connection
retention, five-minute connection lifetime. Pending overflow/closed/connect
failure yields a generic capacity error. Status exposes only counts and closed
state. Idle-client errors are counted without logging raw provider errors; pg
removes the broken idle client. Shutdown closes admission and drains the pool;
the owner must finish/release active leases before shutdown can complete.

Install server-side `statement_timeout=5000`, `lock_timeout=1000` and
`idle_in_transaction_session_timeout=5000` in startup parameters and fixed,
nonempty options. An empty string would permit pg to inherit `PGOPTIONS`.
Reapply limits on every business-tenant and authentication-namespace transaction
entry before tenant context/role checks. UTF-8 is explicit. Never configure a
client-only query timer as proof that server SQL stopped.

Keep the existing structural pool injection seam for tests/adapters; the pool
factory is the bounded acquisition implementation. Passing an arbitrary raw
pool does not inherit its queue/TLS bounds. Existing tenant/session role guards,
FORCE RLS, transaction-local identity, rollback/cleanup/eviction and confirmed
commit handling remain intact. This is not a sandbox for untrusted SQL callbacks.

Prove eight held connections/32 bounded waiters, excess refusal, queued timeout,
recovery, actual server cancellation of sleep/lock waits, context cleanup,
timeout reapplication after contaminated reuse, and server termination of an
idle transaction. Verify fixed options override a synthetic ambient PGOPTIONS.
Use this factory in the assembled authentication harness and retain browser,
provider and durable-store regression checks.

These settings do not impose a total multi-statement transaction deadline,
cancel arbitrary JavaScript callbacks, bound active-network-blackhole detection,
prove production TLS, authorize retries after uncertain commits or complete
fleet/database capacity planning. Those runtime/operational proofs remain open.
