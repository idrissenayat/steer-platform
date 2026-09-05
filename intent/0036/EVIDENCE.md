# Development evidence

Verified 2026-09-05 UTC against parent
2b9b228ab6549e4a0f4a58a7c5d3b3188b49b808 plus this development increment.
No gate or production approval is claimed.

Node 24.20.0: worker typecheck and four native unit groups pass. Actual Temporal
integration passes five groups using CLI 1.8.3 / Server 1.31.2, checksum-verified
official Darwin ARM64 archive. The final rerun includes decoded history payload
inspection and the portable archive allowlist (other platforms not executed).

## Durable execution evidence

pnpm test:workflow:integration: exit 0. The official SDK starts a real loopback
server with in-memory persistence, executes a two-round workflow, shuts down the
first SDK Worker while its timer is pending and constructs a fresh Worker. The
same execution run ID completes with exactly two activity calls. Explicit history
replay adds no activity calls. Duplicate starts are refused both while running
and after completion in retained server history.

A foreign organization reaches the fixed activity binding and fails before the
port is called. An arbitrary workflow ID fails before any activity. A synthetic
port failure results in exactly one attempted call and a failed workflow, with no
automatic retry or private exception message in decoded history. Cancellation
during a timer reports CANCELLED and schedules no further activity. Artifact
content in synthetic outcomes is absent from decoded history payloads.

These are recreated SDK worker instances, not killed/restarted OS processes.
The server stays alive; its database is not restarted/restored. The activity port
is synthetic, not Git/PostgreSQL composition, fleet leasing, current live-grant
verification or real provider evidence. Worker concurrency/timeout settings are
configured; no production load, timeout rollback or port cancellation guarantee
is inferred. No OTel or governed gate-wait completion is claimed.

## Repository and dependency verification

- pnpm check: final exit 0. Kit/scope checks, typechecks, 88 prototype, 22 controls,
  63 API, 54 adapter, 10 registry, 14 data, 5 web and 4 worker tests, plus builds
  passed. All workspace test tasks executed after the lock changed. Typecheck
  and build prerequisites used local Turbo cache where already verified.
- The first full check found four duplicate generated .next/types files with
  names ending in " 2.ts". All four were byte-identical to their canonical
  generated counterparts. They were moved, not deleted, to
  /tmp/steer-0036-generated-types.crjX2i; no tracked source changed. Full checks
  then passed. The originating duplication mechanism was not diagnosed.
- pnpm install --frozen-lockfile --ignore-scripts: exit 0. No dependency lifecycle
  build permission was added. Exact SDK pins and transitive integrity are locked;
  the Temporal dependency graph also resolves Vite's optional Terser peer, without
  changing the existing top-level Vite/Vitest versions.
- pnpm audit --prod --audit-level high: exit 0, no known vulnerabilities reported
  at this check; not a security audit or guarantee of no vulnerabilities.
- git diff --check passed. Vendor-in-core and cross-package import checks remain
  enforced, with an added deterministic-workflow boundary test.

Commands used npm exec --yes --package=node@24.20.0 -- before pnpm. The test
server and owned workers were stopped and only its generated download directory
was removed. No real cluster, App key, provider account, production data or user
browser was accessed. No UI source changed or new visual review is claimed.
No protected Exam, signed architecture, gate, spending, deployment or release
authorization changed. Five R5 findings and remaining Phase 1 work stay open.

Primary sources checked: official Temporal testing guide, SDK v1.23.0 release,
CLI v1.8.3 release checksums and installed SDK declarations/source. Links and
configuration limits are in docs/TEMPORAL-WORKFLOWS.md; the component stack lock
is docs/stack/temporal.json, not a complete platform release lock.
