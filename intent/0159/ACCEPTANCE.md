# Development acceptance

- Foreign configuration and invalid current projector identity fail before readback.
- A valid job uses actual authenticated readback, separately from projector identity.
- Identity is rechecked around source/storage work; switched/revoked agents fail.
- Exact source and CAS constraints remain; duplicate replay adds no new feed event.
- Concurrent runs reject; shutdown drains actual work and closes once, without retry.
- Failure after ingestion does not claim rollback or authority to resubmit.
- Native Git/PostgreSQL/Keycloak browser and full repository verification pass.
- No live writes, production, deployment or spending; all five R5 findings remain open.
