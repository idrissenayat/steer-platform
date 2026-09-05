# Development acceptance, not an independent Exam

| Requirement | Check |
| --- | --- |
| Bounded active work and global rate | Admission concurrency, error release and monotonic bucket tests |
| No unbounded caller map or header-based bypass | Fixed-size limiter and forwarding-header test |
| Byte/time/chunk/disconnect bounds | Body reader and API status tests |
| Generic oversized/overload errors | No-store and nonreflection assertions |
| Actual local HTTP parser/header deadline | Spawned server raw-socket 431 and 408 checks |
| Authentication regression | Real Chromium/Keycloak/Postgres/Git harness |
| No implicit activation | Local server remains 503 ready, 401 tool and 404 auth route |

Production distributed ingress, capacity sizing and database execution deadlines
are not accepted by these development checks.
