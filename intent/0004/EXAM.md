# Exam: Learn STEER hub

Derived from: 0004-BRIEF.md and 0004-SPEC.md
Status: draft, pending Gate 2 (Tech Lead, after Critic findings resolved)
Tiering: accessibility cases (section E) are default-closed and approved
before code. Other sections may co-evolve during the build, complete and
Critic-reviewed before Gate 3. Builders cannot edit this file
(exam-protection hook).

## A. Canon fidelity

1. Every hub page's rendered content matches the kit file at the tagged
   framework version, byte-for-byte after markdown rendering
   (fixture per document type).
2. The version badge on every page equals the kit's framework version; a
   seeded mismatch fails the CI check and blocks the build (the brief's
   guardrail, tested in both directions).
3. A document absent from the kit renders as absent in the hub
   navigation, never as an empty page or a stale copy.
4. "Suggest a change" on any page files an intent referencing the page
   and section; it never edits content in place.

## B. Navigation, peek, and search

5. A tagged term opens its glossary entry as a peek panel without
   navigation; dismiss returns focus to the term; only one peek can be
   open at a time.
6. Terms link on first occurrence per section only (fixture with
   repeated terms).
7. Deep links open the correct page at the correct section anchor; a
   deep link to a removed section lands on the page top with a visible
   notice.
8. Seeded search queries return their expected section hits and open at
   the anchor; queries with no hits say so plainly (fixture corpus).

## C. Agent slices

9. The manifest resolves every agent role to its file list; each slice's
   content byte-matches the source files at the tagged version.
10. The Builder slice fixture excludes portfolio-layer content and
    includes the exam invariant (membership tested both ways).
11. A manifest change triggers the eval suite rerun; a seeded pass-rate
    drop blocks the merge (eval-gate hook, tested end to end).

## D. Orientation path and statelessness

12. Each accountability's path renders its five ordered steps, and the
    final step links to a live action surface appropriate to the role
    (four fixtures).
13. No per-user progress is stored: a storage crawl after a full
    walkthrough shows instrumentation events only, no reading state,
    no bookmarks, no artifact content.

## E. Accessibility (default-closed; approved before code)

14. Hub pages, the peek panel, search, and the orientation path are
    completable by keyboard alone; the documented walkthrough passes.
15. The peek follows dialog focus rules: focus in on open, trapped,
    returned on close (automated + manual).
16. Screen-reader pass: reading order matches the outline; the version
    badge and leaving-workspace markers are announced as text (manual,
    per the 81-checkpoint model).
17. Zero critical or serious axe-core violations on every hub surface,
    enforced in the gauntlet.

## F. Outcome instrumentation

18. Hub events carry page, section, and timing identities only; a seeded
    scroll-position probe confirms no finer-grained capture exists.
19. First-login-to-first-action timing is computable from the event
    stream (dependency on 0002's schema); a dry-run over fixture events
    reproduces the expected median against the recorded baseline.

## G. Platform invariants

20. No-write invariant: the hub adds nothing authoritative to platform
    storage; the destroy-and-rebuild test renders identical hub content.
21. The hub serves fully in the self-hosted profile with no external
    dependency in the content path (regulated smoke test).

## Pass condition

All automated cases green in the gauntlet; section E additionally
requires the accessibility specialist signature at Gate 3. This item's
first-pass rate and any escapes feed the platform pod's trust ledger.
