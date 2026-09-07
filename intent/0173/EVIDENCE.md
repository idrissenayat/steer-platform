# Evidence

## Implemented scope

An explicit per-item Preview reads the same curated path/revision/digest through the
existing current-authorized Brief reader. One in-memory summary shows the source title,
Problem and Proposed outcome excerpts and selected revision. No extra API/grant,
prefetch, poll, model call, browser persistence or write path is introduced.

The presenter distinguishes missing, empty and ambiguous structure, checks that
source offsets match the body and never selects one duplicate. Literal excerpts
are bounded to 1,600 UTF-16 units without splitting surrogate pairs; truncation is
explicit and the existing Read action opens the full source. Text remains inert.
Clearing returns keyboard focus; refresh, pagination, other reads, navigation/hiding,
scope/session expiry and failure use the existing reader disposal boundary.

## Verification — 2026-09-07

- Four new source/rendering tests passed: exact Unicode/CRLF bodies and source order,
  missing/empty/duplicate/unsafe sections, inconsistent offsets, pair-safe truncation,
  escaped HTML/link/media text and explicit unverified-source language.
- Web suite passed all 65 tests. Workspace tests, kit/workflow validation, typechecks
  and 88 prototype tests passed; unchanged tasks used local Turbo cache.
- Actual browser checks passed the new exact source preview and explicit clear,
  navigation and committed-grant denial scenarios. The existing work-list case
  verifies keyboard access, narrow and 200% text layout and automated accessibility.
- Desktop and mobile captures were visually inspected: the existing pink/orange
  treatment is retained, source fields stack on narrow screens and long fingerprints
  wrap without overflow. Screenshots contain only disposable synthetic data.
- Repository controls: all 438 passed. Both actual Keycloak 26.7.3 / Chromium
  151.0.7922.34 browser regressions passed all 45 checks. The final run includes the
  keyboard-focus refinement and clarified missing-section wording, and preserves
  held saving, one-time creation, durable projection/replay and exact-source recovery.
  Its desktop/mobile captures were also visually inspected. Both runs cleaned their
  owned Chromium/HTTPS/Temporal services, synthetic PostgreSQL/Keycloak containers,
  data and generated credentials. Temporary synthetic QA captures remain separate
  from canonical gate evidence.
- Final prototype and workspace builds passed, followed by a successful repeated
  workspace regression (11 tasks; nine unchanged tasks reused local Turbo cache).
  The `pnpm check` components were run in phases so the final Next build did not
  overlap the active browser regression; no tests were skipped or reclassified.

## Limits

These are exact source excerpts, not generated summaries, verified outcomes or an
authenticated lifecycle board. Mission fit, originator/provenance, measurement badges,
domain routing, gate states and backlog mutations are not inferred from text.
All five R5 findings, full governed write authority and independent/qualified review
and human signatures remain open. No protected artifact, dependency, schema, live
configuration, provider access, deployment, release, spending or real deletion changed.
The Sites skill was used to preserve the existing UI and keep this background work
local; no Site registration/hosting or user-facing browser handoff was performed.
