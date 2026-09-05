# Development evidence

Verified against parent ca60bd16b85ca9d05dbfdd0dcea889618bd90397 plus this
development increment, 2026-09-05 UTC. This is not gate approval.

pnpm test:workflow:integration passed all eight groups on Node 24.20.0. Three
new groups compose actual local Git artifacts/grants, Temporal Server 1.31.2 and
disposable PostgreSQL through the production-source worker runtime. Two artifacts
retain exact source bytes and two immutable ingestion events after a durable
timer, worker/runtime recreation and explicit workflow history replay.

Repair corrects a deliberately corrupt disposable projection digest; discarding
a completed caller receipt and reconciling again does not duplicate events.
This is not a lost SQL COMMIT acknowledgement or OS-process crash injection.
Git-committed grant revocation causes the later durable round to fail without
further SQL ingestion. A foreign activity scope denies before its port runs.

The service subject is fixed and synthetic; grants are read through the actual
Git authorization resolver. This harness does not use a real OIDC token or real
GitHub network binding. It does not substitute for the existing separate identity
integration evidence. Owned workers/jobs/pools close; only the run's disposable
container/tmpfs and temporary test files are removed.

## Full verification

- pnpm check: exit 0. Kit/scope checks, typechecks, 88 prototype, 22 controls,
  63 API, 57 adapter, 10 registry, 14 data, 5 web and 6 worker tests, plus builds
  passed. Changed API/adapter/worker tasks executed; unchanged packages used
  local Turbo cache. No new browser/manual visual review is claimed.
- Three new adapter groups cover invalid/current agent checks including final
  empty-manifest reauthorization, actual shutdown drain, and sanitized closed
  resource failure with no retry. Two worker groups cover binding/configuration
  denial, lazy construction, unauthorized activity denial and owned pool closure.
- Existing API one-shot projection runtime tests still pass after extracting the
  shared job; its public profile/status remain compatible.
- Lockfile changes add only worker links/declarations for already pinned packages;
  no external package version or native-build permission changes.
- pnpm install --frozen-lockfile --ignore-scripts: exit 0. The final workflow
  integration rerun also passed all eight groups after shutdown error sanitization.
- git diff --check passed. Production data/adapter/Zod imports are restricted
  to worker runtime.ts; workflow/contracts remain isolated from them.

Commands use npm exec --yes --package=node@24.20.0 -- before pnpm. No live App
credential, provider account, production database or user browser was accessed.
No signed architecture, protected Exam, gate, release, deployment or spending
authorization changed. Remaining process/fleet recovery, production identity/
queue/retention/OTel, gate waits and five R5 findings are explicit.
