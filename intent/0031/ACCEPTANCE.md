# Development acceptance

These are Builder checks, not an independent protected Exam or gate approval.

- [x] One canonical async tool, explicit grant, tenant and curated path binding.
- [x] Current authorization is rechecked after I/O; revoked/expired identities
      cannot receive returned content.
- [x] Read-only role, forced RLS, exact revision and strict bounded byte checks.
- [x] Missing/stale result is null; invalid/backend failures do not leak details.
- [x] Optional runtime read pool requires separate explicit credentials and closes
      alongside authentication resources.
- [x] Actual synthetic Git ingestion, PostgreSQL and authenticated browser proof.
- [x] Root checks, documentation and diff whitespace validation.
- [ ] Full repository/durable reconciliation and production operating surfaces.
- [ ] Real runtime bindings, independent gate evidence and release authorization.
