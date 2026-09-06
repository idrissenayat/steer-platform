# Specification

1. Keep the complete independent 4,036-ID catalog. The no-argument quick runner
   preserves its 307 executions and explicitly leaves 16 heavy accessibility
   cases uncovered. The separate no-argument full runner selects those actual
   hooks too, for 323 executions. No caller callbacks, reports or case lists enter
   either runner. Report version v2 identifies the profile.
2. Execute the exact makeAccessibilityBundle(kind) inputs through 0067 with a
   trusted 12:03 evaluation clock. The positive verifies all six timed records,
   two observed-as-of records, 32,900 raw rows and 2,664,900 expanded cells.
3. Every negative declares ACCESSIBILITY:positive as a prerequisite. The runner
   resolves it only from its fresh private current-run execution array, requiring
   one passed, nonempty observed execution and binding its full execution digest.
   Missing, failed, zero-observation or duplicate prerequisites fail before the hook.
4. Instrument the actual iterator passed to the verifier. Hash each delivered row
   using a domain-separated eight-byte UTF-8 length prefix, preserving boundaries
   even for invalid inputs. Also retain the original newline-framed row digest for
   comparison with the fixture's signed summary. Record count, byte count,
   exhaustion, wrapper closure and a digest binding metadata plus consumed stream.
5. Do not read the tail after an early rejection. Close the iterator even when
   validation rejects or throws. Stream/consumer/cleanup failure cannot become
   successful evidence. Bound instrumentation to the original matrix plus one
   extra-row negative and the stated byte ceiling.
6. Only the valid positive proves the full expected matrix. A negative may exhaust
   its supplied partial stream and still be correctly rejected. Case status passed
   means its expected assertions passed, not that its matrix was accepted.
7. Save explicit quick/full snapshots. A dedicated integration test performs a
   fresh full run and compares it to the full snapshot. Quick root checks test
   stream mechanics, prerequisites and honest preflight without claiming heavy work.
8. `--full-report` always executes the full profile. Default/require-complete first
   inspects full hook availability: if any required hook is absent, return the
   actual quick report plus an explicit deferred-full preflight and nonzero status.
   If none is absent, run full before deciding completeness. Failed executions
   remain errors. No profile can approve gates or execution.

Synthetic/manual, structural/semantic and independent/protected boundaries remain.
No real credentials, provider reads/writes, cleanup, deployment or spending occurs.
