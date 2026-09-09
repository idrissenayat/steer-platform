# Intent 0287 execution evidence

Status: increment verified; performance acceptance remains failed/incomplete.
Base: `55f7e33c6a0fbc0fa626cbbd22095e747904efff` (0286).
Overall remains 68% (17/25; +0 points). No completed C22 or actual UI acceptance
is claimed. Existing API-key provisioning/reuse is resolved; only synthetic/local
verification is authorized here.

## Implemented boundary

The actual corpus scope-preparation factory now installs a private read window for
each source/policy/source validation pair. Initial evidence acquisition and the
complete fallback remain unchanged. Each window closes before admission or
encrypted-original persistence; each subsequent pair opens a new session and
performs a full initial corpus collection. No immutable content or permission proof
is carried across an effect. Independent preparation, records, draft and source
authority remain mandatory.

The owner tracks both the wrapper and its real work/reads. Skipped or repeated
callbacks, nonvoid completion, early wrapper return, unawaited/overlapping reads,
swallowed failures and late escaped use cannot become successful validation.
The installed hook's identity is pinned for the operation; intrinsic invocation
preserves its receiver. Owner source/draft Conflict errors survive the corpus
session's sanitization so pre-effect conflicts retain their classification.

## Verification so far

All nine focused helper/preparer tests pass (176 ms); prototype and all eight
package typechecks and the optimized Next.js 16.3.4 build pass. The four new native
Git/Postgres checks in `--scope-runtime` pass:

- Two-source preparation reads eight bodies rather than fourteen on the full
  fallback, with identical prepared output and retained original evidence.
- Observed body phases are initial `0:0`, first window `1:0`, post-admission window
  `2:1`, and post-persistence window `3:2`, with two bodies per phase. Both writes
  occur only after the window closes; all three preparation-policy calls remain.
- A source grant revoked after the validation callback still fails the corpus
  session's final check before any admission or original is created.
- Native source drift after admission or original persistence returns `unknown`,
  retains the admitted row and any already stored original at its exact prior
  evidence, and never adds reservations or provider saves.

The complete `--scope-runtime` selection passes **82 runtime checks plus the
idempotent migration check**, including native candidate preview/confirmation,
recorded role history, fixed Temporal save/recovery and scope workflow cases. This
is a focused selection, not the full SQL suite. It removes only its own synthetic
PostgreSQL container/tmpfs data.

The actual managed authenticated journey passes **three joined checks plus
idempotent migrations**. Its 34-source scope preparation measurement uses
**9,598 requests**, down from 11,365 in 0286: 1,767
fewer (15.55%). Identity-head reads fall by 1,380; repository commits/trees/blobs
fall by 132/132/129, while six additional fresh repository-head checks remain.
Single undelayed local time is 9,619 ms versus the prior 12,979 ms; this is not p95
or a reliable latency speedup claim. The unchanged source review still makes
2,634 requests. Both remain far above the 200-attempt acceptance limit.

The joined path retains both separate SDK drafting roles, six synthetic model
calls/reservations, one encrypted confirmation original and one fixed Temporal/native
Git save. Lost HTTP/scheduler/provider acknowledgements, identity/factory restart,
receipt recovery, exact older-commit reopen and current policy/Git-grant denial
pass without additional originals, model calls or saves.

| Action | 0286 requests | 0287 requests | 0287 single local time |
| --- | ---: | ---: | ---: |
| Source review | 2,634 | 2,634 | 2,437 ms |
| Scope preparation | 11,365 | 9,598 | 9,619 ms |
| Final save review | 6,664 | 6,664 | 5,849 ms |
| Save preview | 22,642 | 22,642 | 17,868 ms |
| Confirmation, discarded reply | 45,716 | 45,716 | 35,800 ms |
| Reconstructed confirmation | 45,654 | 45,654 | 36,048 ms |
| Repeated confirmation | 45,652 | 45,652 | 36,754 ms |

Drafting start requests remain 41,768 / 47,350 / 47,350. Scope preparation is the
only changed request total. Its identity requests fall from 10,434 to 9,054 and
repository requests from 931 to 544. [Raw measurements](PERFORMANCE.json) retain
all 12 per-action samples/origin partitions, workflow-start counts, source/harness
hashes, native-body phases, environment and the exact prior comparison.

Final **1,406/1,406 broad regression tests pass** (159,294.532 ms; no failures,
cancelled, skipped or todo tests). Focused tests, prototype/eight-package
typechecks and the optimized Next.js 16.3.4 build passed on this production code
before the integration runs. The 95-artifact kit and read-only workflow-token
audit pass. All checked document links, 11 source/harness hashes, 12 measured
origin partitions/request deltas and the fixed 17/25 tracker calculation pass.
The protected Architecture, canonical Exam and HR-01-R2 policy hashes are unchanged.

The delayed prefix is not rerun for this
scope-preparation-only change: it stops at unchanged source review before this
modified boundary. Its prior failure remains evidence of the open C22 gap, not a
newly passing benchmark. Full SQL and the other full authenticated-disposition
selections were not rerun. No actual browser/live-provider acceptance occurred.

Next reduce the remaining repeated current-policy traversal, including unchanged
drafting/history admission, while preserving independent current grants and effect
boundaries. No permission cache, timeout extension, real configuration/credential
change, model spending, runtime GitHub write, D1 adoption, gate, deployment or
release is authorized by this increment. Overall stays **68% (17/25; 8 remaining;
+0 points)** until a full acceptance checkpoint passes.
