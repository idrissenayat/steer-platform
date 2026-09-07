# Spec

Expose `createRecordedBriefProjectionJob` through the existing projection-job
adapter export. Accept a trusted reader, configured destination scope, projector
authenticator, sink factory, authenticated receipt-readback callback and owned
resource shutdown callback. Capture validated scope and reader binding at creation;
reject foreign configuration. `runOnce` accepts no caller-controlled receipt payload.
The readback callback is a trusted composition seam, not independent receipt proof.

Share single-flight admission and draining/idempotent shutdown with the existing
inventory/path projection job. Require a current, unexpired, same-organization
agent with no human hats and `projection.ingest` before invoking readback. Recheck
after readback, before selected-revision reads and ingestion, and after completion.
Within a run the projector subject must remain unchanged. Guard the sink even if
its implementation ignores the supplied current-identity callback; the sink still
owns transaction-time identity and CAS enforcement.

Use the recorded-source reconciler without source HEAD substitution, path expansion
or overwriting a different selected revision. Stop admission immediately on shutdown,
signal cancellation, drain the actual pending operation and close owned resources
once. Do not race a timeout against still-running I/O and call it canceled. No
automatic retry, queue, scheduler, public endpoint, live configuration or writer is
introduced. Post-ingestion failure is not rollback. A stuck dependency may require
operator diagnosis; shutdown must not falsely report completion.

The disposable browser composition must obtain the receipt from the actual status
endpoint using the existing human's Keycloak/browser cookies and native Git store.
The projector uses a separate synthetic service identity. Prove initial projection,
duplicate replay, current human status-grant denial, stale-receipt no-rewind behavior
and shutdown while retaining the exact-reference UI checks. Seeded operation history
remains a fixture, not an executed platform save or gate approval.
