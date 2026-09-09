# 0263 — Existing-proposal selection

1. A separately granted `intent.candidate.proposals` HTTP/MCP query lists one
   configured item's proposal pointers at an explicit immutable reviewed commit.
   Reject caller-selected heads, foreign owner/product/repository/branch/items,
   extra fields, malformed cursors and unavailable readers before disclosure.
2. Enumerate a complete regular Git tree under the requested item with existing
   repository bounds. Strictly validate paths, parent directories, modes and
   proposal UUIDs. An unavailable, truncated or malformed inventory is an error,
   never an empty list or permission to create work.
3. Each page contains at most ten proposals, ordered by lowercase UUID. A cursor
   must exist in the same pinned inventory. Verify each selected pointer, manifest
   and all three document blobs with the existing bundle reader, against the same
   commit/tree. Return only proposal/parent/target references, not document bodies.
4. Recheck current identity and exact item/pointer/manifest/document read authority
   around I/O and before release. Four in-flight operations, a 30-second total
   bound, existing per-bundle bounds and retained pending admission prevent late
   disclosure or unbounded work. Closure does not authorize more reads.
5. The actual package panel supports explicit proposal discovery, pagination and
   selection only for extend-existing direction. Never auto-select a proposal.
   A target revision different from the reviewed direction is visible but disabled;
   no silent rebase or invented legacy-to-items mapping is permitted.
6. Selection invalidates a prior preview. The next preview must match the chosen
   proposal ID, exact parent pointer digest, previous bundle digest and target.
   A non-null selected ID must represent an existing amendment with both parents,
   not creation of a first pointer. Confirmation binds the verified exact preview.
7. Identity, visibility, source and review changes clear/abort the selection.
   Failure cannot become a no-proposals claim. Uncertain confirmation still keeps
   its exact original recovery command; selection cannot replace that command.
8. Listing and selection never assert lifecycle eligibility, semantic newness,
   consent, execution, Git success or a gate. No live provider binding, records
   adoption, credentials, paid model call or canonical-document write is enabled.

See [workflow guide](../../docs/EXISTING-PROPOSAL-SELECTION.md) and [evidence](EVIDENCE.md).
