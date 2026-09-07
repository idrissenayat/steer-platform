# Evidence

## Implemented scope

Closed-by-default browser submission now binds exact reviewed content, destination,
current subject and one UUID operation. It uses a separate bounded mutation transport;
the read-tool allowlist is unchanged. Manual current-status recovery verifies the
original receipt and never resubmits. Feedback survives destination expiry and draft
changes; hiding/leaving clears details while preserving the attempted latch. No browser
persistence or automatic polling/retry is introduced. See `docs/BRIEF-SUBMISSION.md`.

## Verification — 2026-09-07

- Web tests: 61 passed, including seven new controller/transport groups and an actual
  rendered lifecycle test. These cover duplicate clicks, invalid/mismatched receipts,
  review/identity/path mismatch, stale destination, expiry/clock rollback, ignored
  aborts, bounded transport, cleanup and attempted-operation retention.
- Actual browser authentication integration: 43 checks passed; Chromium 151.0.7922.34,
  Keycloak 26.7.3, isolated synthetic identities and encrypted PostgreSQL sessions.
  The new check uses actual authoring and confirmation controls, creates a native Git
  Brief/operation pair once, loses its acknowledgement, reconstructs the identity
  service, manually recovers status, waits through actual destination expiry, revokes
  and restores current status membership, then opens the exact created/projected Brief.
- Desktop and 390px mobile/200% wrapping and automated accessibility checks passed.
  The saved desktop/mobile submission screenshots were visually inspected: receipt
  values wrap within the panel, recovery controls and exact-record link are readable,
  and the existing pink design tokens are preserved. Local screenshots:
  `/tmp/steer-0167-browser.tPg4cD/submission-desktop.png` and
  `/tmp/steer-0167-browser.tPg4cD/submission-mobile.png` (ephemeral, not Git artifacts).
- Original actual Brief-creation integration: three groups passed.
- Full `pnpm check` passed: 88 prototype tests, 438 repository controls, 99 registry,
  24 data, 61 web, 283 adapter, 91 API, 23 worker and 13 domain tests; all workspace
  typechecks/builds, kit and workflow-scope checks passed. No test failures or skips.
- Actual Temporal integration: 25 checks passed, including actual HTTP creation,
  lost acknowledgement, reconstructed worker/status, exact curated readback and
  independent human/projector revocation. Only owned test workers/server and synthetic
  PostgreSQL data were cleaned.
- Final browser rerun passed all 43 checks again, including an assertion that an
  attempted review no longer says “Not saved”; it points to the operation status
  without inventing its outcome. Final desktop/mobile receipt screenshots were
  inspected again. After this run, the preview notice alone was clarified to
  “Previewing does not save, confirm or sign.” The 61 web tests were rerun and passed;
  the final web build/typecheck was rerun for that copy-only change.

Initial browser attempts timed out before creation. Diagnostics confirmed HTTP 200
and a ready preview; the digest element was inside collapsed details, so the test
incorrectly waited for visibility. Waiting for attachment fixed the locator without
loosening production checks. The long scenario also performs a fresh actual test login;
no session TTL or clock is overridden. All owned resources from failed runs were cleaned.

## Provenance and limits

Actual local browser, Keycloak login/session, native Git current membership, production
request-owned writer, Git object creation/CAS and PostgreSQL exact-source reads are
exercised. The code-host network wrapper and full Gate 2 authority callback are explicit
test doubles; no real provider credentials or real-person gate signatures are used.
The test-only Git wrapper has no external network fallback. The browser uses the
owned API receipt-projection job; 0166 separately verifies Temporal. This does not
prove an installed browser-to-worker scheduler or real end-to-end authorized saving.

Only this run's isolated Chromium, HTTPS/Next servers, synthetic PostgreSQL/Keycloak
containers, tmpfs records and generated test credentials were removed. No real records
were deleted. No live environment, provider grants, scheduler, deployment, release,
spending or gate approval is enabled. All five R5 findings, full governed authority,
model conversation, independent/qualified protected review and human signatures remain
open. No dependency, database schema or protected `intent/0001`/GitHub control changed.
