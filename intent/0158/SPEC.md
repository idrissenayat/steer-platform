# Spec

Provide an internal `reconcileRecordedBrief` adapter using the existing source
reader and compare-and-swap projection sink. Accept only strict committed,
non-gate-signing observations from trusted authenticated readback composition.
Require a separately configured organization, repository, branch and canonical path
set matching the captured reader binding and receipt. Reject malformed or foreign
inputs before I/O; a receipt must not expand the configured path set.

Read the sink's selected revision first. If it is neither absent nor exactly the
receipt revision, return `different-revision` without source reads or writes. Do
not order SHA strings or rewind a selection because an old receipt was observed.
For absent/same selections, read exactly the recorded source revision, not current
branch HEAD. Compare organization/repository/path/revision, content SHA-256 and Git
blob SHA-1 with the receipt, recompute both hashes from bounded exact UTF-8 bytes,
then pass the verified snapshot and original expected revision to the sink.

Preserve existing applied/duplicate/repaired/superseded sink outcomes. The sink
still owns current projector identity and transactional CAS; this helper does not
grant access or authenticate receipts independently. Propagate source/storage
failures and cancellation without retries. Abort before/after reads and after
ingestion; a post-write failure is not rollback. No live runtime wiring, new API,
provider credentials, storage migration or business lifecycle authority is added.

Use the helper in the existing disposable native Git/PostgreSQL/browser integration
for initial ingestion and duplicate readback; prove that replaying the old receipt
after a later projection does not rewind it. Preserve the existing exact-reference
UI rejection and all five R5 boundaries.
