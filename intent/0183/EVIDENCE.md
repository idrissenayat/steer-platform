# Evidence

Baseline `3fdc5b88fe20f5b18916693e67e815257c3df6a9` was clean at the start.

## Verification — 2026-09-07

The first four runtime-focused tests and API typecheck passed. A fifth test adds
cleanup of a previously transferred dispatcher when the recovery factory rejects.
The initial worker/full typecheck caught a nullable-authentication assertion in the
new integration fixture. The assertion now accepts the declared nullable return
shape and still requires the exact projector subject; no production check was
weakened. The final `pnpm check` exited 0: kit/token-scope audits, all typechecks,
88 prototype tests, 438 controls and workspace tests passed. Workspace totals were
domain 13, data 24, adapters 289, registry 110, web 65, API 107 and worker 40,
including all five new runtime cases. All seven build tasks succeeded, including
a fresh production Next build. Turbo reused five of seven typecheck tasks, two of
eleven workspace tasks and four of seven build tasks; cached results are not fresh
execution claims.

The extended Temporal/Git/PostgreSQL integration exited 0 with 33 checks passed.
The new case verified separate signed recovery/projector subjects and current native
Git grant files, wrong-failed-run denial, rejected substitute grants before client
admission, one accepted start, queued runtime/connection reconstruction, retained
duplicate rejection and exact one-event SQL projection. Revoking recovery denied
its start/status while projector authentication stayed independently valid. Closing
the owned recovery connection did not close the worker/server; the original remained
the exact failed run. The harness closed its owned resources and synthetic data only.

Commands used Node 24.20.0 via `npm exec --yes --package=node@24.20.0 --`:
`pnpm check`, `pnpm --filter @steer/worker test:integration`, and the focused API
test/typecheck commands. `git diff --check` passed. No regression rule was changed.

## Boundaries

Runtime unit tests use actual signature validation and native Git membership, with
synthetic issuer/provider transports and scheduler doubles. The extended integrated
case uses an actual local Temporal server/SDK workers, owned connection, native Git
and PostgreSQL projection, with separate synthetic recovery/projector subjects and
current grant files. Receipt provenance and issuer responses are not actual provider
or qualified gate evidence. No actual Keycloak recovery identity or new browser/visual
QA is claimed. Existing browser evidence remains historical.

No live profile, secret bundle, grant, provider access, protected artifact, frontend,
dependency, schema, spending, deployment, release or real-data deletion changed.
All five R5 findings, complete governed authority and independent/qualified review/
human signatures remain open. Recovery status is not proof of projection success or
Gate 2; later asynchronous revocation can leave accepted/unknown work for readback.
