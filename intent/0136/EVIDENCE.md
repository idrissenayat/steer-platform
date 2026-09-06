# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Focused provider-source suite: 17/17 pass, including nine new signer groups.
- Adapter typecheck passes.
- Native Git test creates separate historical/current authorization commits,
  verifies actual blob hashes and exact revision reads, then adds a revocation:
  both the stale-head request and the refreshed revoked request deny. Cleanup
  removes only the test-owned temporary repository.
- Authentic ephemeral Ed25519 signatures cover the historical authorization digest.
  Tests include absent/foreign/agent/inactive/duplicate hats, exact nanosecond window
  boundaries, expiry, malformed and oversized bytes, source corruption, head and
  identity changes, clock rollback, shared admission and draining shutdown.
- Full `pnpm check`: exit 0. All 88 prototype tests, 437 root controls, seven
  package typechecks, eleven package test tasks and seven builds pass, including
  149 adapter tests. Root controls take 237.00 seconds. No assertion, timeout or
  concurrency setting was relaxed; unchanged tasks use cache where applicable.

The grant parser, time checks, proof verifier and Git source composition are real.
The provider, trust root, identity authenticator and user data are synthetic; no
live GitHub access or historical production signer verification is claimed. Native
Git integration is separate from the synthetic source-reader fault tests.

This verifies historical/current recorded hat grants, not identity evidence,
specialist qualification, uninterrupted membership, historical ancestry or complete
gate policy. Existing commercial approvals remain unchanged. No browser rerun or
visual change is claimed; the latest isolated browser evidence remains item 0134.
All five R5 findings and signed Phase 1/live-use/release obligations remain open.
