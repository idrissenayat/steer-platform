# Specification

`createGitWriteMembershipVerifier` is exported separately from the existing login
resolver. It requires a pinned organization/repository/branch/issuer, authorization
path, canonical Brief allowlist, trusted reader and fresh authentication callback.
It is not an HTTP tool or a complete `BriefWriter`.

The callback must verify the actual request/session and return its issuer,
establishment instant and principal. That envelope must come from real verified
OIDC/session evidence, never request JSON or browser headers. This adapter does
not verify OIDC tokens itself; integrating the callback remains wrapper work.

## Checks

1. Reject invalid/extra fields and uncurated scope before authentication.
2. Require the matching current human, issuer and preview/save/status grants.
3. Require current Git head to equal the request's expected head.
4. Read authorization at that revision. Verify organization, repository, path,
   revision, UTF-8 round trip, 512 KiB cap, SHA-256 and Git blob SHA.
5. Parse the existing closed authorization schema; reject duplicate issuer/subject
   identities and cross-organization records throughout the document. The selected
   human record must be active with the required grants and contain the current
   session's hats/grants without duplicate values. This does not verify specialist
   qualifications or assign a new human role.
6. Authenticate again, reject issuer/subject/session switching, require session
   establishment no earlier than the grant's valid-after instant, recheck Git head,
   and reject invalid/backward/over-budget/expired observations.
7. Return immutable source/reference metadata whose validity ends no later than
   either authenticated session expiry, grant expiry or five seconds ahead.

This strict first write profile requires millisecond UTC session/selected-grant
instants; submillisecond values reject rather than round. Existing login/read
behavior stays unchanged. Exact issuer matching prevents same-subject substitution.
There is no stale cache or projection fallback.

Output kind is `git-write-membership-observation`, with `gateVerified: false` and
`writeAuthorized: false`. It cannot parse as `BriefWriteAuthority`. It contains
no credential, source content or signature. The request digest binds a lookup,
not proof of confirmation.

## Resource and authority limits

One observation may be in flight per verifier, with a 15-second wall deadline.
If a dependency cannot be cancelled, timeout keeps admission busy until that read
ends, then discards its late result. New reads cannot accumulate. Provider readers
retain their own I/O bounds; cancellation of an unsupported dependency is not claimed.

Repository verification caps control-file concurrency at four after two report
CLI timeouts under automatic parallelism. Nested CLI work retains its original
30-second deadline and every assertion/control remains enabled. This is test
resource scheduling, not a runtime authorization or acceptance-policy change.

The existing gate observer verifies provenance/shape only; the gate-policy evaluator
evaluates normalized facts only. Full source/provider proof, exact artifact sets,
qualified signers, prerequisites, independent Critic/domain evidence, governing
policy and protected co-located admission still require verification. Neither a
membership observation nor those existing helpers may substitute for that work.
