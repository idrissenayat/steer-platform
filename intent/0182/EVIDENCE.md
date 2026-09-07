# Evidence

Baseline `b5b338310042f1c7da65d7eaa63ab9efdd5bd895` was clean and matched GitHub.

## Verification — 2026-09-07

Initial six owned-client and five shared-registry focused tests passed. Worker,
registry and API typechecks passed. Eleven API/MCP tests passed, including the new
recovery/status transport parity case. The final full `pnpm check` exited 0,
including the sixth registry closed-plan/configuration-drift regression. Kit and
token-scope audits, all typechecks, 88 prototype tests and 438 controls passed.
Workspace totals: domain 13, data 24, adapters 289, registry 110, web 65, API 102 and
worker 40. All seven build tasks succeeded, including a fresh production Next build.
Turbo reused one of seven typecheck tasks, two of eleven workspace tasks and four
of seven build tasks; these cached results are not reported as fresh execution.

The extended actual Temporal/Git/PostgreSQL suite passed all 32 checks. In the new
owned-client case, the SDK accepted the recovery start before a synthetic transport
failure discarded its acknowledgment. The same client returned already-attempted,
status found the queued workflow, and its owned connection closed. A reconstructed
client observed duplicate rather than another execution; the separately running
worker projected one exact event and recovery status reached COMPLETED. The original
failed run, source bytes, replay behavior and current-projector denial stayed intact.
The harness closed only its owned runtimes/connections/server and synthetic data.

Commands used Node 24.20.0 via `npm exec --yes --package=node@24.20.0 --`:
`pnpm check`, `pnpm --filter @steer/worker test:integration` and the focused Node
test/typecheck commands. `git diff --check` passed. No regression rule was weakened.

## Evidence boundaries

HTTP/MCP authorization tests use synthetic principals and scheduler doubles. The
managed-client integration uses an actual local Temporal server and separately owned
SDK connections, native Git and PostgreSQL; it injects acknowledgment loss after an
actual accepted start. Its issuer/provider responses and receipt provenance remain
synthetic. These are not actual Keycloak recovery identity or approved live runtime
proof. Completed workflow status is not independently verified projection or Gate 2.
Shared grant revalidation precedes managed parent inspection/start, not an atomic
authorization lease across Temporal/Git/SQL. Later changes can leave unknown/applied
state and require separately authorized readback.

No identity runtime recovery profile/factory, frontend, schema, dependency, signed
artifact, protected setting, live grant, provider permission, spending, deployment,
release or real-data deletion changed. All five R5 findings, complete governed
authority and independent/qualified review/human signatures remain open. No fresh
browser or manual visual result is claimed.
