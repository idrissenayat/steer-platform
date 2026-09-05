# 0064 · Explicit-time money evidence audits

Forecast, invoice, aggregate and spending-decision evidence now have a bounded
explicit-clock audit path. It verifies every authorization/provider/store record,
requires independent exact-byte observation and retains the original business
checks. Reconciliation continues through 0057/0063, never the old scalar path.

Read BRIEF, SPEC, PLAN, development ACCEPTANCE and EVIDENCE. A successful result
is `VERIFIED` with `executionAuthorized: false`, not permission to spend. This
candidate does not change frozen records, production routes or gate approvals.
