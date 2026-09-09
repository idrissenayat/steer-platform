# Review the final candidate before saving

0254 connects a read-only final-draft review to the actual authenticated
conversation. It is separate from both agent drafting and GitHub publication.
See [the journey](INTENT-JOURNEY-PLAN.md), [contract](../intent/0254/SPEC.md) and
[evidence](../intent/0254/EVIDENCE.md). Backend factories remain uninstalled.

## Human flow

1. Preserve the current editable Brief, Spec and Exam with the original intent
   and clarification turns. Unacknowledged edits cannot enter final review.
2. Review existing work for this exact preserved revision. For nonempty scope,
   read a complete recorded assessment. Only explicitly complete empty inventory
   skips a scope-model call; failed or incomplete search never does.
3. Choose a direction and explain the missing/distinct scope. An existing-target
   choice must identify an exact currently reviewed Brief and revision.
4. Select **Review final draft for saving**. This does not regenerate documents,
   create an operation, confirm a save or write GitHub. It can be used while
   generation is disabled if the required recorded assessment already exists,
   or the currently authorized inventory is explicitly empty.
5. Inspect the exact preserved revision, repository commit and all three document
   SHA-256 hashes/UTF-8 byte counts. Changed text, choice, assessment, access or
   source revision invalidates the result; changing back does not revive consent.

The UI preserves the existing pink/orange controls, moves keyboard focus to the
result and clears it on denial, identity change, hide, page exit and expiry. It
does not poll, store browser copies or replace the editor. A late response cannot
restore a dismissed review. The fixed same-origin read has a 70-second deadline;
the server has a 60-second bound with at most four active reviews, retaining slots
until outstanding dependencies really drain.

## Server flow and trust boundary

`intent.candidate.save.review` is a shared HTTP/OpenAPI/MCP query restricted to a
current human principal and matching owner/product/repository/configuration.
The request carries exact draft/review references and the human's choice—not
document content, findings, authorship claims, budget, destination allocation,
operation ID or authority assertions.

The explicit `createRecordedCandidateSaveReviewer` composition uses the existing
owner-bound draft service, current source-review service and recorded scope reader.
The actual repository collector and pinned recorded-SDK verifier remain the
required production sources for those services. Trusted callbacks are not
implemented real authority merely because tests supply synthetic substitutes.

The service restores the exact latest preserved revision, recomputes final
Brief/Spec scope, requires all three nonempty documents, checks complete whole
source context and consumes the exact recorded assessment (or proven empty
inventory). It validates the selected existing target, then rechecks records,
sources, assessment, keys/lifecycle and identity before disclosing a result.
Concurrent new scope or newer human edits invalidate the review.

Versioned assessment, disposition and final-review digests bind the exact bytes,
owner, configuration and current repository head. Exam-only changes affect the
final review even though they do not change duplicate-review scope. Response
hashes establish equality, not provider provenance or semantic correctness. The
browser also compares every document digest with the preserved editor snapshot.

The existing recorded scope reader requires the exact latest preserved revision.
Although Exam-only edits leave the scope fingerprint unchanged, this increment
does not add cross-revision assessment reuse. Any such reuse needs a separately
verified historical binding, not automatic renewal of old execution authority.

## Not yet a save preparation or signature

This read-only result is **not** `intentSaveBinding`, durable human consent,
generation lineage, an allocated item/bundle, admitted candidate original, save
receipt, execution permission, Spec conformance, independent Exam acceptance or a
gate. A future save-preparation service must reconstruct this review under current
authority; it must not trust a browser-returned digest as permission.

Destination/lifecycle selection, historical generation lineage and assessment
reuse, immutable bundle
preparation, exact human confirmation, original admission and start remain open.
Use [original save recovery](CANDIDATE-SAVE-RECOVERY.md) only after those services
produce a real admitted original reference, and [exact reopening](SAVED-CANDIDATE-REOPEN.md)
only after a verified save. D1 remains unsigned/inactive; the proposed model
budget and real runtime GitHub-write authority remain unapproved. Synthetic
SQL/native-Git/React evidence is not live signed-in human acceptance.
