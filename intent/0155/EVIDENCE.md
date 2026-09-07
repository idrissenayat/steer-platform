# Development evidence

## Automated checks

All 46 frontend tests passed, including eight new review/status groups: immutable
exact-target bindings, invalid/expired observations, all five strict status outcomes,
foreign/malformed receipts, access failures, invalid operation IDs, backwards/late
clocks, edit/close/overlap races, actual server-rendered controls and interactive
path/hide clearing. No save endpoint is admitted by the read transport. Existing
prototype/fixture import boundaries and theme contrast tests passed.

Full `pnpm check` passed on Node 24.20.0/pnpm 11.19.0: 95 kit artifacts, workflow
scope audit, seven package typechecks, 88 prototype tests, 437 root controls and
all workspace tests, including 270 adapter and 46 web tests. All seven package
builds and the prototype build passed; eligible Turbo steps were cached. A strict
optional-property error in the initial render callback was fixed without relaxing
types. The later mobile text-only change was covered by current web tests/builds
and the final full browser rerun. Whitespace passed; protected `intent/0001` and
`.github` files remained unchanged.

## Actual browser and fixture limits

`pnpm test:auth:browser` passed all 40 checks, then passed all 40 again after the
mobile readability correction. The final run used Chromium 151.0.7922.34 and real
disposable Keycloak 26.7.3, encrypted PostgreSQL sessions, Next.js, HTTPS and native
temporary Git behind the production read-only GitHub adapter. The actual
writer-less destination runtime returned HTTP 503 for the authorized status query;
the interface cleared receipt details and displayed unavailable, not absence.

The existing destination check now also verifies keyboard local confirmation,
disabled saving, exact path display, clearing on runtime reconstruction/new head,
grant denial/restoration and actual 15-second expiry. Browser-only intercepted
responses exercise not-found, unknown, pending, conflict and committed presentation,
strict operation coordinates, prior-receipt display and edit clearing. Exactly five
manual fixture status requests occurred; zero save requests occurred. These
intercepts are frontend evidence only, NOT a persisted provider operation or an
end-to-end successful save. The actual shared Git marker reader remains the next
integration boundary; 0154's backend integration remains independently documented.

Automated WCAG 2.1 AA checks reported no violations, keyboard controls worked and
390px layout had no horizontal document overflow. Desktop/mobile review screenshots
were visually inspected; selected paths and operation IDs now also appear as
wrapping text outside narrow native controls. Unsaved facts/digest remained unchanged,
and local/session storage remained empty. This is not independent accessibility
or qualified gate review. Screenshot output is local disposable test evidence at
`/tmp/steer-0155-browser.H6QSDR`, not a live demo URL or committed source artifact.

Both runs cleaned up only their owned Chromium profiles, HTTPS servers, PostgreSQL
and Keycloak containers, temporary data and generated test credentials. No real
identity, provider credentials, live writer, model call, gate signature, deployment,
release or spending was enabled. All five R5 findings and signed Phase 1 obligations
remain open. The overnight implementation loop remains active.
