# Intent 0290 specification

1. Add a CLI-only `--candidate-recovery-repro 1-20` selection with optional
   `--query-delay-ms 0-5`. Reject malformed, combined and unbounded selections;
   never report it as a full suite or authenticated UI journey.
2. Repeat the existing lost-native-acknowledgement test, not a weaker substitute:
   one native save, original admission reuse, exact receipt inspection and
   already-sent `compareAndWrite` recovery without another dispatch. Keep every
   iteration's bounded diagnostic, including failures, and stop on a failure.
3. Extend test-only SQL tracing to count clock observations/regressions and
   largest backward delta per leased client. Recognize only the existing exact
   millisecond clock query. Never log absolute times, SQL, arguments, identities,
   credentials, source or response bodies. Invalid diagnostic data must not change
   query results/errors; reset/release must not mix clock sequences.
   Pending completions from a prior trace generation must not contaminate a new
   sample after reset; the original completion/error still reaches its caller.
4. Prove tracing privacy/semantics, selector bounds and a synthetic backward-clock
   observation. Run bounded ordinary and delayed reproductions plus existing
   candidate-save regression, broad tests and types. No changed production code
   or full managed-journey rerun is implied by this harness-only increment.
5. Record whether 0289's unexplained result reproduced. Passing repetitions are
   not a root-cause finding or a production fix. Preserve the failed 0289 evidence,
   the fixed progress denominator, signed sources and unrelated user files.
   No credentials, live models/spend, runtime grants/writes, records/D1 activation,
   deletion of user data, gate/signature, deployment or release is authorized.
