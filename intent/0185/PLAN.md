# Plan

1. Extend test-only Keycloak/browser profiles with an optional separate recovery actor.
2. Connect that profile to the owned identity-runtime recovery factory and the
   browser receipt callback, preserving the normal successful projection branch.
3. Exercise failed-original recovery, current grants, reconstruction, duplicates,
   exact SQL idempotency, original failure preservation and browser source readback.
4. Run both browser modes, dedicated recovery regression, typechecks and full checks.
   Record actual results and limits; commit/push the candidate and verify equality.
5. Reassess the first-usable journey's remaining implementation and authority gaps
   against the delivery ledger. Do not activate live recovery from test evidence.
