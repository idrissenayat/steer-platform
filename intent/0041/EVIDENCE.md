# Development evidence

Baseline 3f2e4f4da6732381dbc917bd2692ce5646ffbeba plus this increment,
2026-09-05 UTC. No gate approval is claimed.

Three native groups cover target identity/bounds, reference-only outputs and
fixed observer/overlap/error controls. Four real Temporal groups exercise durable
checkpoint/worker recreation/history replay/duplicate refusal, artifact revision
supersession despite an existing digest, exhausted waits, wrong IDs and non-retried
observer failure. The source observer is synthetic. These tests do not validate
an actual signature, qualified human, canonical Git decision, or production gate.

## Final verification

- pnpm check: exit 0 under Node 24.20.0. Kit/scope/boundary checks, typechecks,
  88 prototype, 22 controls, 66 API, 57 adapter, 15 registry, 14 data, 5 web and
  18 worker tests and builds pass. Changed worker tasks execute; unchanged
  verified tasks use local Turbo cache. No new browser/visual audit is claimed.
- pnpm test:workflow:integration: exit 0, sixteen groups using checksum-verified
  Temporal CLI 1.8.3 / Server 1.31.2 on Darwin ARM64. Gate watch resumes the same
  execution after SDK worker recreation, rereads a changed synthetic observation,
  and replays history without another acknowledged read. Changed artifact with
  an existing digest returns superseded, not recorded/approved. Missing decision
  returns exhausted. Wrong ID denies before observer access; failure is not retried.
- Existing actual Git/PostgreSQL/reconciliation process-recovery and managed
  connection groups pass alongside the new watch tests. Those older groups do
  not constitute real Git/provider verification of this new gate observer.
- git diff --check passed. No dependencies, lockfile, protected Exam, signed
  architecture, live provider grant, credentials, deployment, spending or gate changed.

Commands use npm exec --yes --package=node@24.20.0 -- before pnpm. Cleanup affects
only owned workers/test server/children and generated disposable data. The new
gate test recreates SDK objects, not a separate crashed process or server. Full
source verification, event cursors and production/public gate-watch composition
remain open; completed workflow status cannot authorize a downstream action.
