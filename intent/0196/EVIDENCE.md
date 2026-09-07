# Development evidence — 2026-09-07

Base: `570c1437c7a39bb33dc5e02bf8998875ac838485`.

## Reproduction and correction

On the actual HTTPS app, an unsaved outcome correction followed by Return to
sign-in workspace left focus on the opener, with zero dialog elements. Learn STEER
remained clickable and changed views while the old discard action stayed active.

The native modal replacement takes safe focus, makes background content inert and
restores the opener on cancellation. Initial real-browser testing found native Tab
could leave the two choices for browser chrome. Explicit forward/reverse boundary
handling was added, regression-tested and verified on the final rebuilt app.

## Automated checks

Node 24.20.0:

- Web suite: 91/91 passing, including actual component cancellation, focus restoration,
  Tab/Shift-Tab boundaries, missing-title focus, simulated storage rejection preserving
  edits, retry success and no provider requests.
- Architectural boundary controls: 8/8 passing.
- Web typecheck and final production build: passed.
- Kit validation: 95 required artifacts valid. Workflow token scope audit passed.
  Diff whitespace check passed.

The initial typecheck failed on four duplicate generated `... 2.ts` files under
`apps/web/.next/types`. Each was compared with its original and found byte-identical.
Only those four generated duplicates were moved recoverably to
`/tmp/steer-0196-qa.orpEfV/`. Source files and TypeScript checks were not weakened.
Typecheck and builds then passed. The cause of the duplicates is not established.

## Actual UI checks

- Opened UX preview without sign-in and reopened the existing UI DEMO sample.
- Correction link focused its exact input; decorative numbers were absent from
  accessible textbox names.
- Unsaved exit opened a labelled `dialog:modal`, initially focused Keep editing.
  Shift-Tab wrapped to Discard unsaved edits; Tab wrapped to Keep editing. Escape
  removed the modal, restored Return to sign-in workspace focus and kept exact edits.
- Removal displayed the exact sample title and initially focused Keep draft.
  Cancellation kept the draft. No real browser record was deleted.
- At 390×844 and 320×640 viewport settings, the last editor field remained visible
  below the sticky toolbar. Observed document widths were 375 and 320 respectively,
  no larger than their viewports. Screenshots were visually inspected. These were
  desktop browser viewport tests, not physical mobile or virtual-keyboard tests.
- Guide opened with all eight canonical document choices; Return to Brief preserved
  the exact unsaved correction. The original sample outcome was restored and explicitly
  saved. Reload → Open UX preview → no-match search → title search → reopen showed
  all original saved answers correctly. Only the sample save timestamp changed.
- One automation sequence clicked immediately after reload without entering preview;
  after inspecting the ready entry, the explicit click succeeded. No data was lost.
  Cold-load interaction timing has not been exhaustively tested.

Screenshots inspected: `/tmp/steer-0196-qa.orpEfV/confirmation.png` and
`/tmp/steer-0196-qa.orpEfV/review.png`. The existing tab is retained on the saved review.

Only the owned frontends were restarted around builds. PostgreSQL/Keycloak and
volumes stayed running. The trusted HTTPS root returned 200, 105,684 bytes. Startup
continues to explicitly report GitHub saving disabled.

## Limits

No full all-package/control-suite rerun, qualified screen-reader/accessibility audit,
physical-mobile keyboard test, 200% zoom audit, live provider save or gate acceptance.
No authentication, permissions, model usage, canon, protected EXAM, signatures,
deployment or spending changed. The existing untracked roadmap/outputs were preserved.
The form-based preview does not complete the intended agent conversation or J1–J6.
