# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Focused suites: 32/32 pass (seven identity primitive groups and 25 Git source
  groups). This adds 15 groups and extends the existing native Git-history test.
- Adapter typecheck passes.
- Two independent ephemeral test key pairs sign actual Ed25519 identity and gate
  assertions. The gate record covers the exact identity-envelope digest. Correctly
  signed mismatched identities, sessions, issuer bindings and times still deny.
- Native Git integration reads historical/current grant commits and current trust/
  proof blobs, verifies both signatures and session linkage, then rejects a later
  role revocation using both the old and refreshed current head.
- Tests cover canonical encoding, source bounds/hashes/coordinates, unknown token
  fields, activation/expiry/revocation, exact nanosecond chronology, moved heads,
  revoked reader identity, clock rollback, shared ownership and final-clock expiry.
- The retained real 15-second deadline test covers the shared reader mechanism;
  the new pending identity-source test uses logical expiry and proves no subsequent
  authentication occurs after the held read completes. These are distinct checks.
- Full `pnpm check`: exit 0. All 88 prototype tests, 437 root controls, seven
  package typechecks, eleven package test tasks and seven builds pass, including
  164 adapter tests. Root controls take 236.29 seconds. Existing assertions,
  deadlines and concurrency settings are unchanged; unaffected tasks use cache.

Identity-service, gate-provider and authenticator fixtures are synthetic. Actual
signature verification, parsers, source readers and native Git are exercised; no
real IdP event, credential, approved attestor or user's existing signature is read
or validated. Test cleanup removes only its owned disposable Git repository.

No browser changes or rerun are claimed. The native frontend and its sign-in
configuration are unchanged. Existing commercial provider compatibility, actual
receipt issuance, qualifications/full gate composition, all five R5 findings and
signed Phase 1/live-use/release requirements remain outstanding.
