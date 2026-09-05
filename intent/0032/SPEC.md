# Bounded reconciliation contract

Expose reconcileArtifacts(reader, paths, sink, optionalSignal) through the existing
code-host adapter seam. Accept 1–100 unique normalized relative paths; sort a copy
without mutating the caller. Pin a valid Git revision and stage every artifact
with its observed projection revision before any ingest. Validate exact org,
repository, path, revision, SHA-256 and Git blob SHA-1, at most 512 KiB per artifact
and 8 MiB aggregate content. Missing, corrupt or mismatched sources fail closed.

Recheck HEAD after staging, before each ingest and after all ingests. Use existing
per-record expected-revision CAS, idempotency and immutable history. Return pinned
revision and deterministic path/outcome list; any superseded outcome must return
status=superseded, never reconciled. No automatic retry, deletion or pruning.

Failures expose only a fixed message, code, pinned revision if known and number
of acknowledged sink results. A failed SQL commit may have an unknown outcome;
acknowledged is not proof of the total committed count. Prior writes remain after
partial failure. Explicit later reconciliation can converge through source checks,
CAS and duplicate/repair handling; it is not blind transaction replay. This is not
an atomic manifest publication or guarantee that HEAD cannot move after a check.

Cancellation prevents subsequent operations but does not pretend an awaited
provider/database operation has stopped. No detached timeout or hidden retry.
Each real provider request retains existing adapter deadlines; aggregate wall
time is not a universal deadline and custom transports must honor their budgets.

Add createProjectionRuntime at the existing API composition root. Strict separate
profile (steer-projection-runtime/v1: GitHub binding/App ID, database, manifest)
and secrets (App PEM and database password) build the actual restricted reader
and bounded steer_projector pool. A trusted authenticate callback must supply a
current same-org agent with no human hats and projection.ingest grant. Validate
before source access and again before each storage operation; deny subject switch.
The runtime never mints its own agent authority or accepts HTTP jobs.

One actual run per runtime; reject overlap. Shutdown stops admission, requests
cooperative cancellation, waits for real active work and closes its owned pool.
Startup is lazy and opt-in; no timer, environment discovery, live credentials,
new dependency, schema migration or signed architecture change.

Evidence must distinguish unit/runtime lifecycle tests from actual synthetic Git,
Postgres replay/repair and browser read evidence. Whole-tree discovery, source
removal/tombstone policy, durable Temporal scheduling and production binding remain
separate work. A branch reset to an already superseded revision is not implicitly
authorized to regress the projection; a nonconvergent superseded result remains
visible for explicit policy rather than being silently overwritten.
