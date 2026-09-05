# Development acceptance

These are Builder checks, not an independent protected Exam or gate approval.

- [x] Explicit validated selector, exact directory boundaries and filename match.
- [x] Exact commit/tree identity, complete bounded response, duplicate/unsafe file
      rejection and no silent truncation or blob download during inventory.
- [x] Inventory scope/revision/blob identities bind reconciliation; HEAD movement
      cannot substitute a new manifest revision.
- [x] Empty inventory performs no SQL/deletion; runtime requires one selector mode.
- [x] Actual synthetic Git inventory feeds real Postgres replay/repair and browser
      readback; full repository checks and documentation pass.
- [ ] Large-inventory partitioning, source-removal/rollback policy, durable workers
      and approved live provider/authenticator/secret composition.
- [ ] Independent gate evidence, release/deployment and production outcomes.
