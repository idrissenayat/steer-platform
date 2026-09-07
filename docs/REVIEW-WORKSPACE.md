# Reviewing recorded decisions

The authenticated production workspace includes **Review records** below the Brief
library when a repository is configured. It is a read-only source-inspection surface,
not the assigned decision Inbox. Gate actions and lifecycle advancement are not enabled.

## Use the workspace

1. Select **Refresh review list** to discover the Brief revisions you can currently read.
   The list shows up to 20 references per page; it does not fetch every Brief or decision.
2. Select **Inspect records for …**. STEER checks access to that exact path, revision and
   content fingerprint. Keyboard focus moves to the selected review source.
3. Select **Load decision records** to inspect the separately permitted decision sources.
   The record explicitly states whether it references this exact Brief revision.
4. Use **Inspect …** beside a referenced artifact to read its exact permitted source.
   Unconfigured or stale references remain unavailable; no newer artifact is substituted.
5. Use **Read this exact Brief** for the full document, or **Clear review records** to
   remove the review list and selected source. Refresh discovers records again.

The selected review source and full Brief dialog also include **Supporting documents**.
Select **Check supporting documents** to check the sibling Spec, Exam and Plan at
this Brief's exact commit. Each card distinguishes available projection, no projection
at that revision, and outside configured sources. **Source fingerprints** expands
the available record's hashes, not its body. **Clear document check** removes the
inventory and returns keyboard focus to the check button; an in-flight check can
be cancelled. No document checks run automatically when a Brief opens.
See [source coverage meanings and limits](LIFECYCLE-SOURCE-COVERAGE.md).

A recorded decision, named signer, matching revision, passing claim or evidence link
is not proof of a qualified signature or approved gate. The interface does not infer
assignment, due dates, urgency, readiness or the absence of other decisions.

## Access and privacy

Every read uses the existing server-side identity, grants and source curation. The
page's session display is not permission. No live grant is installed by this surface.
The supporting-document query requires the separate `intent.brief.artifacts` grant
introduced in 0190, plus Brief/raw-projection read grants. Missing grants deny the
check; the interface does not request or configure additional access. There is no
credential storage, background polling, automatic evidence fetch or save/signing action.

Failed access or unavailable exact selection clears the review sources. Session-display
expiry, page hiding, leaving the page and restored page-cache navigation also clear
content. Cancelled late reads cannot repopulate it. Returning to the page requires
explicit rediscovery; the existing Brief library retains its own independent clearing
and exact-link behavior.

## Implementation boundary

The source controller and panel are `apps/web/app/review-workspace-reader.ts` and
`apps/web/app/review-workspace.tsx`. Existing Brief/decision/evidence readers enforce
the same reference contracts as the library. No prototype lifecycle model is imported.
Numbered scope and verification: `intent/0189/README.md` and `intent/0189/EVIDENCE.md`.
Supporting-document display scope and verification: `intent/0191/README.md` and
`intent/0191/EVIDENCE.md`. Its request owner drops fingerprints after denial,
expiry, invalid/backward clocks, clear, page lifecycle events or unmount; cancelled
responses cannot overwrite a newer explicit check.
Authoritative lifecycle inputs, assigned Inbox actions, full governed saving and
approved real configuration remain separate items in `docs/JOURNEY-REMAINING-WORK.md`.
