# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Focused qualification/Git-reader suites: 38/38 pass (six pure qualification
  groups and 32 reader groups), including 13 new groups. Adapter typecheck passes.
- The native Git test now reads all three signed proofs and historical/current
  human-role bytes from actual disposable commits, verifies the derived privacy
  domain, and rejects subsequent role revocation at both stale and refreshed heads.
- Ephemeral independent test key pairs sign the provider, identity and qualification
  assertions. Correctly signed foreign/agent subjects, insufficient or out-of-scope
  domains, retroactive recording and revoked/expired qualifications still deny.
- The real gate-policy evaluator consumes the verified specialist signature. It
  accepts that signature only among otherwise sufficient normalized synthetic facts,
  rejects removal of its verified domains, and returns sourceVerificationRequired.
  Other signatures, policy, prerequisite and Critic/domain evidence in this test are
  not source-verified and do not prove full gate acceptance.
- Tests cover pinned and repinned revocations, corrupt/missing/oversized sources,
  unlisted input facts, path collisions, head/identity/clock changes, shared admission,
  draining shutdown and completion-clock expiry/revocation. The retained shared
  real deadline test and new qualification-source logical-expiry test are distinct.
- Full `pnpm check`: exit 0. All 88 prototype tests, root controls, seven package
  typechecks, eleven package test tasks and seven builds pass, including 177
  adapter tests. Assertions, deadlines and concurrency settings are unchanged;
  unaffected tasks use cache where applicable.

No real identity or qualification authority is configured, no professional credentials
are assessed or issued, and no user's approval or ruling is converted. Source readers,
signature verification, exact-time checks, parsers, policy evaluation and native Git
are actual code; provider/authenticator identities and evidence are synthetic. Cleanup
removes only the test-owned disposable repository. No browser rerun/UI change is claimed.
All five R5 findings, full gate/live-use prerequisites and signed Phase 1 obligations remain.
