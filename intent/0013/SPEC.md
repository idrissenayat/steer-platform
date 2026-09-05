# Specification

- Run digest-pinned Keycloak 26.7.3 in a uniquely named disposable container,
  with loopback-only HTTPS, tmpfs data and generated test credentials.
- Generate a one-day localhost certificate. Trust it only inside the test's
  origin-restricted transport; do not disable certificate validation, modify
  system trust, relax the production HTTPS requirement or use real App keys.
- Import an isolated synthetic realm and service-account identity with explicit
  audience, organization, agent type and empty human-hat claims. Disable user
  registration, password grants, implicit flow and interactive flow on that client.
- Exercise discovery, real RS256/JWKS verification, fresh authorization
  revocation, tenant and hat mismatch, audience/client denial, and shared API
  tenancy/tool grants. Test grants are explicit fixtures, not real Git authority.
- Leave readiness and default CLI fail-closed behavior unchanged. This does not
  establish human browser login, persistent identity storage or production TLS.
- Cleanup only the exact run-owned labeled container and mkdtemp directory.
  Keep the harness opt-in; ordinary root checks must not contact providers.
