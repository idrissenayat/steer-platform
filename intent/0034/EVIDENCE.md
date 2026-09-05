# Development evidence

Verified 2026-09-05 UTC under Node 24.20.0 against parent
dff48d139fc265336db73b3bc2a002a9adb22ae9 plus this increment.

## SDK and local transport

Official server/client/core packages are pinned to 2.0.0 with transitive integrity
in pnpm-lock.yaml. npm metadata identifies stable server 2.0.0 publication on
2026-07-27; no prerelease substitution was needed. The official HTTP guide and
installed declarations/source were checked for factory/legacy/response behavior.
Component package pins in docs/stack/mcp.json match the API manifest.

Four new API groups pass within 61 tests: official-client canonical discovery and
HTTP result parity for both tools; tenant/forged-input/grant denial and revocation
during asynchronous reads; origin/Host/cookie/session/protocol/method/body denial;
eight actual pending tools with capacity refusal and shutdown waiting for release.
Initial test setup used the SDK client's legacy default. Explicit pinned modern
version negotiation corrected the fixture; no production legacy fallback was added.

The low-level official Server is used for the advanced registry-forwarding case,
not a hand-written MCP protocol. Unexpected SDK protocol errors are sanitized.
No streams/notifications are registered; returned SDK responses must be JSON.
Cleanup failure closes admission and causes shutdown failure rather than silently
claiming all resources closed. That failure branch is defensive handling, not a
fault-injected SDK cleanup verification claim.

## Actual isolated HTTPS/provider evidence

pnpm test:auth:browser: exit 0, all 24 counted groups plus the inventory fixture
checkpoint. Official MCP client 2.0.0 crosses the production-source loopback HTTPS
listener using a generated trusted test certificate, receives real Keycloak 26.7.3
agent authentication and current synthetic Git grants, and calls session.context.
The MCP result matches the HTTP result under the same OIDC/Git authority. Foreign
tenant denies; Git-committed revocation denies and restoration permits a later
call. Owned endpoint/listener shutdown and refused new connection are observed.

Actual Next.js/Chromium 151.0.7922.34, encrypted PostgreSQL 16.14, Git inventory/
replay/repair, native browser login/logout and existing authorization/accessibility
regression remain passing. No UI source changed or new visual review is claimed.
This does not prove a PostgreSQL artifact read over MCP or combined runtime mount.

## Full verification

- pnpm check: exit 0, kit/scope/typechecks, 88 prototype, 21 controls, 61 API,
  54 adapter, 10 registry, 14 data and 5 web tests, plus builds passed. Changed API
  checks executed; unchanged packages used local Turbo cache. Browser command
  separately rebuilt Next.js and was rerun after final cleanup-state handling.
- pnpm install --frozen-lockfile --ignore-scripts: exit 0. Exact lock reproduced;
  no dependency lifecycle scripts enabled or new build permission added.
- pnpm audit --prod --audit-level high: exit 0, no known vulnerabilities reported
  at this check. This is not a security review or guarantee of no vulnerabilities.
- git diff --check: passed. SDK imports are restricted to src/mcp.ts; tests enforce
  rejection from API routes/composition roots and vendor-free registry/domain.

Commands used npm exec --yes --package=node@24.20.0 -- before pnpm. Only the run's
synthetic listeners/processes/browser, generated TLS/identity files and disposable
containers/tmpfs were cleaned up. No real App key, user membership, provider account
or production database was accessed. No signed architecture or protected Exam
changed. Combined runtime/OAuth onboarding, durable workflows and remaining gates
are explicit. No deployment, release, spending or governed-write approval occurred.

Primary serving reference: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md
