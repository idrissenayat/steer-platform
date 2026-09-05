# Temporal workflow foundation

Increment 0036 creates apps/worker, matching signed Architecture ADR-04. Temporal
owns durable timers and execution progress only. Git remains the system of record;
neither workflow state, a completed receipt nor a query is a gate decision.

## Explicit composition

The stable TypeScript client/worker/workflow/testing packages are pinned to
1.23.0 in the manifest/lock. No Mastra integration or experimental SDK plugin is
used. Production SDK imports are restricted to their client, worker and workflow
entry files. Deterministic contracts import nothing; workflow code can import
only those contracts and @temporalio/workflow.

createReconciliationWorker accepts an already authorized NativeConnection,
namespace, task queue, prebuilt workflow bundle, fixed scope and trusted port.
Construction does not start polling; the caller explicitly runs the returned SDK
Worker. The caller owns connection and port lifetime. No default CLI service,
environment loader, real credentials or public workflow-start endpoint is added.

The port's runOnce shape matches the existing one-shot projection runtime. This
increment tests the worker with a synthetic implementation; it does not claim the
actual Git/PostgreSQL runtime is already composed with Temporal. A production
port must freshly authorize on every run and use existing idempotent/CAS writes.
Scope fields never select a provider, database or credential.

startReconciliation is an internal trusted operation, not tenant authorization.
It computes a versioned workflow ID from escaped organization/repository/item
segments. The workflow independently checks that ID. Duplicate active and retained
closed executions are refused. Temporal's history-retention expiry can permit ID
reuse later; this is not a permanent business idempotency record. Shared cluster
namespace/task-queue ACLs remain required. Increment 0039 adds the optional
authenticated canonical start/status boundary; see AUTHORIZED-SCHEDULING.md.

## Execution and recovery contract

Plans have exactly scope, rounds (1–100) and intervalMs (1,000–86,400,000).
Rounds execute sequentially; Temporal sleep records the timer in history. The
query reports completed count and reconciling/waiting/complete, not business state.
Activity receipts contain only a SHA-1 source revision, reconciliation status
and acknowledged count (0–100); source bytes and outcome paths are stripped.
Inputs reject additional fields. History still contains operational references
and requires deployment-specific access, encryption and retention controls.

Activities have a two-minute start-to-close and three-minute schedule-to-close
budget, with maximumAttempts=1. Automatic retries are deliberately not enabled
before actual backend recovery is composed. Failure stops the workflow for
attention; it does not mean no projection was committed. Future recovery must
consult Git and idempotent projection state, never infer rollback from timeout.

The activity wrapper refuses actual local overlap until its port settles. This
is not a distributed lease. Temporal cancellation/timeout cannot force an
uncooperative port to stop; no abort/rollback promise is made. Worker concurrency
is one activity/two workflow tasks, SDK graceful shutdown 10 seconds/force 30
seconds. Caller-owned port/resource drain must be confirmed separately; SDK
shutdown is not proof that external work or shared pools are closed.

## Reproducible isolated verification

Run pnpm test:workflow:integration under Node 24.20.0. The harness downloads
only an allowlisted Temporal CLI 1.8.3 release archive, checks its SHA-256 before
extraction/execution, and starts Server 1.31.2 on random loopback ports with
in-memory persistence and UI disabled. Owned processes and temporary downloads
are cleaned up. Darwin/Linux ARM64/x64 archive hashes are allowed; this increment
is actually verified on Darwin ARM64, not all listed platforms.

The test recreates SDK Worker instances while the server and execution survive,
then explicitly replays history and checks no activity ran again. It is not a
separate OS-process crash, server restart, database restore or fleet recovery
test. Tenant/wrong-ID/duplicate denials, non-retried failure and timer cancellation
are tested. History checks decode payload bytes before looking for private
fixture content. See intent/0036/EVIDENCE.md and docs/stack/temporal.json.

Increment 0037 adds actual Git/PostgreSQL activity composition and shared fresh
authorization/lifecycle; see WORKER-PROJECTION-RUNTIME.md for its verified scope.
Increment 0038 adds separate-process restart during durable waits; see
WORKER-PROCESS-RECOVERY.md. Increment 0039 adds canonical authorized scheduling
with fixed routing and explicit uncertainty. Increment 0040 adds managed runtime
connection ownership; see MANAGED-SCHEDULER-RUNTIME.md. Next: add source-derived
gate waits/cursors and bounded long-lived scheduling. Real cluster TLS/identity,
OTel, production retention and formal gates remain open.

Increment 0041 adds a separate gate-watch worker and revision-bound observation
workflow. Its source checkpoint is not an approval or complete event cursor;
see GATE-WATCH-WORKFLOWS.md for the synthetic-observer verification boundary.

Primary references: [Temporal testing guide](https://docs.temporal.io/develop/typescript/best-practices/testing-suite),
[SDK 1.23.0 release](https://github.com/temporalio/sdk-typescript/releases/tag/v1.23.0),
[CLI 1.8.3 checksums](https://github.com/temporalio/cli/releases/download/v1.8.3/checksums.txt).
Installed SDK declarations/source were checked for the exact lifecycle, bundle,
duplicate policy and local-server APIs.
