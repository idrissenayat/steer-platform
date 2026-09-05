# Revision-bound repository inventory

RepositoryReader extends ArtifactReader with readInventory(selection, revision).
The GitHub binding uses the same restricted contents-read token and exact commit/
recursive-tree APIs. It returns a descriptor manifest, not artifact bytes or
permission to change Git. Existing artifact-reader consumers remain compatible.

## Explicit scope

A trusted selector has roots (1–10 unique nonoverlapping normalized directories)
and fileNames (1–20 unique single-component exact names). For example:

```json
{"roots":["intent/0001"],"fileNames":["BRIEF.md","SPEC.md","EXAM.md"]}
```

Matching is case-sensitive beneath directory boundaries: intent does not match
intent-extra. An empty root explicitly means the entire repository; it is never
defaulted. There are no globs. Scope is trusted runtime configuration, not a
browser-supplied instruction. Inventory does not expand the separate artifact
read tool's path allowlist or grant a user access to discovered content.

The complete recursive provider response must fit 2 MiB and 10,000 entries. Reject
truncated trees, mismatched commit/tree IDs, duplicate or invalid paths and invalid
mode/type pairs. Selected files must be ordinary 100644 blobs; selected symlinks,
executables, directories and submodules fail instead of being skipped. At most
100 artifacts may be selected. Exceeding any bound fails without a partial list.
Use an appropriately bounded explicit scope; large-inventory partitioning is not
implemented here and must not silently truncate a larger operating repository.

Returned fields are organizationId, repositoryId, revision, treeSha and sorted
entries of path/blobSha. No blob download occurs during inventory. This relies
on the authenticated provider's commit/tree mapping; STEER does not reconstruct
and hash whole Git tree/commit objects independently in this increment.

## Reconciliation and runtime

reconcileRepository validates the returned scope and identities, checks HEAD and
passes its pinned revision into bounded manifest reconciliation. It checks each
downloaded blob against its inventory descriptor before ingestion. HEAD movement
between discovery and staging fails without adopting a different revision. The
existing per-record source checks, staging bounds, CAS, repair and honest partial
failure semantics remain in force. An empty selection returns no outcomes and
does not touch SQL or delete anything. Old unselected records are not pruned.

createProjectionRuntime accepts exactly one of paths or selection in its existing
versioned profile. Both together, neither, or invalid selectors fail at startup.
The existing fresh agent authenticator, single-run admission, restricted projector
pool and shutdown behavior are unchanged. No live profile or provider was enabled.

Results remain revision-bound snapshots, not a guarantee that HEAD never moves
after a check. Removal/tombstone policy, branch rollback, atomic manifest publication,
large-repository partitioning and durable Temporal scheduling remain separate.

## Verification

Provider-contract tests check selected paths without blob calls, pre-network
selector denial and all incomplete/unsafe/oversized tree failures. Reconciliation
tests check inventory tampering, blob mismatch, empty results, cancellation and
HEAD races. An empty-manifest runtime test uses synthetic provider responses and
verifies no SQL connection. The browser harness separately inventories actual
synthetic Git, selects two files (excluding the authorization JSON), and uses
real PostgreSQL replay/repair and authenticated browser readback. These are not
live GitHub inventory evidence or complete production runtime-factory integration.
See intent/0033/EVIDENCE.md and REPOSITORY-RECONCILIATION.md.
