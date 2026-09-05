# Inventory contract

Extend the GitHub reader as RepositoryReader with readInventory(selection, revision).
Existing ArtifactReader remains compatible. A strict selector contains 1–10
nonoverlapping unique roots and 1–20 unique exact fileNames. Roots are normalized
relative directories; an explicitly supplied empty root means the whole repository.
File names are normalized single path components. Match beneath root boundaries
and by exact case-sensitive basename, not substring, glob or request-selected SQL.

Validate selectors and immutable lowercase 40-hex revisions before network access.
Use the existing single-repository contents-read installation token, transport
budgets and 2 MiB response limit. Resolve the exact commit/tree and require matching
object identifiers, untruncated recursive tree, at most 10,000 entries, normalized
paths and no duplicates. Check recognized mode/type combinations. Any selected
entry that is not a regular nonexecutable blob (100644) fails rather than silently
disappearing; unrelated valid symlinks/executables/submodules are not selected.
At most 100 selected artifacts; overflow fails, never truncates. Return only org,
repository ID, revision, treeSha and sorted path/blobSha descriptors, no file bytes.

reconcileRepository validates inventory identity, revision, uniqueness and selector
containment, rechecks HEAD and invokes existing bounded staging for exactly that
revision. Artifact blob identities must match inventory descriptors. HEAD movement
between discovery and staging fails before storage rather than adopting a newer
revision. Existing before-write and final HEAD checks, hash/byte bounds, CAS,
partial failures and superseded outcomes remain intact. Empty inventory returns
no outcomes and performs no SQL writes or pruning.

The explicit projection runtime accepts exactly one of paths or selection in
its strict profile; existing paths profiles remain compatible. Selection invokes
the inventory composition through the real reader and existing agent/sink boundary.
No default selector, HTTP route, new credential, timer or implicit agent is added.

Trust remains in the authenticated code-host adapter/provider. Matching returned
object IDs and blob hashes is not an independently reconstructed cryptographic
commit/tree proof. No atomic repository publication, perpetual HEAD freshness,
large-repository partitioning, source-removal/rollback policy, deletion, durable
worker or live provider activation is claimed. Read-model tool allowlists remain
independent and are not broadened by discovery.
