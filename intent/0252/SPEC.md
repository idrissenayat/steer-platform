# Specification — Exact saved candidate reopening

1. `intent.candidate.read` is a query, not a command. HTTP and MCP use the same
   registry contract and explicit tool grant; no default service installation.
2. Input is an exact organization/product/repository/branch/item/bundle/commit/
   manifest reference. Moving heads, traversal, extra fields and incomplete input
   are rejected. The service pins subject and permitted items. Current identity
   and source authority are required throughout each operation.
3. Read exactly the manifest and three regular Git blobs at the selected commit.
   No latest-head lookup, partial success, canonical-file fallback or mutation.
4. Preserve original manifest and document bytes including Unicode, BOM and
   line endings. Verify fixed paths, manifest home, selected reference, SHA-256
   and native Git blob hashes at server and browser boundaries. Parsed JSON
   equality cannot replace exact manifest-byte verification.
5. Keep shared read admission bounded, cancel on closure and suppress late data.
   Non-void authorization callbacks do not count as successful authority.
6. Render only in the signed-in workspace. Canonical links contain reference
   metadata, not source content or permission. A link selects, never authorizes.
7. Display candidate status, exact commit, purpose, review state and each safe
   Markdown document. Provide source details and read-only document controls.
8. Preserve current drafts. Clear saved content on failed read, scope/identity
   change, page hide/navigation, expiry and closure. No local/session storage,
   automatic retry, polling, replacement/adoption or background model work.
9. No byte-verified result declares current branch state, semantic accuracy,
   accepted Spec/Exam, gate signature or execution permission. Real source
   provenance remains the responsibility of the trusted Git/authority composition.

See [the guide](../../docs/SAVED-CANDIDATE-REOPEN.md) for the remaining save boundary.
