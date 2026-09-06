# Specification

## Constrained storage primitive

`createGitHubBriefStore` is not a complete `BriefWriter`. Its trusted constructor
requires an explicit transport, signer and authority-verification callback, with
one numeric GitHub repository, branch, organization, canonical path allowlist,
platform revision and Gate 2 decision fingerprint. No environment profile loads
it. The existing runtime reader and App permission remain read-only.

Authenticated registry composition must guard every status read and disclosure.
Immediately before a new mutation, the fixed trusted callback must fully verify
the exact current human/membership and source/provider gate evidence. It must
fence Git-resident admission at the expected head and account for session expiry.
The primitive checks returned actor/scope/request/base/pins and narrow observation
freshness, but does not turn a typed proof, normalized policy result or hash into
authority. That full callback implementation is still missing.

## Atomic creation and uncertainty

Validate canonical scope, exact UTF-8 bytes, SHA-256 and Git blob SHA-1 before I/O.
Use a contents-read installation token to inspect the branch and operation history.
Both the Brief and `.steer/authoring/operations/<UUID>.json` must be absent at the
exact proposed base; existing directories, descendants and non-directory ancestors
also prevent creation. Request contents-write only for the single bound repository,
with no additional permission other than metadata-read. Verify the response scope.

After source authority revalidation, dispatch one GraphQL `createCommitOnBranch`
with `expectedHeadOid` and exactly two additions. Do not use REST ref update,
force, branch creation, permission changes, deletions, clientMutationId as a retry
store, or retry a mutation. The marker contains scope/actor/key/request/base/content
digests, not its own future commit SHA or a human gate signature.

GitHub documents that file additions can replace files; the adapter therefore
checks absence at the CAS-pinned base. The mutation appends a commit and updates
the branch; authorship belongs to its authenticating credential, not the human
named in the application confirmation. [Mutation contract](https://docs.github.com/en/graphql/reference/commits#createcommitonbranch),
[file changes](https://docs.github.com/en/graphql/reference/git#fileaddition).

## Authoritative recovery

Read complete, nontruncated commit/tree data and verify regular-file modes, exact
blob lengths/encoding/SHA and content digests. A current operation marker plus one
path-history change must resolve to the immediate child of the recorded base.
Verify the complete linear ancestry, original absence, exactly two new leaves,
all original leaves unchanged, creation marker/Brief bytes and stable current head.
Return the creation revision even after unrelated later commits or adapter restart.

Only a stable head, complete tree and empty operation history establish absence.
Deleted/recreated/tampered markers, merge ancestry, partial comparisons, API errors,
corrupt bytes, wrong receipts and lost acknowledgements produce `unknown`, not
success/absence/rollback. Scope/key collisions produce bounded conflict metadata.
Lookup is not independent proof of who confirmed the Brief or signed a gate.

The first profile supports at most 100 linear commits after an operation's base;
older or nonlinear histories fail closed. Production-scale historical lookup is
explicit follow-up work. Branch rewriting or removing all reachable history can
erase a Git-only retry record: verified append-only/protected history and admission
policy are required before enablement, not established by these isolated tests.

## Resource limits

Maximum 40 provider requests and 60 seconds per operation, ten seconds per HTTP
request/body, two MiB/4096 chunks per JSON response, 10,000 tree entries, 64 KiB
per retrieved blob and 32 KiB per proposed Brief. URLs and API version are fixed;
redirects and transport caches are disabled. Credentials/provider bodies are never
returned. No database write or projection precedes Git completion.

Provider references checked on 2026-09-06: [installation token scoping](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app),
[commit history/comparison](https://docs.github.com/en/rest/commits/commits).
