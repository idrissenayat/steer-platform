# Fixed-operation recorded Brief dispatch

Increment 0174 adds `createManagedRecordedBriefScheduler` in
`apps/worker/src/client.ts`. It owns an explicitly supplied Temporal
client connection and snapshots one namespace, dedicated queue and exact operation
target. It does not open a connection, select an authoring destination, authenticate
a human, verify a receipt or install a live scheduler. Callers must not pass an
untrusted request as configuration or share the transferred connection.

The target is only organization/repository/item/operation ID. The existing worker
runtime still owns exact branch/path/subject, authenticated receipt callback,
current projector and curated source verification outside workflow history.

## Start and recovery

`scheduler.start()` accepts no routing or payload input. It admits at most one
explicit start per instance, setting its latch before the existing deterministic-ID
starter. Outcomes distinguish `started`, typed Temporal `duplicate`, `unknown`, and
`already-attempted`. A missing/malformed response may follow actual dispatch. It
never proves rollback or permits another attempt on that instance. No application
retry, polling or replacement operation is generated.

`scheduler.inspect()` manually describes only the fixed workflow ID. Namespace,
workflow ID/type, queue, run ID and known execution state are checked before returning
metadata. Only typed SDK absence becomes `not-found`; other failures and malformed
responses become `unknown`, without private messages. Inspection never resets the
latch. Namespace drift before I/O denies; drift during I/O cannot return a successful
result from the former binding.

Connection reconstruction requires the original trusted target. Temporal's existing
reject-duplicate policy protects that ID while its record is retained; this is not
an indefinite idempotency ledger. Do not infer retry authority from `not-found` after
history expiry or automatically create a replacement operation.

`found` / `COMPLETED` describes workflow execution only. A completed workflow can
report `different-revision` without ingesting anything. It is not a save receipt,
current Git proof, successful projection, gate approval or user-visible board state.

## Lifecycle and limits

One start or inspection may be in flight. Shutdown refuses new calls, waits for
admitted I/O, then closes only the transferred connection once. Repeated shutdown
shares its promise; close failure is sanitized and not retried. This client does
not claim to cancel an already dispatched workflow. Initialization failure also
closes the supplied connection, never the server, worker or another connection.

0175 adds a separate shared registry authorization boundary around this client;
see `AUTHORIZED-RECORDED-DISPATCH.md`. The client itself does not authenticate callers.
0176 adds explicit optional identity-runtime ownership; see
`RECORDED-SCHEDULER-RUNTIME.md`. Governed receipt/path admission and live installation
remain open. All five R5 findings, independent/qualified
review and human gates remain unchanged. No live save, provider grant, deployment,
release, spending or deletion was enabled. See `intent/0174/EVIDENCE.md`.
