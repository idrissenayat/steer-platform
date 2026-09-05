# Composition contract

`createGitBackedBrowserApi` accepts a trusted artifact reader, fixed authorization
artifact path, session store, browser/provider configuration and optional clock
and transport. It creates the existing Git resolver internally. It does not
accept an alternative authority resolver or spread untrusted dependency fields
into the underlying browser API. Requests and claims never select the repository,
branch, installation or path. Reject malformed paths during construction.

Both cookie and bearer authentication use current Git-derived authority through
the existing normalized OIDC checks. On every authorization lookup, verify the
snapshot's organization, repository, path, revision and content digest; parse the
strict document; reject duplicate identities and cross-organization records;
match issuer and subject exactly; recheck the source head before returning a
grant. Inactive, missing, expired or invalid grants deny. Source errors, moving
head and integrity failures deny without a previous-grant or database fallback.

The production GitHub reader remains responsible for bounded provider access,
installation restriction and pinned tree/blob integrity. The new factory takes
that trusted reader interface; it does not invent a second GitHub transport.

## Development proof

Create a temporary, unremoted SHA-1 Git repository with synthetic authorization
JSON and actual commits. The test-only reader reads content by immutable commit
and computes its digest. Controlled fault injection models source unavailability,
head movement and digest mismatch. This is not live GitHub integration evidence.

Unit-test bearer access, revocation, missing/duplicate/cross-organization records,
source faults, restoration, ignored resolver override and invalid startup paths.
Extend the real isolated Chromium flow with this composition, preserving actual
Keycloak code exchange and encrypted PostgreSQL sessions. Commit revocations and
malformed memberships while the browser remains signed in, verify 401 on the next
tool call and recovery only after valid source restoration. Retain all prior
cookie, CSRF, replay, reconstruction and logout checks.

No real memberships, provider credentials, remote Git writes or OS trust changes.
Owned temporary repositories are removed with the existing fixture cleanup.
Default API startup/readiness stays closed. Public ingress limits, approved real
membership source/runtime settings, production UI and formal gates remain open.
