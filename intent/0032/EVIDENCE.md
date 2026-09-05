# Development evidence

Verified 2026-09-05 UTC under Node 24.20.0 against parent
a5cecf626073c70a433b0bba79fa27903ff5bea9 plus this increment.

## Focused evidence

Six new adapter groups pass within 48 tests: deterministic pinned replay/skipped
updates; invalid/duplicate/oversized manifests and missing/corrupt/moving source;
8 MiB aggregate staging limit; partial sink failure with explicit replay; moving
HEAD/cancellation with honest progress; and superseded result classification.
An initial native-Node check rejected a TypeScript parameter property; explicit
class fields replaced it. The corrected code passes native tests and typechecks.

Two new API groups pass within 56 tests: explicit lazy projector configuration,
invalid/expired/human/foreign/ungranted agent denial before provider access, no
overlap, closed admission and shutdown waiting for an actual blocked transport.
No live provider or SQL connection is required by these runtime-factory tests.

## Real isolated integration

pnpm test:auth:browser: exit 0, 23 existing counted groups plus the new manifest
fixture checkpoint. Actual Next.js build, Chromium 151.0.7922.34, Keycloak 26.7.3,
loopback HTTPS and PostgreSQL 16.14 remain passing. The fixture now commits two
artifacts to actual synthetic Git, ingests one pinned manifest, reruns it as
duplicates, corrupts one owned projection and repairs it. Event count is unchanged
by duplicate/repair. Readback matches both source files exactly, including a
trailing newline. The authenticated browser reads one projected artifact and
retains its tenant/path/grant/CSRF/revocation denials.

The synthetic Git reader now preserves raw show output instead of trimming it.
That fixture correction does not alter the production GitHub adapter. Integration
uses actual reconciliation/data adapters; it does not claim a complete live
createProjectionRuntime factory/authenticator/provider pass.

## Full checks and boundaries

pnpm check: exit 0. Kit/scope checks, typechecks, 88 prototype, 21 controls,
48 adapter, 56 API, 10 registry, 14 data and 5 web tests, and builds passed.
Changed adapter/API tasks executed; unchanged package tasks used local Turbo
cache. Browser command independently rebuilt actual Next.js. All commands ran
through npm exec --yes --package=node@24.20.0 --. git diff --check passed.

The browser harness confirmed cleanup of only its run-owned synthetic containers,
tmpfs data, generated TLS/credentials, listeners and browser/processes. No real
App key, account, membership, production database or external secret provider
was read or changed. No dependency/schema, protected Exam or signed snapshot was
changed. No new UI/visual review or full-repository/durable-worker claim is made.
Partial transaction outcomes, source-removal/rollback and atomic-manifest limits,
current agent binding and remaining work are explicit in the guide. No gate,
deployment, release, spending or governed Git-write approval is implied.
