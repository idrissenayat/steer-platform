# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Focused common save suite: 17/17 pass, including four new ownership/cleanup
  groups and the preserved save/confirmation/unknown-outcome cases.
- Focused browser, MCP, Git-backed browser and identity-service set: 30/30 pass,
  including four new transport/session/lifecycle groups. API typecheck passes.
- The new Git-backed MCP positive first used a handcrafted protocol request and
  received 400. The test now uses the installed official MCP v2 client for valid
  negotiation/calls; no server protocol guard or assertion was weakened.
- Native disposable Git stores current test grants; actual ephemeral RS256 tokens
  feed the real OIDC context verifier. HTTP/MCP receive matching internal bearer
  context and both deny after a committed revocation. Separate test browser sessions
  have distinct bindings; mixed credentials, wrong origin and revoked grants deny.
- Full `pnpm check`: exit 0. All 88 prototype tests, 437 root controls, seven
  package typechecks, eleven package test tasks and seven builds pass. Package
  suites include 76 API, 81 registry and 131 adapter tests. Root controls take
  233.96 seconds. No assertion, deadline or concurrency limit was relaxed.
- Isolated `test:auth:browser`: exit 0, all 39 checks pass with Keycloak 26.7.3
  and Chromium 151.0.7922.34, actual HTTPS/Next.js/PostgreSQL and synthetic identities.
  Existing sign-in, authoring preview, Brief navigation, current-grant denial and
  shutdown flows remain green. This harness does not install the new writer factory
  or prove live saving; new factory coverage is the focused set described above.
  Screenshot destinations were unset, so no prior screenshot evidence was overwritten.
  Only this run's isolated browser, servers, containers, data and generated test
  credentials were cleaned up; no real user/provider credentials were used.

Factory/storage implementations in the new transport tests are synthetic and only
read scoped status. These tests do not compose a full real GitHub writer or verify
Gate 2. Existing 0132 native-Git write tests remain separate development evidence.
No production writer factory, trust key, provider permission or real account
configuration is installed. Default save/status stay unavailable without a writer.

All five R5 findings, full authority/provider compatibility, live write scope,
0124 history/protection, 0120 archival work and signed Phase 1 obligations remain.
Automated checks do not supply manual accessibility, independent review, human
signatures, deployment/release permission or spending authorization.
