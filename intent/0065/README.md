# 0065 · Explicit-time recovery evidence

The recovery audit now verifies all supplied signatures at explicit times and
requires an independently signed exact-byte observation and recovery interval.
The one-hour RTO cannot be relaxed by a caller-selected limit. Native journal
timestamps, canonical encoded bytes and historical source records are checked.

Read BRIEF, SPEC, PLAN, development ACCEPTANCE and EVIDENCE. Pre-acknowledgement
cases remain UNKNOWN_RECONCILE_PROVIDER. No data is restored and no production
recovery, provider access, gate acceptance or release is authorized.
