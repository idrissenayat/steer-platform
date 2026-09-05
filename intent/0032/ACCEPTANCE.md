# Development acceptance

These Builder checks are not an independent protected Exam or gate approval.

- [x] Explicit unique manifest, deterministic order, pinned revision and bounded
      staging; invalid source cannot begin projection writes.
- [x] Per-record CAS/idempotency, skipped-update replay, partial failure and
      superseded results remain explicit; no delete or blind retry path.
- [x] Optional job composition requires current scoped agent authority and owns
      its bounded pool; overlapping runs deny and shutdown awaits actual work.
- [x] Two-file synthetic Git/Postgres replay/repair preserves immutable history
      and exact bytes; existing authenticated browser flow remains passing.
- [x] Full repository checks and diff validation pass; implementation documented.
- [ ] Automatic whole-repository inventory, removal/rollback policy and durable
      scheduling, approved live authenticator/secrets and runtime-factory integration.
- [ ] Independent gate evidence, deployment/release and production outcomes.
