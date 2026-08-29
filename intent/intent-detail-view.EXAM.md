# Exam: Full brief detail view in the intent backlog

Derived from: intent/intent-detail-view.md and intent-detail-view.SPEC.md
Status: draft, pending Gate 2 (Tech Lead, after Critic findings resolved)
Tiering: accessibility cases (section D) are default-closed and approved
before code. Sections A-C and E may co-evolve during the build, complete
and Critic-reviewed before Gate 3. Builders cannot edit this file
(exam-protection hook).

## A. Rendering fidelity

1. For a fixture intent containing every field, the panel renders all
   fields in the spec's reading order, and every rendered value matches
   the committed revision byte-for-byte after markdown rendering
   (fixture-tested).
2. Optional fields absent from the artifact render as absent, never as
   empty placeholders or invented defaults.
3. Open questions render expanded on open; a fixture with five questions
   shows all five without interaction.
4. The measurable-today badge in the panel matches the card's badge for
   the same revision; a pending badge states what is missing.
5. Provenance renders by kind per the spec: band breach shows band,
   values, and window link; ticket cluster shows count, sources, and
   three most recent excerpts; named originator shows identity and
   channel (three fixtures).
6. Revision history lists revision, author, timestamp, and first changed
   line for a fixture with four revisions, newest first.

## B. Actions

7. All four actions are available from the panel footer and complete
   without navigation; each records its instrumentation event with
   surface = detail_view.
8. Pull at the WIP limit: the button is disabled, shows the live slot
   count, and a forced submission is refused server-side; no work item is
   created (both layers tested).
9. Pull below the limit creates the work item, consumes a slot, and the
   panel closes with the backlog updated.
10. Decline requires a reason (category or free text); an empty decline
    is refused; the recorded decline carries the reason and triggers the
    cluster cool-down.
11. Merge shows the would-be merged card before confirming; cancel makes
    no change; confirm records the merge with member identities.
12. Send back one question routes the text to the originator's channel
    and records it; the intent remains in the backlog.
13. Cluster member navigation replaces panel content, back returns to the
    original member, and the panel never opens a new route (history
    fixture).

## C. Staleness and truth

14. If the artifact revision changes while the panel is open, any
    in-flight action voids, the panel re-renders the new revision with a
    visible notice, and the retried action records against the new
    revision (race fixture, same pattern as gate-sign test 5).
15. No-write invariant: a storage crawl after a full session (open, read,
    every action, dismiss) shows no artifact content, no view state, and
    nothing beyond instrumentation events.
16. The deep link opens the backlog with the correct panel open at the
    current revision; a deep link to an expired intent shows the recorded
    expiry, not an error.

## D. Accessibility (default-closed; approved before code)

17. The panel is a labeled dialog: focus moves in on open, is trapped
    while open, and returns to the originating card on close (automated
    + manual).
18. The full flow (open from card, read all fields in order, take each of
    the four actions, dismiss) is completable by keyboard alone; the
    documented walkthrough passes.
19. Screen-reader pass: reading order matches the spec's visual order;
    badge states are announced as text; the disabled pull state announces
    the slot count (manual, per the 81-checkpoint model).
20. Zero critical or serious axe-core violations on the panel in all
    states (empty fields, WIP-blocked, stale notice), enforced in the
    gauntlet.

## E. Outcome instrumentation

21. Per-action events carry: action, surface, intent identity, revision,
    and duration from open to action.
22. External-tool exit: activating "open source file" records a measured
    exit; panel dismissal without action records none; overcount fixture
    (rapid open/close) produces exactly one exit event.
23. The events are sufficient to compute the brief's contract (95% of
    actions from the detail view; median open-to-action time) against
    the pre-feature baseline item's data; a dry-run computation over
    fixture events produces the expected figures.

## Pass condition

All automated cases green in the gauntlet; section D additionally
requires the accessibility specialist signature at Gate 3 (manual
keyboard and screen-reader pass). This item's first-pass rate and any
escapes feed the platform pod's trust ledger.
