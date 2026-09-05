# Worker projection runtime

Increment 0037 connects Temporal activities to the actual Git reconciliation and
PostgreSQL ingestion adapters. createWorkerProjectionRuntime accepts a fixed
scope, explicit database profile and selector, separate database password, and
trusted prebound reader/authenticator. It opens no listener or real provider
connection at construction; its PostgreSQL pool is lazy.

The scope organization and repository must match the reader. Database user is
always steer_projector; injected SQL roles/extra database fields deny. Activity
inputs cannot select providers, paths, roles or secrets. A trusted composition
chooses the item-to-manifest mapping; itemId alone is not a path authorization
policy. Real cluster/task-queue authorization remains separate.

Use runtime.activities with createActivityWorker, then explicitly run the SDK
worker. Both are internal composition surfaces, not public registration/start
routes. The existing plain-port createReconciliationWorker remains compatible.

## Shared authority and lifecycle

The API one-shot job and worker share createProjectionJob in @steer/adapters/
projection-job. It validates one bounded paths/selection manifest, authenticates
a current agent before source work, supplies fresh same-subject authority for
every storage operation, and checks authority again before returning the result.
Humans, human hats, wrong tenant, missing projection.ingest grant and expired or
changed identities deny. A final denial may follow already committed writes;
it is not a rollback statement.

Actual overlap remains refused until the job settles. Shutdown stops admission,
aborts cooperative reconciliation, waits for the actual pending job and then
closes owned resources. Repeated shutdown shares the same completion. Resource
failure is sanitized, stays closed to new work and is not silently retried.
An uncooperative source may delay cleanup; no false stopped status is invented.

Worker shutdown and runtime shutdown are distinct ownership operations. Stop/
await the worker, then await runtime.shutdown before claiming its pool closed;
the integration follows and verifies this order. Failure cleanup still attempts
owned runtime closure. Temporal does not own SQL authority or automatically
terminate an uncooperative activity's external work.

## Recovery evidence and limits

The actual loopback Temporal harness now runs a two-artifact Git/PostgreSQL job,
recreates worker and projection runtime during a durable timer, and observes
exact readback with unchanged immutable event count. Workflow history replay
does not call the activity again. Reconciliation repairs a corrupt disposable
projection, and replay after a discarded completed receipt does not add events.
Committed grant revocation blocks a later scheduled round.

This verifies same-server SDK worker/runtime recreation and existing source/event
idempotency. It is not a killed-process, lost SQL acknowledgement, server restore,
fleet lease or live provider test. The fixture subject is synthetic; the Git
grant resolver and data adapters are real. Actual OIDC/GitHub runtime bindings
remain separate. SQL partial outcomes still require source-based recovery.

Automatic activity retries remain disabled. Next work is process-level recovery,
then authenticated scheduling/queue boundaries, source-derived gate waits and
durable cursors. OTel, production identity/TLS/retention and five R5 findings
remain open. No spending, release, deployment or gate approval is inferred.
Evidence: intent/0037/EVIDENCE.md. Run pnpm test:workflow:integration.
