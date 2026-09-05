# Development acceptance, not an independent Exam

| Requirement | Check |
| --- | --- |
| Strict role/transport/option configuration | Rejection unit test without reflecting inputs |
| Bounded connections and pending acquisition | Eight held clients, 32 queued waits, overflow and timeout/recovery |
| Server query cancellation | PostgreSQL SQLSTATE 57014 and usable subsequent tenant operation |
| Server lock cancellation | Held advisory lock, SQLSTATE 55P03, rollback/recovery |
| No stale disabled limits on reused clients | Deliberate session contamination then checked transaction settings |
| Idle transaction termination | SQLSTATE 25P03; pool replaces connection |
| No inherited SQL options | Synthetic PGOPTIONS does not alter connection settings |
| Browser/session guarantees preserved | Runtime factory in assembled auth harness; provider/browser regressions |

No real database grant, production TLS, network-blackhole, total transaction
deadline, independent Exam or gate result is inferred.
