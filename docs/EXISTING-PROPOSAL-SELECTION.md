# Choose the existing proposal you mean to revise

In the actual package-review panel, an **extend-existing** direction now offers
**Revise an existing proposal**. This follows final scope review and does not
replace it. It also does not change the editor's documents.

## Human flow

1. Select the original drafting run as before.
2. Check **Revise an existing proposal**, then **Find existing proposals**.
3. Select a verified proposal at the reviewed repository commit. Use **More
   proposals** or **First proposal page** to navigate without carrying a selection
   between pages. No proposal is selected automatically.
4. A proposal whose target revision differs from the reviewed direction remains
   visible but disabled. Re-review the exact original target or choose a separately
   authorized new amendment; the system never silently rebases an existing proposal.
5. **Preview exact package** checks that the selected proposal, parent pointer,
   previous bundle and target are unchanged. Then use the existing separate
   [confirmation](CANDIDATE-PACKAGE-CONFIRMATION.md) and
   [save-request](CANDIDATE-SAVE-START.md) actions. No listing or selection writes Git.

When the checkbox is off, the trusted lifecycle/destination reader still determines
whether the item permits an unpulled candidate revision or a new amendment. The UI
does not choose that lifecycle, reserve a name or authorize another intent.

## Read boundary

`intent.candidate.proposals` is a distinct read-only HTTP/MCP tool. The explicit
uninstalled `createVerifiedCandidateProposalReader` composition uses the configured
Git reader and current subject/item/pointer/manifest/document permissions.
The browser cannot supply an authority callback or service configuration.

The existing Git reader verifies a non-truncated exact-commit tree with at most
10,000 repository entries and 1,000 entries under the item. Proposal pages contain
at most ten references, ordered by UUID, not by invented creation dates. A cursor
must name a proposal in that pinned inventory. Each returned proposal is backed by
the existing pointer/manifest/three-document verifier and matching same-tree blob
identities. Old unreferenced candidate directories are not selectable proposals.

Only reference metadata is returned. The server reads all three candidate documents
to verify the bundle but does not expose them in the list, agent input or browser
storage. Read-only exact saved-content inspection remains a separate authorized
action. Neither a proposal list nor a complete tree proves the proposal is open,
editable, unpulled or eligible for a gate.

Malformed paths, nonregular pointers, missing parent directories, invalid UUIDs,
unverifiable selected bundles, access loss and inventory failure withhold the page.
Errors are generic and do not imply empty inventory. Current authority surrounds
I/O and result release. There are four operation slots, a 30-second total limit,
existing 15-second per-bundle limits and no automatic retry or latest-head fallback.
An unresolved underlying dependency retains its operation slot after cancellation.

## Acceptance and remaining work

[0263 evidence](../intent/0263/EVIDENCE.md) distinguishes native synthetic Git,
HTTP/MCP, React and database regression checks from a live human walkthrough.
This reader is not installed into the live application, and the trusted destination/
lifecycle authority composition is still required before real publication. D1
records adoption, model budget, current provider/grant evidence, quarantined-outcome
resolution and actual signed-in I1–I6 acceptance remain open. No new key, live
runtime save, release or deployment is enabled by this increment.
