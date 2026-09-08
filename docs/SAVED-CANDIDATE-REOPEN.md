# Reopen an exact saved candidate

0252 connects a read-only candidate-bundle query to the actual signed-in Next
workspace. It is not a new preview or a save command. The server reader remains
an explicit, uninstalled composition until current repository/read authority is
available. No new grants or real provider access are enabled by this feature.

## Human interaction

An exact saved-candidate link selects organization, product, repository, branch,
item, bundle UUID, full Git commit and manifest SHA-256. The application checks
current access and opens all three documents together. BRIEF, SPEC and EXAM
buttons switch the read-only view; source details retain original text, path and
digest. Existing safe Markdown prevents executable HTML, active source links and
remote images. The current conversation and unsent draft are not changed.

The heading identifies **saved candidate** content. Spec conformance and Exam
review remain explicitly unreviewed or stale. A candidate is not an accepted
Spec, canonical independent Exam, gate signature or permission to execute.

Reopen checks the same exact revision again. It never follows a moving branch or
substitutes a newer pointer. Incomplete, ambiguous or denied links show a safe
error with no partial document display. Hide, navigation, session-display expiry
and closure clear the saved preview; late responses cannot repopulate it. No
browser storage, automatic polling, background retry or draft adoption occurs.

## Technical contract

`intent.candidate.read` is an explicitly granted query shared by HTTP, OpenAPI
and MCP. Its reference-only input does not contain credentials, consent, source
prose or authority callbacks. The service pins the authenticated subject and
organization/product/repository/branch/item allowlist. Identity and scope are
revalidated before, during and after reads, including before final delivery.

`createVerifiedCandidateBundleReader` composes the existing regular Git-blob
reader and current source authority. It shares bounded admission and retains
slots for dependencies that outlive timeouts. It does not install itself through
environment settings, mint credentials, write Git, grant access or read latest.

The wire result carries exact manifest bytes, parsed manifest, three documents
and source hashes. Server and browser verify the selected reference, fixed paths,
manifest SHA-256, every document digest and Git blob hash. Equivalent JSON is not
silently reformatted. These byte checks are not standalone provider provenance:
the trusted server must still perform real regular-blob and authority checks.

The production `candidateFragment` helper produces canonical metadata-only links.
The viewer is mounted only inside the existing signed-in workspace. No form asks
the human to supply document bytes or to claim approval.

## Not yet complete

This slice verifies explicit-link reopening with native temporary Git fixtures,
synthetic identities and actual React components. It does not prove a live human
saved a bundle. Save preparation/confirmation/start/status wiring, current
full-corpus/lifecycle authority and save-receipt-to-link integration remain open.
Candidate discovery is separate; this reader does not enumerate all items.
Existing draft records and model-spend activation boundaries remain unchanged.
See [0252 evidence](../intent/0252/EVIDENCE.md) and [the journey plan](INTENT-JOURNEY-PLAN.md).
