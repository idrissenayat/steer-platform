# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`4e1807f4ba3ce8699ecf091a91e4fa3a76726bfd` plus this increment.

## Transport and runtime observations

- Seven local-listener test groups passed. Actual sockets verified generated-CA
  trust, rejection without that trust, canonical Host rejection, 16 KiB header
  protection, approximately five-second TLS/HTTP-header stalls, occupied-port
  cleanup, normal drain, resource failure/idempotence and forced disconnect.
- The first Host-alias test failed at the test client's TLS naming check rather
  than reaching HTTP. The fixture now pins servername to its intended localhost
  origin while deliberately varying only Host. Certificate validation remains
  enabled. The corrected test observed HTTP 400 without application dispatch.
- A deliberately cancellation-ignoring synthetic handler remained active after
  the five-second socket fallback. Listener status stayed draining until that
  work was explicitly completed, then became stopped. Closing a socket alone
  did not fabricate application/resource completion.
- An additional full local bootstrap test constructed actual lazy GitHub/data/
  encrypted-session components plus gateway/listener, served a synthetic page
  over real HTTPS, observed readiness 503 and unauthenticated tool 401, made zero
  provider calls/DB connections, and confirmed listener and pool shutdown.
  This test is lazy-runtime composition evidence, not a real membership login.
- The node:https builtin is permitted only in src/identity-listener.ts; exact-
  file tests reject it from API routes, runtime/service/default startup. Data/Zod
  import boundaries remain limited to runtime.ts. No new package/version or
  dependency-age exception; no signed architecture or protected Exam change.

## Full verification

- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0,
  all 20 groups passed using actual Next.js production output, Chromium
  151.0.7922.34, Keycloak 26.7.3, synthetic Git authority and encrypted PostgreSQL.
  The application now runs through the production-source HTTPS listener; only
  the attacker/untrusted-certificate servers remain test-specific transports.
- Native login/logout, callback referrer protection, cookie privacy, CSRF,
  fresh authority/revocation/failure checks, disabled/responsive/keyboard views
  and zero automated axe violations remained passing. The additional browser
  check observed stopped listener status and ERR_CONNECTION_REFUSED after close.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit/scope
  validation, typechecks, 88 prototype tests, 21 controls, all 48 API tests,
  remaining workspace suites and builds passed. Changed API checks executed;
  unchanged packages used local Turbo cache. The browser command separately
  rebuilt actual Next.js before use. No UI layout edit or new visual QA claimed.
- `git diff --check`: passed. Existing Vite product and default API server were
  preserved. Default API still has no configured login routes and is unready.

Only owned synthetic listeners/sockets, browser/Next.js processes, temporary TLS
files, PostgreSQL/Keycloak containers and tmpfs test data were cleaned up. No real
secret file, key, user, membership or provider binding was accessed or changed.
No public listener, deployment, release, spending or gate approval occurred.
Real credential loading, authenticated workspace UI, full walking skeleton,
manual accessibility and the existing protected findings remain separate.
