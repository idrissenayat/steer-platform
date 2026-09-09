# Verification evidence

Base: `bc7a4ebd96e5e828d32295e9ed2311cbe960e384` (0295).

## Implemented boundary

The generation-history owner's read-only original-source permission callback now
uses explicit private metadata-policy construction. Ordinary invocation still
checks caller/policy/caller. The already-authenticated historical scope window
may select the proven policy/caller path, removing only the redundant leading
caller query. The actual policy and fresh caller verification still finish before
content, SQL, keys or continuation. Both full historical scope reads and their
source/records/key/lifecycle verification remain; no permission or result is cached.

Proof survives only genuine forwarding for the exact caller, with captured
arguments/receiver and all owner guards/trackers. Forwarding uses intrinsic
invocation even when a callback has an overridden apply property. Copied, generic
or foreign-caller callbacks retain full checks. Early trackers cannot stand in
for completed policy work; failed/nonvoid/late results remain denials.

## Boundary and regression verification

All **65 focused checks pass on Node 24.19.0** (5,178.126 ms), covering explicit
versus generic proof, independent source-query counts, two full reads, revocation
during initial/final queries, initial authentication, forged invocation properties,
held work, nonvoid results, callback closure and the existing four-call admission
boundaries. A preliminary same-source focused run also passed on Node 25.9.0;
the pinned Node 24 run is the comparison evidence.

Prototype/eight-package typechecks pass (4.469 s). The Next.js 16.3.4 optimized
production build passes. All 88 prototype tests pass; the separate domain/worker/
web component selection passes 233 tests with no failures, cancellations or skips
(13,761.759 ms). These component checks are not browser acceptance.

The earlier native records selection passes eight checks plus migrations on
Node 25.9.0. The final Node 24 records rerun also passes all eight checks plus
idempotent migrations, including all seven late-verifier modes. The broad
regression is still running when the joined measurement starts; that concurrent
load is recorded, so local timing is diagnostic only. Their final results follow.

The expanded broad selection passes **1,583/1,583 tests**, no failures,
cancellations or skips (377,115.278 ms). It explicitly includes the root control
tests in addition to package/API tests; its count is not directly comparable to
the prior narrower broad selection. The separate 233 domain/worker/web tests and
88 prototype tests also pass. Focused tests overlap these selections and are not
additional acceptance points. The broad run finishes while the joined diagnostic
is still running; source/preparation timing overlaps it.

Commands (all final verification uses pinned Node 24.19.0):

- `node --test --test-concurrency=4 packages/*/test/*.test.ts apps/api/test/*.test.ts tests/*.test.mjs`
- `node --test --test-concurrency=4 packages/domain/test/*.test.mjs apps/worker/test/*.test.ts apps/web/test/*.test.mjs`
- `pnpm test`, `pnpm typecheck`, `pnpm --filter @steer/web build`
- `node packages/data/test/postgres.integration.ts --development-history-records`
- `node packages/data/test/postgres.integration.ts --journey-runtime`

## Authenticated joined measurement

All three joined checks plus idempotent migrations pass through both recorded
drafting roles, correction/reassessment, exact confirmation, one native commit,
lost acknowledgements, runtime reconstruction, current policy/Git-grant denial
and exact older-commit reopen. Six synthetic calls/reservations are retained
without duplicate model dispatch; they are not live model calls or quality proof.

Preview drops from **4,957 to 4,017 provider requests** (940 fewer, 18.96%). First
confirmation drops from **10,107 to 8,227** (1,880 fewer, 18.60%). Reconstructed/
repeated confirmation use **8,199 / 8,197**; both reconstructed token refreshes
remain counted. Source review stays 210, scope preparation 844, drafting preparation
4,350 / 3,900 and drafting starts 7,871 / 8,866 / 8,866. Repository/body requests
are unchanged. Local preview/first-confirmation times are 8,755 / 17,554 ms, not
warmed p95 or evidence of a timing improvement.

[Raw measurements](PERFORMANCE.json) retain all 12 action samples, two preparations,
nine start logs, origin partitions, ten source/harness hashes and recovery trace.
Recovery returns committed in 211 ms / 17 requests, with 14 SQL phases, three clock
observations and no SQL failure or clock reversal. The prior unexplained 0289
outcome is not fixed by this passing recovery. Full SQL, other full dispositions,
delayed prefix and complete performance/live acceptance were not rerun.

Overall remains **68% (17/25; 8 remaining; +0 points)**. The next read-set change
must consolidate immutable-source bodies as well as identity/records validation:
confirmation's 344 repository blob downloads already exceed the entire unchanged
200-attempt budget. Use exact commit/content identity and fresh grants/head checks
inside each read-only phase; do not share snapshots across writes or requests.

No live model call, credential change, real records/D1 activation, runtime GitHub
grant/write, gate, deployment, release or user-data deletion is part of this change.
The earlier 0289 recovery-unknown observation remains retained and unexplained.

Final delivery checks pass: 95 kit artifacts, workflow token scopes, ten exact
source/harness hashes, 14 origin partitions, all sample counts and baseline
deltas, four protected hashes, the unchanged 17/25 tracker and 381 relative links.
The first ad hoc percentage audit used strict floating-point equality and differed
only in the final binary rounding digits; the corrected audit permits less than
1e-12 percentage-point roundoff while keeping every integer request count exact.
Git whitespace checks pass. Integration cleanup removes only each run's owned
synthetic PostgreSQL container/tmpfs data; user files and signed sources remain.
