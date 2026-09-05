# Development acceptance

Builder checks, not a protected Exam or gate approval.

- [x] Version-pinned worker package and vendor-free deterministic contracts.
- [x] Scoped IDs and fixed activity binding with bounded inputs/receipts.
- [x] Durable timers, duplicate-start denial and safe non-retried failures.
- [x] Actual local Temporal server, recreated worker instances and history replay.
- [x] Foreign scope/wrong workflow ID/cancellation checks.
- [x] Final lock, audit, repository checks and documentation verification.
- [ ] Git/Postgres composition, process/fleet crash recovery, authenticated start
      service, gate waits, OTel, production cluster/TLS/retention and formal gates.
