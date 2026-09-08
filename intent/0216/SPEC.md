# Spec

- Determine the exact required checkpoint from authorized, locked operation/step
  reads. Reject wrong owner/fence/input and unavailable predecessors before readback.
- Roll back the read-only preflight, clear tenant settings and release the pool
  lease before invoking `verifyCheckpoint`. Failed cleanup denies continuation.
- Reauthorize and perform one bounded external readback. Keep its immutable exact
  reference in this call only; bind owner, operation, draft/revision, role/input,
  configuration, records policy, result ID and digest. Do not accept public proofs.
- Start proof freshness before readback, limit it to five seconds, and require
  freshness at consumption, before COMMIT and before releasing acknowledgement.
- A second transaction rereads the operation, step and any required predecessor,
  current authority, fence and budget before applying a mutation. A concurrent
  quarantine or authorization/budget loss must not be overwritten or bypassed.
- Readback may acquire the exact same single-connection pool. No execution
  transaction or pool lease is held across this callback. Model/provider effects
  are never retried; only an effect-free preflight is rerun once.
- Preserve three-second external/acquisition limits and eight-call admission.
  Timeouts retain capacity until their callbacks drain; close suppresses late work.
  Unknown COMMIT remains unknown with no dispatch permission or reservation refund.
- No schema changes, runtime activation, model call, accepted policy change,
  generation-result content store or human acceptance is included.
