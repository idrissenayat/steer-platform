# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`8a3c534d5cc2efec72086ec163aec35bb0c1a1af` plus this increment.

## Observed verification

- API typecheck and all 40 API tests passed, including eight new gateway groups.
  Tests cover invalid configuration/origins, path/query/method rejection,
  original identity Request/Response preservation, fixed outgoing security
  headers, renderer credential isolation, MIME/size/failure rejection and
  32-request admission/recovery.
- An owned real Node HTTP renderer verified that cookies/bearer/forwarded
  headers were absent; redirects were not followed; stalled headers and body
  were aborted at approximately five seconds; browser abort returned 408.
  Renderer failures returned generic 502 responses without upstream content.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0,
  all 19 groups passed using Chromium 151.0.7922.34, Keycloak 26.7.3, actual
  production Next.js, synthetic Git membership and encrypted PostgreSQL.
  The harness uses the production-source gateway for root/static/API routing;
  its Next.js helper no longer contains a competing page proxy/security policy.
- Native login/callback/logout, no callback referrer leak, cookie privacy,
  cross-site denial, current Git revocation/source failures, disabled view,
  responsive/keyboard checks, zero automated axe violations and service shutdown
  remained passing. No new visual design was made or new screenshot review
  claimed; the reviewed 0026 snapshots remain the visual baseline.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit/scope
  validation, typechecks, 88 prototype tests, 21 controls, workspace suites and
  builds passed. Changed API checks executed; unchanged packages used local
  Turbo cache. The browser command separately built actual Next.js before use.
- `git diff --check`: passed. No new dependency, version or lockfile changes.

Only owned synthetic browser/HTTPS/Next.js/HTTP fixtures and PostgreSQL/Keycloak
containers, tmpfs data and generated test credentials were cleaned up. No real
key, user, membership, provider binding or public listener was changed. Default
CLI startup remains unconfigured/closed; signed artifacts and protected Exams
were not edited. This is not production TLS/lifecycle activation, client
hydration, full workspace parity, specialist accessibility or Gate 2 approval.
