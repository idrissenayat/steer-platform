# Spec

- Require explicit current reconciliation authority in addition to current read
  and operation authority. Missing service denies before provider/SQL access.
  Ordinary inspect and save/workflow calls never reconcile automatically.
- Bind original operation, draft/revision, submission/publication configuration,
  final write digest and fenced candidate step. Only sent or succeeded steps qualify;
  no step creation, owner takeover, failure erasure or quarantine release.
- Read/verify the actual original Git receipt and complete bundle before SQL.
  Bind operation/input, saved revision, expected head and manifest/pointer digests
  into a versioned checkpoint digest. Use the original operation as receipt reference.
- Keep only an immutable, five-second in-process evidence binding for the SQL
  checkpoint verifier. Never accept caller evidence or hold SQL during provider
  readback. Existing SQL current-identity, fencing and CAS controls remain in force.
- Reauthorize before and after checkpointing. Lost SQL acknowledgement, current
  denial, expiry or close returns unknown, even if the state was committed. Repeated
  explicit reconciliation re-verifies the receipt and returns the same checkpoint
  without any new Git send. Missing/corrupt receipts remain unknown/conflict.
- Bound reconciliation authority/read callbacks to five seconds and retain
  admission until timed-out underlying work drains. Clear proof after every attempt.
- Keep all live persistence, write authority and policy adoption closed. No schema,
  automatic workflow invocation, public route or independent gate verdict is added.
