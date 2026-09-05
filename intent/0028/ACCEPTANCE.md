# Development acceptance, not an independent Exam

| Requirement | Check |
| --- | --- |
| Explicit local profile and separate secrets | Real lazy runtime bootstrap test and strict profile schemas |
| Canonical HTTPS loopback binding | Invalid-origin, actual Host and certificate-trust tests |
| Bounded transport | Actual oversized headers, TLS handshake and slow HTTP header checks |
| Startup cleanup | Invalid TLS and occupied-port tests preserve unrelated listener |
| Honest idempotent shutdown | Actual requests/resources drain, failure and forced-socket tests |
| Real sign-in behavior | Next.js/Keycloak/Git/encrypted-Postgres browser suite uses shared listener |
| No false activation | Default server unchanged, provider calls blocked in synthetic bootstrap, readiness 503 |

This does not accept production ingress, real secret loading, full product parity,
specialist accessibility, protected findings or a gate signature.

