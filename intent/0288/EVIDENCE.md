# Intent 0288 execution evidence

Status: increment verified; performance acceptance remains failed/incomplete.
Base: `6fcd76970bea4b8ea141083be3e835f87f6abc01` (0287).
Overall: 68% (17/25; 8 remaining; +0 points). No real UI, provider or performance
acceptance is claimed. Existing credential provisioning/reuse is resolved; tests
remain synthetic/local and the first live-model budget remains unapproved.

## Implemented boundary

Drafting start now constructs an immutable private read-only original authorizer
that really checks the exact current caller before and after the independent
policy. Only current-only original verification forwards its proof, through the
original callback, pinned arguments/receiver and store guards/bounded work.
The current scope window can omit the redundant outer caller pair for this exact
construction; wrapped/copied/bound/different-caller and historical policies retain
the full pair. Historical construction and result semantics are unchanged.

There are still two full current scope reads per validation window, with exact
source/result equality, current records/keys/profile/expiry and final grants.
Each scheduler revalidation opens a new read-only window; no proof spans an
effect. Intrinsic invocation preserves the actual reader/callback receiver despite
overridden `call`/`apply` properties. Late work remains owned and denied after close.

## Verification so far

- All 25 focused helper/window/starter/original tests pass (10,853.293 ms).
  Exact-proven and ordinary callbacks invoke the same number of source policies
  and two full scope reads. The proven path removes only two duplicate current
  calls per source-policy invocation. Independent and historical callers retain
  their full checks. Final revocation, changed/expired results, nonvoid outcomes,
  escaped/changed ports, held work and forwarding spoofing are covered.
- Prototype and all eight package typechecks pass (4.536 s); optimized Next.js
  16.3.4 build passes.
- `--development-start` passes four HTTP/encrypted-SQL checks plus idempotent
  migrations, including an added nonvoid original-authority denial before any
  scheduler call. Lost acknowledgements, post-dispatch loss, holds and edits keep
  existing semantics. This selection is not the full SQL suite.

## Observed drafting-start request load

The authenticated workflow's denied-start, lost-acknowledgement recovery, fixed
single-attempt roles, repeated starts and owned worker shutdown pass. Its measured
requests are:

| Drafting start | 0287 requests | 0288 requests | Reduction | 0288 single local time |
| --- | ---: | ---: | ---: | ---: |
| Initial, lost scheduler reply | 41,768 | 23,064 | 18,704 (44.78%) | 10,887 ms |
| Receipt recovery before worker | 47,350 | 25,974 | 21,376 (45.14%) | 12,027 ms |
| Repeated after completion | 47,350 | 25,974 | 21,376 (45.14%) | 12,123 ms |

These are single undelayed synthetic measurements, not warmed p95 or a reliable
latency speedup. The drafting-start log records total requests, not their origin
partitions; do not invent that missing attribution. Each count remains far over
the fixed 200-attempt interactive budget. Source review and scope preparation
remain at 2,634 and 9,598 requests. The 12 corrected-package request totals are
all unchanged from 0287, including preview at 22,642 and confirmation at
45,716 / 45,654 / 45,652. Their local times remain variable (the three
confirmations took 36,774 / 36,541 / 36,436 ms in this run).

The full `--journey-runtime` selection passes all **three joined checks plus
idempotent migrations**, using actual authenticated service composition, native
authorization/Git, encrypted disposable PostgreSQL, SDK verification and Temporal.
It retains six synthetic model calls/reservations, one confirmation original,
one native save, lost-response/restart recovery and exact older-commit reopen with
current policy/Git-grant denial. Source text, corrections and both separate roles
remain bound. No extra originals, calls or saves are created.

[Raw measurements](PERFORMANCE.json) retain all start samples, the previous-count
comparison, 12 corrected-package samples and origin partitions, source/harness
hashes and environment. The delayed prefix
was not rerun: its unchanged source-review limit fails before this drafting-start
boundary. Other full dispositions, full historical SQL and the full SQL suite
were not rerun. This is not C22, real model quality, runtime activation or actual
signed-in UI/live-provider acceptance.

## Final verification and next work

All **1,415 broad regression tests pass** (150,089.596 ms; no failures, cancelled,
skipped or todo tests). The earlier 25 focused tests, four start-SQL checks,
three joined checks, idempotent migrations, prototype/eight-package types and
optimized build passed on this final production code. The 95-artifact kit and
read-only workflow-token audit pass. Document links, all 12 source/harness hashes,
12 origin partitions, three start reductions, private export boundaries and the
fixed 17/25 tracker calculation are checked. Architecture, canonical Exam and
HR-01-R2 policy hashes remain unchanged; unrelated user files remain untouched.

The targeted SQL runs removed only their own disposable synthetic PostgreSQL
container/tmpfs data. No live configuration, credential, model spending, runtime
GitHub grant/write, records/D1 adoption, gate/signature, deployment or release
changed. Next reduce remaining current-policy and preparation/final-package
traversal, then complete the delayed full performance protocol. Progress remains
**68% (17/25; 8 remaining; +0 points)** until a whole checkpoint passes.
