# Intent 0290 execution evidence

Status: diagnostic increment verified; original recovery failure not reproduced
or explained. No production recovery fix or acceptance checkpoint is claimed.
Base: `2a4bab083378e685113baeb25704599f2fad251f` (0289).
Progress: 68% (17/25; 8 remaining; +0 points). Existing credentials are untouched;
live-model budget and runtime activation remain unapproved. Synthetic tests only.

The explicit `--candidate-recovery-repro` selector runs 1–20 repetitions of the
existing lost-native-acknowledgement test and stops on failure. Each iteration
creates one isolated native save, reuses its original admission, inspects its
receipt and recovers the already-sent operation without a second dispatch. The
full SQL/authenticated journey and C22 are explicitly excluded from its claims.

The database trace now reports clock sample/regression/invalid counts and a
backward delta capped at one hour. It recognizes only the exact existing
millisecond clock query, keeps sequences per lease, invalidates them on reset and
clears the last private value on release. No absolute time, query/body/argument,
identity, source or credential enters its diagnostic. Results and error identity
are preserved; invalid observation data only increments a diagnostic counter.

Four selector/trace tests pass (71.956 ms), including synthetic backward-clock
detection, bounded delta, invalid/private result handling and reset/concurrent
lease separation. Prototype and all eight package typechecks pass (4.909 s).

The ordinary 20-repetition native Git/PostgreSQL run passes all 20 cases plus
idempotent migrations. Its 460 clock observations show no regression or malformed
sample and no database failure. The original 0289 unknown result did not reproduce
in this selection. This does not identify its cause or establish a fix.

The initial delayed run (20 repetitions, 2 ms per SQL query) also passes with 460
clock observations and no clock regression or database error. A final diagnostic
review added trace-generation isolation: a late completion after reset must not
be attributed to a later sample, while its result/error still reaches the caller.
All five final selector/trace tests pass (70.066 ms). Both repetition modes and
the candidate-save suite were rerun on that final test-harness code.

## Final focused results

- Ordinary: 20/20 cases pass, 897–1,353 ms per complete repetition, 460 clock
  samples, no clock reversal/invalid sample or SQL failure.
- Added 2 ms per SQL query: 20/20 cases pass, 1,322–1,678 ms per repetition,
  another 460 clock samples and no reversal/invalid sample or SQL failure.
- Existing candidate-save selection: all 40 admission/original/HTTP/Temporal/native
  Git checks plus idempotent migrations pass, including uncertain dispatch,
  reconciliation, cancellation and no resend after an effect.
- Final prototype and eight-package types pass (2.292 s). Five SQL runs in total
  pass idempotent migration checks: two preliminary reproductions, two final
  reproductions and one candidate-save regression selection.

These repetition timings include setup/admission/save/inspection/recovery for a
small fixture. They are not authenticated interactive latency, warmed C22 p95 or
evidence about real provider performance. [Raw diagnostics](RECOVERY.json) retain
all final per-iteration rings and preliminary aggregate samples. Preliminary
source hashes were not captured; final harness/dependency hashes are recorded.

All **1,419 broad regression tests pass** (153,273.223 ms; no failures, cancelled,
skipped or todo tests). The 95-artifact kit and read-only workflow-token audit pass.
All 334 checked local links, nine source/harness hashes, 40 final sample records,
920 clock observations and the fixed 17/25 tracker calculation validate. The
original 0289 failure artifact and all three protected source hashes are unchanged.
Only the three test-harness files changed under apps/packages; no production source
changed. Whitespace checks pass and unrelated user files remain untouched.

## Finding and next work

0289's unknown outcome did not reproduce in the final 40 cases. There is no
established root cause, no evidence ruling out clock failure in the original run,
and no production recovery fix. The prior failed joined sample remains unchanged
in [0289 evidence](../0289/EVIDENCE.md). The new trace is also used by that joined
recovery assertion when it is next run. Avoid repeating this narrow passing test
indefinitely; resume reduction of source-review identity-policy traversal and
investigate any recurrence using the bounded diagnostic.

No production source changed. Full SQL, the managed authenticated 34-source
journey, build, live models/providers and actual UI acceptance were not rerun.
Only each run's owned disposable PostgreSQL/tmpfs and native Git/Temporal fixture
data were removed. No user data, credential, live clock/policy, records/D1 adoption,
spending, runtime grant/write, signature, deployment or release changed.
Progress remains **68% (17/25; 8 remaining; +0 points)**.
