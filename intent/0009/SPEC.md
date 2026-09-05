# Specification

- Drizzle owns the versioned schema/migrations for `steer.ingestion_events`
  and `steer.projection_records`. Both use organization-leading primary keys.
- Every data table enables and forces RLS; policies apply tenant context to
  both USING and WITH CHECK. Missing context denies.
- Runtime `steer_app` receives SELECT only. `steer_projector` can append events
  and write projections but cannot update/delete events or truncate tables.
  Neither runtime role owns tables or has superuser/BYPASSRLS privileges.
- Tenant context is transaction-local, parameterized, derived from a validated
  principal and reset on commit/rollback. Query failure rolls back before pool
  release; rollback failure destroys the connection.
- Trusted callbacks and the SQL-capable runtime are not an untrusted SQL
  sandbox. The API must enforce tool grants; never expose raw SQL or pool/GUC
  manipulation to users or agents.
- The standalone integration harness starts only its own exact-named Docker
  container, uses no host data mount, runs migrations only there, exercises
  isolation as non-owner runtime roles, and removes only that synthetic test
  container. No production migration CLI or provider wiring is enabled.
- Regular unit checks do not silently count missing Docker as integration
  success. A separate explicit integration command fails if Docker is absent.
