# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`66f5a2d11bb3b16476568bad723e664f07d895b3` plus this increment.

- Root `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit/scope
  checks, typechecks, 88 prototype tests, 20 controls, workspace suites and builds
  passed. API suite now has 26 passing tests. Unchanged packages used local Turbo
  cache; affected API checks executed against this increment.
- Seven new API test groups cover actual concurrent work/release, global rate
  refill and clock/config errors, forwarding non-bypass, URL/header/disconnect
  rejection, bounded body bytes/chunks/time and untrusted stalled cancellation.
  Empty chunks cannot grow an unbounded buffer or indefinitely starve the timer.
- A real spawned loopback Node HTTP server returned 431 for oversized raw
  headers and 408 for an incomplete header stream, within the test's eight-second
  bound. It still returned 200 live, 503 ready, 401 tools and 404 login. Only the
  spawned process and test sockets were closed afterward.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0,
  all 15 provider/Chromium groups passed with the new admission wrapper and body
  reader. Actual Keycloak code exchange, encrypted PostgreSQL, Git-committed
  authority/revocation, cookie/CSRF/replay/reconstruction/logout remained valid.
  The harness confirmed cleanup of its owned browser, servers, containers and
  generated temporary synthetic credentials/repository.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:integration`:
  exit 0, all 13 assembled HTTP/provider/storage groups passed; owned containers
  and temporary data were cleaned up. `git diff --check` passed.

During implementation, TypeScript identified Hono's HTTP1/HTTP2 server union.
Receive/parser settings were moved into typed server construction; remaining
HTTP1-specific fields are checked at runtime, not forced through a cast. Header
count truncation is disabled so credential headers are not silently dropped;
the actual parser byte cap is verified instead.

No dependency changes, real credentials/memberships, public ingress, production
capacity result, provider writes, spending, deployment or gate approval. Database
execution deadlines and fleet admission remain explicitly separate work.
