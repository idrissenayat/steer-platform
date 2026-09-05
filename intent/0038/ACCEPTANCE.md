# Development acceptance

Builder checks only; no protected Exam or gate approval.

- [x] Lazy single-start service and ordered worker/runtime/connection closure.
- [x] Pre-start/construction/active-stop races and generic failed cleanup.
- [x] Actual separate-process SIGKILL and different-PID recovery of the same run.
- [x] Exact Git/Postgres readback and no duplicate immutable ingestion records.
- [x] Revocation committed while the predecessor is dead denies after restart.
- [x] Final full checks, lifecycle integration rerun and documentation.
- [ ] Active-activity crash recovery, fleet leases, server/database restore,
      scheduling/queue authority, gate waits/cursors, production bindings and gates.
