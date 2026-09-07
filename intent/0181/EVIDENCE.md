# Evidence

Baseline `2a9f9ff2986ac6b6bec1ff4f6c7ea62c5d23a72f`, initially clean. Ordinary
dispatch retains its workflow type, ID, argument schema and duplicate policies.

## Verification — 2026-09-07

Five focused recovery tests and worker typecheck passed. The final exact-code
Temporal/Git/PostgreSQL integration passed all 31 checks, including the two new
before-SQL and after-SQL recovery cases. Each preserved the original failed run and
one exact ingestion event; concurrent starts admitted one recovery, replay did not
reread the receipt, and revoked projector authority denied further ingestion.
The harness closed its owned runtimes/server and removed only synthetic test data.

The initial full regression found one architecture-check failure: a duplicate
contracts import in the workflow module. The source import was consolidated; the
architecture rule was not changed. The final `pnpm check` exited 0: kit and token
scope audits, typechecks, 88 prototype tests, 438 controls and workspace tests
(domain 13, data 24, adapters 289, registry 104, web 65, API 101, worker 34) passed.
All seven build tasks succeeded. Turbo reused six of seven typecheck/build tasks and
ten of eleven workspace tasks; the changed worker checks executed freshly.

Commands used Node 24.20.0 via `npm exec --yes --package=node@24.20.0 --`:
`pnpm check` and `pnpm --filter @steer/worker test:integration`. `git diff --check`
passed. No fresh browser or manual visual check is claimed; existing browser evidence
is historical and this increment changes no frontend.

## Evidence boundaries

The new integrated cases use actual local workflows, current native Git grants,
verified JWT signatures and SQL writes. Issuer/provider responses and recorded-receipt
provenance are synthetic. No actual Keycloak recovery dispatch, browser recovery UI,
public recovery grant or managed recovery client is claimed. The worker's parent
guard is an explicit trusted adapter, not user-provided authority. No atomic guarantee
across provider observation and SQL commit, recursive retry or durable-beyond-retention
deduplication is asserted. No live configuration, workflow reset/cancellation, new save,
protected artifact, dependency, schema, deployment, spending or real deletion changed.
All five R5 findings and full governed authority/independent review/human gates stay open.
