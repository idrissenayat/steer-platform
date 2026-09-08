# Spec

- Serialize only organization, server operation ID and final input digest. Derive
  workflow ID from organization/operation, not a changed digest that could select
  another run. Reject malformed, payload-bearing or authority-bearing input before
  the trusted start call. Use a dedicated fixed-operation worker/queue.
- Disable activity/workflow retries and reject duplicate retained workflow IDs.
  Preserve SQL's independent one-way dispatch protection beyond Temporal history.
- Reauthorize before/after exact original-payload retrieval, recompute the accepted
  write plan/digest, then call the durable store. No regeneration or fallback when
  original bytes are missing, substituted, expired or inaccessible.
- Validate provider observation binding and complete receipt metadata before
  emitting only operation/digest/outcome/revision. Reauthorize before release;
  sanitize errors so source bytes never appear in activity failure history.
- Bound each authority/payload dependency to five seconds and total activity work
  to 90 seconds. Keep admission while timed-out work drains. Cancellation closes
  the writer and prevents late reads from starting a save; after a committed effect,
  it cannot undo that effect or authorize retry. Heartbeats contain no payload.
- Verify actual owned Temporal/SQL/native-Git execution, retained duplicate denial,
  worker recreation/replay, uncertainty and cancellation. Do not select a real
  Temporal cluster or activate a public scheduling/save tool.

Workflow completion with `unknown` is not save completion. SQL receipt checkpoint
resolution, approved original-payload persistence, current authority services,
durable development-role orchestration and UI integration remain outside this increment.
