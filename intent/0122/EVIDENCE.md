# Evidence

Verified on 2026-09-06 using isolated Node 24.20.0.

## Commands and final results

- `npm exec --yes --package=node@24.20.0 -- pnpm --filter @steer/web test`:
  28 groups pass, including four new author-client groups. The final root run
  executes these again against the final implementation.
- Web/API typechecks and the actual production Next.js build pass.
- `STEER_WORKSPACE_SCREENSHOT_DIR=/tmp/steer-0122-browser.JzFpON npm exec --yes
  --package=node@24.20.0 -- pnpm --filter @steer/api test:auth:browser`:
  final run passes all 39 checks using Chromium 151.0.7922.34 and Keycloak 26.7.3.
  The real Next.js build, gateway, local HTTPS, encrypted PostgreSQL sessions,
  local Git grant commits and production preview registry execute together.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0; 95 kit artifacts,
  security scopes, typechecks, 88 prototype tests, 437 root controls, all package
  tests and builds pass. Root controls took 145.0 seconds. Turbo reused one of
  seven typechecks, two of eleven test tasks and four of seven build tasks.
  Browser integration and heavy root verification were run sequentially.
- `git diff --check`: clean. No changes to `intent/0001`, `.github` or lockfile.

## Failures found and corrected

Two browser attempts stopped at the initial new title interaction. Added safe
stage/status diagnostics localized the failure: heading and title input shared
`author-title`. The heading now uses `author-section-title`, and the real browser
explicitly checks all IDs in the author region are unique before interacting.

The next run passed both new author groups, then failed an existing Brief-library
accessibility check. The new reload scenario had correctly replaced the document,
also removing its injected test-only axe object. The library check now loads its
own checker after navigation. No production CSP, assertion, timeout or access
requirement was relaxed. The final complete run passes, including that old check.

## Observed browser behavior

- One visible interview prompt; keyboard preview moves focus to the result.
- Missing facts remain visible. Editing invalidates the prior digest, and exact
  corrected bytes produce a different SHA-256. Correction returns input focus.
- Source links remain inert and the result explicitly says not saved/confirmed/
  signed. Starting fields do not imply completeness or gate acceptance.
- Committed preview-grant revocation clears input and output. Navigation clears
  unsaved content without submission; the existing expiry scenario now verifies
  cleared author input and disabled preview too. No browser storage is written.
- Desktop and 390px viewport layout pass overflow checks and automated axe rules
  tagged WCAG 2 A/AA and 2.1 AA. This is not a manual accessibility audit.

## Retained visual evidence

Inspected the desktop and mobile renders; the original pink/orange palette,
readable controls, correction transcript and stacked mobile layout are preserved.
Only synthetic identity/content appears. The retained screenshots are:

- `browser/author-desktop.png`: SHA-256
  `8e1595273387c914bdeef35ff17f94d17e1f548a8c6e3c45f1e9304b863d71e4`.
- `browser/author-mobile.png`: SHA-256
  `4f6dd85dcd95beb6ec2839360002eae0161a556eb421ce39ccdd31708459a4eb`.

Temporary test containers, tmpfs database state and generated credentials were
removed by the scoped harness; no real user data was removed. Screenshot copies
are retained above. The user’s real browser profile and trust settings were unused.

## Boundary

No real account/provider operation, model call, Git artifact save, confirmation,
signature, deployment, spending or release. No R5 catalog credit, independent
review or formal finding closure. All five findings and signed Phase 1 obligations
remain open. This is the deterministic local preview checkpoint, not the accepted
agent conversation or complete five-step journey. Next follows `PLAN.md`.
