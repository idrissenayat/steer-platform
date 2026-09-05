# Specification

1. Use apps/worker and exact stable Temporal SDK pins. SDKs stay out of domain
   and registry; deterministic contracts have no dependencies or I/O.
2. Workflow identity is a versioned escaped tuple of organization, repository
   and item. Bound each ASCII field and reject unknown fields. Verify the actual
   Temporal workflow ID against the tuple before any activity.
3. A plan allows 1–100 rounds and 1 second–24 hours between rounds. Execute
   sequential activities with durable timers, not process sleeps. Expose only
   completed count and operational phase as a query.
4. A fixed activity binding refuses other tenant/repository/item inputs before
   touching its trusted port. Reject actual in-process overlap. The port must
   reauthorize current grants per run and use idempotent projection ingestion.
5. History contains scope references and bounded receipts: revision, status and
   acknowledged count. Do not serialize artifact content, tokens, hats or approval
   decisions. Sanitize errors and reject malformed receipts.
6. Bound activity start-to-close at 2 minutes and schedule-to-close at 3 minutes.
   Disable automatic activity retries until durable backend recovery is composed.
   Failure stops for attention; it never implies rollback or successful cleanup.
7. Explicit trusted client start rejects running and retained completed duplicate
   IDs. Explicit worker creation accepts caller-owned connection/bundle/port and
   bounded SDK execution/shutdown settings. No default environment or cluster access.
8. Real-server tests cover durable wait across worker instance recreation, same
   execution ID, replay without repeated activities, duplicate/foreign/wrong-ID
   denials, sanitized non-retried failure and cancellation during a timer.

Non-goals: signed gate waits, crash/process/fleet recovery, Git/Postgres port
composition, task-queue authorization, public start API, infinite scheduling,
history purge policy, deployment, production SLA evidence or gate approval.
