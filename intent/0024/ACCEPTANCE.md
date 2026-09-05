# Development acceptance, not an independent Exam

| Requirement | Check |
| --- | --- |
| Exact managed identity binding | Mismatched issuer/client/callback rejected |
| Running is not a readiness claim | Running service still returns 503 ready |
| No new work/cookies after shutdown begins | Service 503/no-store/no Set-Cookie checks |
| Stop follows actual request and resource completion | Deferred request/resource unit tests |
| Failed cleanup remains closed/failed and is not retried | Sanitized shared failure promise |
| Real identity flow and final resource shutdown | Chromium/Keycloak/Git/Postgres harness through service factory |
| Package boundaries unchanged | Root controls and declared imports remain passing |

No public service, real membership/configuration or production UI acceptance.
