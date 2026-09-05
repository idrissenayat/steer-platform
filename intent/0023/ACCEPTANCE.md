# Development acceptance, not an independent Exam

| Requirement | Check |
| --- | --- |
| Active client error cannot crash the process between queries | Exact synthetic backend termination and pool recovery |
| Closed admission and truthful drain | Held lease finishes; repeated shutdown shares one promise |
| Forced release only for owned work | Lost-reply relay, one forced lease, zero remaining connections |
| Unknown commit is not retried/reported as rolled back | Actual committed row, dropped acknowledgement, typed unknown outcome and one callback execution |
| Confirmed commit semantics preserved | Existing post-commit cleanup test plus unknown-commit unit test |
| Other boundaries remain intact | PostgreSQL, root and real authentication/browser regressions |

Shutdown fault evidence does not authorize shutdown of real infrastructure or
claim proactive detection of every broken network path.
