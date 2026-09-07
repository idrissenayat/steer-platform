# Spec

Introduce a strict reference-only target: existing organization/repository/item
scope plus a UUID-v4 save idempotency key. Deterministic workflow identity includes
all target fields. Use one activity per execution, bounded SDK timeouts, no
automatic retries, duplicate-run rejection and no public scheduler or signal.

The worker composition owns a lazy steer_projector pool and the existing recorded
projection job. Trusted configuration supplies the branch, exact canonical Brief
path and receipt subject outside history. The item must identify that Brief's
directory. A trusted current receipt-read callback must return the exact bound
organization/repository/branch/path/subject/idempotency key. Neither parsed fields
nor workflow references establish human provenance. Current agent authorization,
same-subject checks, source hashes, CAS and different-revision no-rewind behavior
remain mandatory. An optional exact-reference binding on the shared job preserves
compatibility for existing callers; the new worker always requires it.

Activity output is strictly limited to revision, observed/different-revision and
applied/duplicate/repaired/superseded/null. Errors are sanitized; concurrent work
is denied until the actual job settles. Owned shutdown drains actual work and
closes its pool once. Uncertain post-ingest failure never implies rollback or
permits automatic retry. A fresh workflow is not a substitute for status readback.

Test actual isolated Temporal workers/replay with native Git and PostgreSQL, plus
wrong target/receipt, revocation, idempotence and owned shutdown. Synthetic receipt
callbacks are not provider-recorded human approval or an enabled production path.
