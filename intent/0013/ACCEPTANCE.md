# Development acceptance

- Provider discovery returns the expected HTTPS issuer and JWKS URL.
- TLS validation works only with the scoped test certificate; external origin
  requests are refused and default system trust does not accept the certificate.
- A real service-account token yields an agent with no human hats.
- Wrong audience/client, revoked grants, cross-tenant grants and human hats deny.
- The shared API allows only the current authorized tenant/tool combination;
  unknown role headers cannot override it and readiness remains 503.
- No real credentials or identity records are used or logged; the run's
  container, tmpfs state and generated credentials are removed afterward.
