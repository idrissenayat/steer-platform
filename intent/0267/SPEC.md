# 0267 implementation specification

1. Preserve final review's current source-snapshot/head requirement. Selected
   existing proposals additionally require a strict server-derived continuity
   descriptor binding original target/current review revisions, both root trees,
   equal item-surface digests, reviewed Brief digest and exact pointer/manifest parents.
2. Verify the selected proposal pointer, manifest and all documents at the current
   reviewed commit. Obtain original target only from that verified manifest, not
   browser text. Read and validate original-target inventory and Brief bytes.
3. Compare all item entries except protocol-owned candidate/proposal directories.
   Include root Spec/Exam, gates, hidden files, nested directory OIDs, paths and modes.
   Require regular blobs/trees, valid reserved directories and at most 128 compared
   entries per snapshot. Different, inaccessible or unsupported surfaces deny.
4. Authorize all compared regular sources at both revisions and read exact Brief
   bytes under current permissions. Do not expose canonical Spec/Exam content in
   the preview. Physical equality does not establish lineage or semantic impact.
5. Require additional independent current policy eligibility: original-target
   lineage, open/eligible selected proposal and any outside-item invalidation.
   Explicit eligible-unchanged-target proof must bind continuity and remain stable
   through final source/branch/identity/time checks. No constant service fallback.
6. Pure preview binds the descriptor to the reviewed current choice and original
   amendment target, checks both parents and strips the descriptor from the inert
   write bundle. Non-selected directions cannot carry continuity. Existing selected
   previews without continuity are unavailable; no stored originals are rewritten.
7. The actual chooser allows deliberate older-target selection and displays both
   commits. Confirm only after verified preview and unchanged selected parents.
   Changed or unknown target eligibility does not clear selection, rebase or create
   a new proposal. Keep authenticated transport, lifecycle invalidation and design.
8. Native Git A → B → C tests, pure contract negatives, human-only API query tests,
   actual-component tests and existing save regression must distinguish physical
   repository proof, synthetic policy/review/lineage and real signed-in acceptance.

Factories remain uninstalled. This introduces no model call, spend, live provider
write, SQL schema/migration, new credential, gate or deployment authority.
