# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`342c9539fb43b454f9d993eceed85df91dfb1be1` plus this increment.

## Observed correction and visual review

Read the installed Next.js 16.3.4 connection, runtime-environment and Server/Client
Component guides before editing. The page uses request-time server rendering and
native forms, not a Client Component or build-time public secret mechanism.

The first actual Next.js browser run rendered correctly but native login returned
403: the test gateway had applied no-referrer to the form document, producing an
unusable Origin. Changed only the form document's referrer policy to same-origin;
the callback still uses no-referrer and API origin validation was not weakened.
Subsequent native login/callback/logout and callback-referrer checks passed.

Reviewed desktop (1440 px) and mobile (390 px) screenshots before credentials were
entered. Preserved pink/orange tokens, readable spacing and visible keyboard
focus. The first mobile version put sign-in too low; reduced the heading size and
removed secondary explanatory steps from the narrow layout. Re-rendered and
reviewed the final mobile page, with the sign-in control inside the initial
844 px viewport. No clipping/overlap or horizontal overflow was observed.
Final credential-free snapshots: `artifacts/0026/sign-in-desktop.png` and
`artifacts/0026/sign-in-mobile.png`.

## Verification

- `pnpm test:auth:browser` now first builds actual Next.js production output,
  then starts the owned renderer/API/provider/storage fixtures. Final run: exit 0,
  all 19 groups passed against Chromium 151.0.7922.34 and Keycloak 26.7.3.
- Real Next.js root/static assets were served, not recreated test markup.
  The configured native forms completed the actual identity/session/Git-fixture
  flow; existing cookie, CSRF, referrer, revocation, replay and shutdown checks
  remained passing. A second actual Next.js instance with disabled public config
  rendered a disabled button and no forms.
- Desktop/mobile no-overflow, visible control and keyboard focus checks passed.
  axe found zero violations for WCAG 2 A/AA and WCAG 2.1 AA tags on the rendered
  configured page. This is automated evidence, not specialist/manual acceptance.
- The page ran under a script-blocking test CSP: this is native SSR/form evidence,
  not Next.js client hydration or a production CSP nonce validation pass.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0; kit/scope
  validation, typechecks, 88 prototype tests, 21 controls, workspace suites and
  builds passed. Changed web/API checks executed; unchanged packages used local
  Turbo cache. Next.js reports the root as dynamic server rendering as intended.
  No new package version, dependency or lockfile change. `git diff --check` passed.

Owned Next.js processes, browser/HTTPS servers, PostgreSQL/Keycloak containers and
generated credentials/data were cleaned up. Screenshots contain only the public
pre-login page. No real user/account/membership, secret file, production listener
or deployment was activated. Legacy Vite product files and signed artifacts were
not changed. Formal gates, real binding/ingress, authenticated workspace UI,
other browsers and manual accessibility remain separate.
