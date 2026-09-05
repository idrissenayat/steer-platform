# Development evidence

Verified 2026-09-05 UTC under Node 24.20.0 against parent
2a15432739ff78c2e5ff3ee5604ff2fa39bd02eb plus this increment.

## New checks

Six adapter groups pass within 54 tests. Three cover GitHub inventory contracts:
exact-root/filename selection with no blob calls, pre-network selector/revision
denial, and incomplete/duplicate/unsafe/oversized tree rejection (including 101
selected artifacts and 10,001 tree entries). Three cover descriptor-bound
reconciliation, empty inventories, inventory identity/path/blob tampering,
cancellation and HEAD movement both after discovery and at staging entry.

One new API group passes within 57 tests. It rejects missing/dual/invalid selector
configuration, then runs the real projection runtime factory against explicit
synthetic provider responses for an empty tree. The restricted token request,
inventory path, empty result, zero database connections and pool shutdown are
observed. This is not live provider or nonempty runtime-factory integration.

## Real isolated source/data/browser composition

pnpm test:auth:browser: exit 0, all 23 counted groups plus the updated inventory
fixture checkpoint. Actual Next.js build, Chromium 151.0.7922.34, Keycloak 26.7.3,
loopback HTTPS and PostgreSQL 16.14. The fixture inventories actual synthetic Git
with exact revision/tree/blob descriptors, selects BRIEF.md and SPEC.md while
excluding authorization JSON, and reconciles the discovered manifest into real
PostgreSQL. Repeat/repair preserve event count; exact file bytes survive readback.
Existing authenticated browser artifact-read, tenant/path/grant, session/CSRF,
source-failure and shutdown checks remain passing.

## Full verification and scope

pnpm check: exit 0. Kit/scope checks, typechecks, 88 prototype, 21 controls,
54 adapter, 57 API, 10 registry, 14 data and 5 web tests, and builds pass.
Changed adapter/API tasks executed; unchanged package tasks used local Turbo
cache. The browser command independently rebuilt actual Next.js. All commands
used npm exec --yes --package=node@24.20.0 --. git diff --check passed.

Harness cleanup confirmed only its generated synthetic containers/tmpfs, TLS/test
credentials, processes, listeners and browser were removed. No existing App key,
real account/membership, production database or external secret provider was read
or changed. No protected Exam, signed snapshot, schema, dependency version, package
boundary or UI source changed. No fresh visual review is claimed.

Inventory relies on authenticated provider mappings, not independently hashed
commit/tree reconstruction. Limits are explicit: bounded selectors, no silent
large-repository truncation, no pruning/deletion, removal/rollback policy or atomic
manifest publication, no durable scheduling or live activation. Discovery does not
expand the separate read-tool allowlist. No gate, deployment, release, spending
or governed Git-write approval is implied.
