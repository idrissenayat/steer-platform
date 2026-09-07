# Development evidence

Final `pnpm test:auth:browser` passed all 40 checks on Chromium 151.0.7922.34 and
Keycloak 26.7.3, using the actual Next production build, local HTTPS gateway and
encrypted PostgreSQL 16 session store. The new combined check observed configured
paths/repository/branch and current native Git heads through the actual runtime
profile and production GitHub reader. It reconstructed the runtime, reused the real
browser session, enforced committed grant denial/restoration, and waited for real
15-second display expiry. The answer summary and preview fingerprint were retained,
web storage remained empty, and readiness stayed 503.

The original composed service handles sign-in, preview and projection checks. For
the new destination check, the test explicitly switches the local gateway to the
destination runtime using the same encrypted session namespace, then restores the
original service. This is not a claim that one runtime boot already composes every
workspace capability. Runtime reconstruction is not a process/database crash test.
The native Git HTTP fixture verifies generated App assertions and exact read-only
token permissions, rejects other methods/routes and never falls back to a network
provider. Production commit/tree/blob validation remains intact.

Initial runs exposed a test-selector mistake: the guided form had advanced beyond
the title input. The check now compares the full rendered answer summary, not an
absent input. After correction the complete suite passed, followed by a final full
browser rerun with explicit repository/branch and API-version assertions. No app
permission, clock, timeout or ingress control was weakened to obtain these passes.

Every run closed its owned browser/Next/HTTPS resources and removed only its own
labeled Keycloak/PostgreSQL containers, tmpfs data and generated test credentials.
Post-run Docker checks found neither authentication test label running. No user
browser profile, OS trust store, external account, existing record or real provider
configuration was changed.

Full `pnpm check` passed on Node 24.20.0/pnpm 11.19.0: 95 required kit artifacts,
workflow-scope audit, seven package typechecks, 88 prototype tests, 437 root controls,
256 adapter tests, 87 API tests, 87 registry tests, 38 web tests, 21 data tests,
18 worker tests and 13 domain tests. Prototype and all seven package builds passed;
Turbo reused eligible steps. The explicit 40-check browser integration is separate
from these default test counts. Whitespace validation passed and protected
`intent/0001`/`.github` remained unchanged.

This is automated development evidence, not manual accessibility or visual review,
live GitHub enforcement, an approved source/runner binding, gate approval or write
authority. All five R5 findings and signed Phase 1 obligations remain open. No live
writer, deployment, release or spending was enabled.
