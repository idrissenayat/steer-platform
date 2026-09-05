# Development evidence

Baseline e8180c24901c27f650bdd0a79163075290ca1222 plus this increment,
2026-09-05 UTC. Development verification passes; no gate approval is claimed.

Six new native web groups cover fixed origin/endpoints/options, generic error
handling without retries, actual size/chunk bounds and cancellation, close/late
responses/overlap, stalled header/body deadlines, and consumer deny/recovery.
An additional architecture-boundary group restricts browser registry imports.

The browser harness exercises the real compiled client against local synthetic
Keycloak, Git-backed grants and PostgreSQL. It adds reference load/refresh,
committed grant removal/recovery, foreign repository denial, clearing/lifecycle
and browser-clock display expiry. The clock case uses a separate browser page;
lifecycle events are explicitly synthetic, not a BFCache eligibility claim.

Actual browser result: `pnpm test:auth:browser` exit 0, all 30 counted groups plus
inventory passed on Keycloak 26.7.3 and Chromium 151.0.7922.34, Node 24.20.0.
The first load uses Tab/Enter, and populated desktop/mobile panels have no
automated WCAG 2.1 AA violations or horizontal overflow at 390px. Display expiry
does not issue another reference request. Desktop (1440px) and mobile (390px)
screenshots were inspected: pink/orange presentation preserved, field labels and
controls readable, long fingerprints wrap inside cards with no overlap/clipping.
This is visual/automated QA, not a qualified manual accessibility audit.

Two earlier unpaced expanded runs failed later existing authentication assertions
and are not counted as passes. Error payloads were deliberately suppressed, so
their exact failing response was not captured. The functional fixture now sends
application requests once at the existing sustained rate (one per 500ms). A
bounded Retry-After handler applies only to its read-only session assertions,
never login/logout or the production panel. The successful full run verifies
functional behavior under that pacing, not unpaced/fleet capacity. Production
admission limits and client no-retry behavior are unchanged.

Visual review also corrected an initial owner/name label to the actual canonical
repository scope ID. No URL-to-repository lookup is implemented or implied.

Final verification on Node 24.20.0 / pnpm 11.19.0:

- `pnpm check`: exit 0. Kit/security checks, typechecks, 88 prototype tests,
  23 control/boundary tests, package tests (web 11, API 67, registry 39) and builds
  pass. Unchanged packages use the repository's normal local build/test cache.
- `pnpm install --frozen-lockfile`: exit 0. Lock change adds only the explicit
  workspace consumer dependency; no vendor version was changed.
- `git diff --check`: pass.
- Candidate commit/remote equality is verified in the publication handoff.

Standalone data/Temporal evidence remains 0046 (33 PostgreSQL groups) and 0045
(18 Temporal groups). The browser run uses real disposable PostgreSQL too.
Run-owned authentication containers, TLS credentials and temporary data were
cleaned by the harness; screenshots contain synthetic identities/references only.
No standalone data/Temporal changes, live profile, credential use, spending,
production data deletion, gate signature, merge, deployment or release.
