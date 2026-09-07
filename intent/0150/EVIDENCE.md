# Development evidence

The pre-fix composed test passed login/Git/display and authority-negative cases but
failed shutdown: the session store was already closed while the destination reader
was paused. Exact assertion: `destination still needs its session store for post-read
authorization`, actual `true`, expected `false`. The fixture releases admitted work
in cleanup even on failure, so it does not strand a test source or fabricate success.

The fix includes configured destination reads in `drainBeforeResources`. The same
positive regression passed after the fix. Added variants verify that mid-read Git
revocation and source failure also drain, reject appropriately and close once.
No server policy is weakened to make successful shutdown possible.

Focused validation passed 32 groups: six new composed cases, eight existing identity
service cases, twelve runtime cases and six architecture checks. Full `pnpm check`
passed on Node 24.20.0/pnpm 11.19.0: 95 required kit artifacts, workflow-scope audit,
seven package typechecks, 88 prototype tests, 437 root controls, 256 adapter tests,
87 API tests, 87 registry tests, 38 web tests, 21 data tests, 18 worker tests and
13 domain tests. Prototype and all seven package builds passed; Turbo reused
eligible unchanged steps. Diff whitespace checks passed. Protected `intent/0001`
and `.github` were unchanged.

Evidence chain: actual browser API login/callback and cookie verification, actual
RS256 JWT validation, native Git authorization artifacts, actual GitHub reader and
registry, actual destination display controller and read transport. Test doubles
are explicit: provider HTTP replies, clock/timer, browser-cookie injection and
in-memory session store. No Keycloak service, database, real provider, browser/DOM,
UI screenshots, paid infrastructure or production data was used. No deployment,
gate signature or write authority is established. All five R5 findings stay open.
