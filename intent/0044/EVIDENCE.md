# Development evidence

Baseline 521ac9b252b22b87ecb6fcf07b9e232960b6ef0f plus this increment,
2026-09-05 UTC. Development verification passes; no gate approval is claimed.

Two native groups cover strict exact-decimal cursors and pre-SQL denial. Four
actual PostgreSQL groups cover paging, duplicates and repairs, lock/commit order,
rollback, RLS/role/history protections, stale generations and missing events.
All records and identities are synthetic in a run-owned disposable database.

No real credential, provider approval, deletion, paid service or deployment is
used. This derived feed is not a canonical gate or Git event log.

Verified with Node 24.20.0 and pnpm 11.19.0:

- `pnpm check`: exit 0. Kit/security controls, typechecks, prototype/native tests
  and builds pass; native data tests: 16 passed, 0 failed.
- `pnpm test:data:integration`: exit 0, 31 groups on actual PostgreSQL 16.14.
  Includes five migrations applied twice, all four business tables forcing RLS,
  observed lock blocking on an independent projector connection, rollback without
  a cursor gap, numeric ordering beyond position 10 and scope-move refusal.
- `pnpm test:workflow:integration`: exit 0, 18 groups with actual Temporal CLI
  1.8.3/server 1.31.2, synthetic Git, PostgreSQL and worker process recreation.
- `pnpm test:auth:browser`: exit 0, 25 counted Keycloak groups plus the inventory
  check, actual Keycloak 26.7.3 and Chromium 151.0.7922.34. No new UI claim.
- `pnpm install --frozen-lockfile`: exit 0, lock unchanged.
- `git diff --check`: pass.

The initial native run caught a refinement trying BigInt conversion on a
malformed decimal cursor. Validation now checks the complete bounded syntax
before conversion; the failing case and full suite pass. The initial failed
root run is not counted as successful evidence.

Generated test services/data were removed only through their run-owned cleanup.
Candidate commit and remote equality are verified in the task publication handoff.
