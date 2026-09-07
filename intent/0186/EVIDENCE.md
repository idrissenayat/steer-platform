# Evidence

Baseline `3d069b8dfc7479ada100188c72ef511197ea2474` was clean.

## Verification — 2026-09-07

The focused signature/source suite passed all 17 tests: six new signature tests,
five new collector integration tests and six existing selection regressions.
The two new held-writer tests passed separately. Adapter typecheck passed.
`pnpm check` exited 0: kit/token-scope audits, all typechecks, 88 prototype tests,
438 controls, all 11 workspace test tasks and all seven final build tasks passed.
The adapter suite passed 302 tests (13 new); API passed 107 and worker passed 40.
Turbo reused four of seven typecheck tasks, seven of eleven workspace tasks and
five of seven final build tasks, including Next. Cached tasks are not fresh
executions or browser/visual evidence. `git diff --check` passed. No failed assertion
was removed or weakened; no test failure was observed during this increment.

Tests use genuine Ed25519 signatures from generated synthetic test keys, actual
native Git source bytes in owned temporary repositories, and production verifier,
collector and held-writer code. Native source integration verifies unchanged
content across a later unrelated commit, immutable results, exact independent pins,
current observer/head denial and proof expiry during later policy reads. Held
composition observes policy-satisfied but all three authority gaps remain and
provider mutations stay zero. No real attestor, selector or historical review was
authenticated by these tests. Fixtures clean only their own temporary Git data.

Commands use Node 24.20.0 via `npm exec --yes --package=node@24.20.0 --`:
`pnpm --filter @steer/adapters exec node --test test/gate-selection-proof.test.ts test/gate-selection-attestation.test.ts test/gate-selection.test.ts`,
`pnpm --filter @steer/adapters exec node --test --test-name-pattern='selected-key selection proof|selection proof and trust paths' test/gate-policy.test.ts`,
`pnpm --filter @steer/adapters typecheck`, and `pnpm check`.

## Limits

The selected-key attestation format is an optional internal development contract,
not a new approval requirement or conversion of existing commercial gate records.
Its own authenticity depends on explicitly supplied independent expected facts and
trust/proof pins. Actual attestor ownership and selector authority must be governed
outside this verifier. Current source collection does not make self-selected keys
trustworthy, authenticate review conclusions or grant action-time writer authority.

No live key/profile/grant, protected artifact, frontend, dependency version, database schema,
provider access, spending, deployment, release or real-data deletion changed. All
five R5 findings, independent/qualified protected review and human gates remain open.
No new browser/manual visual evidence is claimed.
