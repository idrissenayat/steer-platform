# Development acceptance, not an independent Exam

| Requirement | Verification |
| --- | --- |
| Canonical public and loopback renderer configuration | Invalid profile/origin rejection tests |
| No browser credentials in renderer | Constructed-header test and actual HTTP observation |
| Identity authority not duplicated | Original Request/Response delegation test and full login suite |
| Restricted rendering | Query/path/method and MIME rejection tests |
| Bounded renderer work | 1 MiB rejection, actual five-second headers/body abort, 32-request admission |
| No open redirect or response-header injection | Real redirect rejection and fixed outgoing-header assertions |
| Native browser behavior retained | Actual Next.js/Keycloak/Git/Postgres Chromium suite |

This does not accept production ingress, hydration, specialist accessibility,
independent protected Exam findings, full product parity or any gate signature.

