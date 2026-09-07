# Development evidence — 2026-09-07

Base commit: `77abf4ec84fec3263d0ec793d06c0af8111111b2`.

Targeted actual-component tests passed:

- Authenticated reader still closes and clears on expiry, invalid or regressing clocks.
- Local kit reader opens with an invalid wall clock without installing an expiry
  interval, sends no requests, renders hostile-looking source literally, focuses
  sections and clears on pagehide.
- Actual local workspace retains a typed unsaved correction when entering the
  guide slot and returning to the editor; storage is unchanged.

Final checks with Node 24.20.0:

- Web suite: 91/91 passing.
- Architectural boundary controls: 8/8 passing.
- Web typecheck and production build: passed.
- Kit validation: 95 required artifacts valid; workflow scope audit passed.
- Diff whitespace check: passed.

Actual HTTPS browser verification on the rebuilt app, without signing in:

1. Opened the existing UI DEMO sample from the local backlog and typed an unsaved
   outcome correction. Chose Consult the operating guide.
2. Opened the reader and verified all eight canonical document choices.
3. Searched Gate 1, selected STEER Framework / The Three Gates and read the actual
   canonical section. Returned to the Brief; the unsaved outcome text was exact.
4. Restored the sample's original saved outcome without saving or deleting anything.
   No unsaved changes was correctly shown. Reopening the guide had an empty search.
5. Opened STEER Operating Model; the screenshot at
   `/tmp/steer-0195-guide.tTdB8j/operating-guide.png` was visually inspected. The
   existing user-facing preview tab is retained with the guide open.

The existing two frontend processes were restarted around the shared-output build;
PostgreSQL, Keycloak, identity configuration and volumes were unchanged. The HTTPS
root returned 200 with 105,684 bytes, below the unchanged gateway response bound.

The standing heartbeat was updated to reflect the user's functionality/UX priority
and the already-delivered morning handoff. Its interval, active state and target task
were preserved. No new automation was created.

The full repository control suite was last run in 0194 (443 passing); it is not
claimed rerun here. No all-package check, disposable identity-browser run or qualified
manual accessibility audit was performed for this bounded shared-reader change.

No credentials, session parameters, kit source, protected EXAM, signatures, provider
permissions, database, deployment or spending changed. This is local UX development,
not the real save-to-GitHub journey, an actionable Inbox or a Phase 1/gate acceptance.
