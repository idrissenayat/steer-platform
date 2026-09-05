# Worker-process recovery and service lifecycle

Increment 0038 adds createWorkerService, an SDK-independent owner of explicit
worker startup, projection-runtime drain and native connection closure. It
accepts a lazy createWorker factory, runtime.shutdown and closeConnection.
No process is automatically spawned by production code, no environment is read,
and no real cluster or default CLI is activated.

## Lifecycle contract

start returns the long-lived completion promise, not a readiness promise. It
constructs/runs once; repeated start/stop calls share that completion. Status is
idle, starting, running, stopping, stopped or failed. None indicates a gate or
production health approval.

Stopping an idle service closes its owned runtime/connection without creating a
worker. If construction is already pending, it must finish and the resulting
worker must be run/stopped before cleanup: the installed Temporal SDK permits
shutdown only in RUNNING state. A caller must not preallocate an SDK Worker and
hide it behind the lazy factory, or it would own an untracked pre-start resource.

Normal shutdown stops the worker, awaits its actual run completion, then awaits
the projection job/pool and finally the connection. Failure still attempts the
remaining ordered cleanup and leaves a generic failed result. A stop error does
not fabricate completion while run remains pending. Uncooperative external work
can delay cleanup; this service adds no rollback, cancellation or forced-drain
guarantee beyond the existing components.

The process fixture owns SIGTERM handling and disables the SDK's automatic
signal hook to avoid two competing shutdown owners. Production supervisors must
likewise choose a single signal/lifecycle owner and separately configure their
termination budget. This is not a production supervisor deployment.

## Actual process verification

The integration forks Node 24.20.0 with a minimal PATH/TMPDIR environment and
receives only generated fixture configuration over IPC. No provider credential
environment is inherited and no database password is passed in command arguments.
The child opens its own Temporal connection, bounded PostgreSQL runtime and a
read-only Git fixture reader, checking current committed grants for a fixed
synthetic subject. Output is bounded and only content-free lifecycle messages
are reported. No real App key, user profile or production account is touched.

The parent kills only its owned child with SIGKILL during a durable timer, verifies
termination, then starts a different PID. The same Temporal run completes with
exact Git artifact readback and unchanged ingestion count. Another test revokes
the grant while the first process is dead and verifies the replacement refuses
the next activity. SIGTERM of healthy replacements exits zero and acknowledges
service stopped, projection pool closed and native connection closed.

These crashes occur between acknowledged activities. They do not test death
during SQL/COMMIT, lost activity completion acknowledgement, multiple competing
workers, Temporal server loss, database restore or real identity/provider binding.
Automatic activity retries remain disabled. The surviving test server uses
in-memory persistence, so the test must not be called cluster durability proof.

Run pnpm test:workflow:integration. Evidence: intent/0038/EVIDENCE.md. Next work:
explicit scheduling/queue authority and source-derived gate waits/cursors, with
active-activity/fleet and server recovery remaining distinct requirements. Five
R5 findings, production TLS/retention/OTel and all release/spending gates remain.
