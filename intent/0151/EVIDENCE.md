# Development evidence

The explicit integration passed against the actual `createIdentityRuntime` profile,
PostgreSQL session store/migrations, four runtime instances, runtime GitHub App JWT
signer and GitHub read adapter over native temporary Git. It retained the original
login transaction across a stop/recreate, completed it once, verified encrypted
session storage, retained the cookie across another reconstruction, observed a new
Git head, enforced scope/grant changes, deleted the session at logout, and rejected
that cookie after a final reconstruction. Readiness stayed 503, write mutations and
authority callbacks stayed zero. No database projection was configured or used.

The original repository-digest lookup for the pinned local PostgreSQL image failed
on this host. A pull attempt was interrupted while Docker's credential helper was
waiting; no credential values were returned or recorded. Read-only inspection
resolved the exact same existing image configuration ID, so the harness now verifies/uses that immutable
local ID with `--pull=never`. No tag, image bytes or database version was substituted.
The final test also verifies PostgreSQL major 16 directly through SQL.

Final `pnpm test:destination:integration` passed (one complete integration flow),
including direct PostgreSQL major-version validation and explicit membership
revocation. Full `pnpm check` then passed on Node 24.20.0/pnpm 11.19.0: 95 required
kit artifacts, workflow-scope audit, seven package typechecks, 88 prototype tests,
437 root controls, 256 adapter tests, 87 API tests, 87 registry tests, 38 web tests,
21 data tests, 18 worker tests and 13 domain tests. Prototype and all seven package
builds passed; Turbo reused eligible steps. Whitespace checks passed, protected
`intent/0001`/`.github` stayed unchanged, and no labeled authentication test container
remained after cleanup. The explicit Docker flow is separate from the default suite,
not an inflated count of independent acceptance cases.

Each run removed only its own exact labeled PostgreSQL container/tmpfs database and
temporary native Git fixture; generated test credentials stayed out of Git/output.
Real PostgreSQL and native Git are used, but provider HTTP, browser navigation/cookie
jar and issuer tokens are synthetic. No real Keycloak user, live GitHub source,
browser/visual/manual accessibility, deployment, spending, gate or live writer is
verified or enabled. All five R5 findings and signed Phase 1 obligations remain.
