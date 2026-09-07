# Evidence

Baseline `491e5603c64103925de25772a6ce9a5f6654730c` was initially clean.

## Verification — 2026-09-07

Initial dedicated Keycloak integration passed all 14 checks, including the joined
actual recovery/projector provider-token journey. An initial typecheck found that
an empty test-fixture hats array inferred `never[]`, preventing the deliberate
human-hat negative input. The fixture now explicitly types it as `string[]`;
production validation was unchanged. API/worker typechecks then passed. The final
exact-source Keycloak rerun exited 0 with 14 checks; normal Temporal regression
exited 0 with all 33 checks. The final `pnpm check` exited 0: kit/token-scope audits,
typechecks, 88 prototype tests, 438 controls and all workspace tests passed. Workspace
totals: domain 13, data 24, adapters 289, registry 110, web 65, API 107, worker 40.
All seven build tasks succeeded. Turbo reused five of seven typecheck tasks, nine
of eleven workspace tasks and five of seven build tasks (including Next); cached
results are not fresh executions or browser/visual evidence.

The dedicated run verified exact recovery/projector subjects against real JWKS,
wrong-client token swapping and invalid token denial, agent human-hat and substitute
grant rejection, post-receipt projector revocation with zero SQL events, one final
exact projection event, unchanged failed original, queued runtime/connection
reconstruction and retained duplicate rejection. Recovery revocation did not change
the independently valid projector grant. Cleanup of only owned generated issuer,
database, Temporal and credential resources completed in both integration suites.

Commands used Node 24.20.0 via `npm exec --yes --package=node@24.20.0 --`:
`pnpm --filter @steer/api test:recovery:integration`,
`pnpm --filter @steer/worker test:integration`, `pnpm check` and the focused API/worker
typecheck command. `git diff --check` passed. No regression rule was weakened.

## Evidence boundaries

Actual disposable Keycloak 26.7.3 tokens/JWKS over run-pinned HTTPS feed production
OIDC/current native Git authorization, the owned API runtime, actual local Temporal
workers and PostgreSQL. Recovery/projector service subjects, client secrets and
current grant files are separate. The additional recovery account is created only
inside the disposable realm. No actual user or live provider credential is used.

GitHub responses and receipt provenance remain synthetic. The new scenario is one
joined recovery check with multiple denial/reconstruction/idempotency assertions,
not a new browser-created receipt demonstration. The normal Temporal suite still
uses synthetic issuers unless explicitly supplied this disposable provider.

No production runtime logic, dependency version, database schema, frontend, signed
artifact, protected setting, live profile/grant, provider access, spending, deployment,
release or real-data deletion changed. All five R5 findings, complete governed
authority and independent/qualified review/human gates remain open. No fresh browser
or visual check is claimed, and COMPLETED status alone is not SQL/gate proof.
