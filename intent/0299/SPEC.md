# Test-only corpus protocol experiment

## Boundary and acceptance

Use the same native fixture topology as the authenticated journey: 34 semantic
Brief/Spec sources, including a candidate and an amendment. Compare every emitted
source against the existing collector's exact bytes, SHA-256, Git blob identity
and status. Enumerate every consumed physical file, including non-semantic Exams.

The existing collector reads 43 blobs; one immutable root Brief is read twice.
The experiment must consume all 42 distinct files, without treating that duplicate
read as a distinct source. Pointer bytes determine manifest paths and manifest
bytes determine document paths; these dependencies require separate waves.

- Verify the current head, commit and complete recursive tree before body reads.
  Retain regular-file/topology validation through the actual inventory verifier.
- Use exact tree-member object IDs, never a moving branch expression, in a
  read-only query. Restrict each query to 16 aliases and a conservative 2 MiB
  response estimate; a file is at most 128 KiB. Missing size hints use that maximum.
- Evaluate each path's grant before and after its batch and again before release.
  Revalidate the caller and all-grants revision around each batch; recheck every
  selection and the repository head before releasing the completed result.
- Check repository identity, exact aliases, UTF-8 bytes, Git object hash, size,
  SHA-256, pointer/manifest identity and each of the three document digests.
  Null, binary, truncated, partial/error, oversized or mismatched replies deny.
- Binding or authority-method replacement, cancellation, revocation and source
  head changes deny. No partial source result establishes newness.
- Count every request emitted by the experiment, including its separate identity
  reader and both token acquisitions. Count all independent source-policy calls.
  The representative standalone protocol should fit the proposed 30-attempt
  allocation; integration may add costs and remains a separate acceptance.

## Documented provider contract

The query uses `Repository.object(oid:)` with `databaseId` and `nameWithOwner` for
repository identity. Blob validation uses `oid`, `byteSize`, `isBinary`,
`isTruncated` and `text`; nullable/unknown values fail closed. These fields are
documented by GitHub's [repository reference](https://docs.github.com/en/graphql/reference/repos)
and [Git object reference](https://docs.github.com/en/graphql/reference/git).
The existing REST tree response provides per-blob size metadata when available;
the experiment uses that hint only for partitioning and then verifies the actual
bytes. See [Git trees](https://docs.github.com/en/rest/git/trees).

This is a schema-grounded emulator, not a live provider contract test. Production
rate-limit/retry handling, real GitHub App authorization and provider behavior
remain to verify in the existing adapter, without inventing new write authority.

## Explicit exclusions

The prototype lives only under `apps/api/test`, accepts only the synthetic fixture
binding and requires an injected transport. Nothing installs it into startup.
Metadata authorities are synthetic. The current-caller stand-in invokes the real
GitHub reader against native Git replies, but it is not the full HTTP/OIDC/grants
resolver. The 126 policy callbacks are counted; their future integrated SQL and
provider cost is not presumed zero. No full records, key, hold, lifecycle, owner
drain, admission or effect-boundary integration is claimed.

No whole-confirmation budget, delayed p95, real-model quality, runtime GitHub
save/reopen, UI/accessibility acceptance or C22 completion follows from this test.
A separate large-document diagnostic must preserve bytes and expose additional
requests rather than extrapolate the small representative fixture's result.

The follow-up authorization experiment uses actual OIDC signature/grant validation
and the current Git resolver in place of the head-only caller. Account separately
for cold bootstrap, a new request in the same reader/JWKS process, and two complete
corpus phases separated by a source commit. Count all requests, including bootstrap;
verify revoked membership/grants and token expiry. This does not substitute for
the HTTP registry, records integration or an actual persisted confirmation boundary.
