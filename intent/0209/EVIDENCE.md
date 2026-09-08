# Development evidence — 2026-09-07 (local time)

Base: `01462145cec385b59ee8dd4c381cbe31981b5fd2`.

## Delivered boundary

`packages/data/src/intent-operations.ts` supplies a strict metadata-only operation
store. Database submission uniqueness converges repeated requests on a server ID;
exact owner/input/configuration binding is required for subsequent access. Step
claims and uniquely keyed cost reservations commit atomically under operation and
budget locks. Pre-dispatch takeover preserves the reservation and fences the old
worker. After dispatch commits, a fresh process may read status but cannot obtain
another dispatch acknowledgement. Uncertain COMMIT results remain unknown.

Results are digest/reference checkpoints, verified through a required trusted
readback port. The Test Agent requires the exact succeeded Architect predecessor.
This is not an encrypted result-content store. Tests persist synthetic bytes in a
test-only table in the disposable database and verify their digest, binding and
policy, including missing/substituted results. They use synthetic authorization;
neither these ports nor a records-policy digest grant real authority.

Migrations 0007/0008 define execution rows, unique reservation links, forced
organization/subject RLS, restricted privileges and a one-way state trigger. A
separate preflight now refuses the real local migration command's expanded journal
before private-file reads or administrative SQL. The original seven-migration
baseline and existing startup remain unchanged; nine migrations are applied only
by disposable development harnesses. No real migration command was run.

## Verification

- PostgreSQL **16.14**, Node **24.19.0**: `pnpm test:data:integration` passes
  **54/54** checks (40 existing plus 14 operation checks). Migration replay remains
  idempotent. The harness owns a unique labeled loopback-only tmpfs container and
  generated synthetic credentials, then removes only that container.
- Eight independent pools converge repeated create requests; six concurrent
  claims reserve once and yield one dispatch. Four independent Node processes
  then compete for a separate candidate-save step: exactly one acknowledges
  dispatch, and fresh processes recover its sent state without permission. No
  model or provider mutation is attached to that acknowledgement.
- Injected lost create, claim and dispatch COMMIT responses preserve durable
  state without duplicate operations/charges or retry authority. Tests also cover
  lease fencing, stale owner/config/input, expiry, foreign roles, budget revocation,
  append rollback, shared legacy-cap contention, checkpoint substitution/loss,
  post-COMMIT authorization loss, pool context scrub and direct state/binding reset.
- `node --test packages/data/test/*.test.ts packages/domain/test/*.test.mjs
  packages/tool-registry/test/*.test.ts tests/local-workspace-migration-boundary.test.mjs`
  passes **228/228** checks, including five new unit and two local migration guards.
  Real 3-second dependency timeouts exercise retained admission and late-connection
  eviction; no secret or real local migration is used by the guard tests.
- Full `pnpm typecheck` passes for the prototype and all eight workspace packages.
  Kit validation (95 required artifacts), workflow token-scope audit and whitespace
  checks pass. The domain workspace link installs offline with no new package
  downloads. No service restart or production build is required.
- Signed architecture, protected Exam and accepted records-policy hashes remain
  `9e1783a5…`, `84ad1d4c…` and `f8a9cb9a…`. The new store is only exported/defined
  and tested, not installed by a runtime bootstrap. User-owned untracked files are
  excluded from the increment.

## Limits and remaining work

This is at-most-one authorized dispatch under the trusted adapter protocol, not
exactly-once provider execution. PostgreSQL grants/RLS do not sandbox arbitrary
SQL with compromised credentials. Clients must not treat persisted sent state as
reusable dispatch permission. Unknown outcomes are blocked; linked explicit new
attempts and verified resolution are not implemented here. Stale backup/copy
recovery cannot safely dispatch without accounting/provider reconciliation.

The factory admits eight calls, bounds authority/acquisition/readback to 3 seconds,
uses 5-second statement/1-second lock/5-second idle-transaction limits, bounds
claims to five minutes and configuration to 24 hours, and caps operations per
organization/subject at 10,000. There is no automatic purge, replenishment or refund.
No SQL transaction spans provider/model execution.

Temporal composition, Scout/semantic/embedding steps, approved encrypted draft
storage, exact lifecycle/full-corpus authority, bundle dispatch-proof composition
and actual UI save/reopen remain incomplete. The proposed $5 first live model-test
budget and D1 records amendment remain unapproved; runtime Git writes remain closed.
No real service, database, credential, grant, budget, policy or user draft changed.
Development-branch publishing is separate from runtime provider writes. These tests
are not live model-quality, visual QA, user-journey or independent gate acceptance.
