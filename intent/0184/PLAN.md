# Plan

1. Add explicit disposable provider inputs to the shared recorded test fixture,
   preserving its default synthetic mode and read-only native Git transport.
2. Reuse the fixed-failed-run recovery suite with actual provider identities; add
   token substitution and post-receipt revocation negatives before SQL.
3. Wire an exclusive opt-in Keycloak recovery mode to separately owned Temporal/
   PostgreSQL resources, with independent test account and exact cleanup.
4. Run the dedicated real-provider suite, normal Temporal regressions and full
   checks/builds. Document exact evidence and remaining provenance limits; push
   the candidate and verify clean remote equality.
5. Next join this recovery identity to the browser-created operation's actual
   recorded receipt in the disposable authoring journey. Keep human save, ordinary
   dispatch, recovery and projector roles separate; live activation remains gated.
