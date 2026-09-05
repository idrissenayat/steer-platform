# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0, from parent candidate
`32c8213b0490d53954143e739675ca20c2122180` plus this increment.

## Observed corrections

The initially selected Playwright 1.63.0 had been released only hours earlier;
pnpm automatically added minimum-release-age exceptions. Those exceptions and
the 1.63.0 lockfile entries were removed. Final dependency is Playwright 1.62.1,
with its matched Chromium 151.0.7922.34. `pnpm-workspace.yaml` has no change and
the frozen install passes without an age-policy exemption.

The first browser run passed the scoped TLS/negative-certificate check but
failed native login navigation. The test form page's self-only CSP blocked the
configured cross-origin authorization redirect. Adding only that exact IdP
origin to `form-action` resolved it. No browser-route or token validation was
weakened. The requirement is recorded in `docs/KEYCLOAK-IDENTITY-PROFILE.md`.

## Final verification

- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0;
  six existing agent groups plus seven actual Chromium groups passed against
  Keycloak 26.7.3 and encrypted PostgreSQL. Verified native sign-in, cross-site
  callback/login-cookie delivery, absence of callback-query referrer, opaque
  Secure/HttpOnly/host-only/Lax session cookie, no web-storage or JavaScript
  credential exposure, ciphertext-only DB payload, cross-site logout cookie
  omission/API 403, app/store reconstruction, grant revocation, replay and
  native logout with cookie/database removal and subsequent 401.
- Chromium ran headless with a fresh profile and enabled sandbox. Browser TLS
  exception was restricted to this run's certificate SPKI; `ignoreHTTPSErrors`
  stayed false and an unrelated self-signed certificate was rejected. This is
  not a public CA-chain validation pass or a system trust modification.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:integration`: exit 0,
  all 13 assembled HTTP/provider/storage groups passed after the shared setup edits.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:identity:integration`:
  exit 0, all 12 provider-only groups passed.
- `pnpm install --frozen-lockfile --ignore-scripts` and root Node 24 `pnpm check`:
  exit 0. Kit/scope checks, typechecks, prototype/control/workspace suites and
  builds passed. Unchanged package builds/tests use local Turbo cache.
- Every run confirmed closure of its isolated browser/HTTPS servers and cleanup
  of owned pools, labeled containers and temporary certificates/realm secrets.
  Browser binaries remain in the standard Playwright cache; no traces, videos,
  HARs or screenshots of credentials were recorded. `git diff --check` was clean.

## Remaining boundaries

Only Chromium and an isolated test form page are covered. The production Next.js
UI, Safari/WebKit/Firefox, manual accessibility, real Git-derived membership and
public ingress/operational settings remain unverified. No real account or GitHub
key was accessed, and no public route, spending, deployment, release, protected
Exam edit or gate signature was authorized or performed.
