# Development acceptance, not an independent Exam

| Requirement | Evidence |
| --- | --- |
| Existing agent/TLS/claim/grant checks preserved | Original six Keycloak groups |
| S256 required and unsafe client flows disabled | Real provider negative requests |
| Password form rejects invalid password then issues correct code | Synthetic form driver |
| Real token exchange, human hats and safe cookies/redirect | Actual broker/HTTP response and shared tool context |
| Replay, tenant and current grant denial | Existing session with negative API calls |
| Local logout denies further session authentication | Server-store removal and API 401 |
| Wrong verifier/client secret rejected | Actual token-endpoint failures and no session |
| No regressions or leaked resources | Root checks and exact-run cleanup |

All human-provider groups live in `apps/api/test/keycloak-human.integration.ts`.
Browser-engine behavior and combined durable storage are not implied by a pass.
