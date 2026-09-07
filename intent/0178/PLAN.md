# Plan

1. Add explicit test-only service-account dispatch inputs to the existing durable
   receipt-projection harness, retaining owned resource boundaries.
2. Compose actual identity runtime and managed client, then replace direct browser
   workflow start with authenticated HTTP calls and current grant checks.
3. Run typechecks and the full actual Keycloak/Chromium/Temporal/PostgreSQL journey.
4. Run repository/workspace regressions and builds without overlapping Next builds
   with the browser harness. Update evidence/docs and verify candidate push equality.

At the first safe checkpoint after 08:00 Eastern, complete the approved morning
handoff before starting another increment. Do not interrupt active verification.
