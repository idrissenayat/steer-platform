# Evidence

Baseline `2e3837810b7a6eb394d0f0861c40a139f5a0882d` was clean.

## Verification — 2026-09-07

API/worker typechecks and the kit audit passed. The standalone Keycloak recovery
regression passed all 14 checks, and the ordinary browser suite passed all 45.
The separate browser recovery rerun exited 0 with all 45 checks, including its
session teardown checks. Both browser modes used Chromium 151.0.7922.34 and
Keycloak 26.7.3. Owned Chromium, TLS servers, PostgreSQL containers/tmpfs and
generated Keycloak credentials/data were cleaned up; only disposable test data
was removed. This is automated browser/accessibility evidence, not a new manual
visual audit of the user's localhost preview. `pnpm check` exited 0: kit and token-scope
audits, all typechecks, 88 prototype tests, 438 controls, all 11 workspace test tasks
and all seven build tasks passed. API and worker suites passed 107 and 40 checks.
Turbo reused five of seven typecheck tasks, nine of eleven workspace tasks and
five of seven build tasks, including Next; cached results are not fresh executions
or manual visual evidence. `git diff --check` passed.

The first new-mode invocation failed before setup because the closed CLI argument
allowlist omitted `--browser-recovery`; the explicit argument was added. The next
run stopped in the existing decision-evidence curation/stale-reference UI check,
before reaching recovery. That run is not a pass. No assertion was weakened;
additional static stage labels improve safe failure diagnostics. The ordinary
browser run and the separate recovery rerun passed that check. Concurrent fixture
load is not established as the cause of the earlier failure.

The recovery scenario verified three actual browser status reads: a direct
post-receipt denial, the original failed activity's read, and the successful recovery
read. Original failure and revoked recovery-projector access left their owned SQL
pools unopened. One exact ingestion event and one original Git creation were
observed, with successful browser opening of the original saved Brief. The exact
original run stayed FAILED after recovery, both histories replayed without reading
receipts, and duplicate original/recovery starts were rejected. Swapped dispatcher
tokens, wrong failed-run selection and substitute dispatch grants denied before a
recovery start attempt. Queued client/worker reconstruction preserved identity,
and both separately owned recovery client connections were closed. Later recovery
revocation denied recovery/status without revoking the projector.

Commands use Node 24.20.0 through `npm exec --yes --package=node@24.20.0 --`:
`pnpm --filter @steer/api test:recovery:browser`,
`pnpm --filter @steer/api test:auth:browser`,
`pnpm --filter @steer/api test:recovery:integration`,
the API/worker typecheck command, `pnpm kit:check` and `pnpm check`.

## Evidence boundaries

The opt-in browser recovery scenario uses actual local Keycloak identities,
browser confirmation/save/status, a native Git-created Brief and operation marker,
actual local Temporal and PostgreSQL. Human, original dispatcher, recovery actor
and projector are distinct. Recovery consumes the browser operation's real status
response inside this disposable test journey, not a seeded receipt.

GitHub responses and full gate authority are explicit test doubles. This does not
prove actual GitHub writes, full governed action-time authority, live configuration,
independent protected review, human signatures or gate completion. All five R5
findings remain open. No real provider credentials, live profile/grant, spending,
deployment, release or real-data deletion are authorized by these tests.
