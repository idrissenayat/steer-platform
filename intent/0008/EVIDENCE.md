# 0008 development evidence

Verified 2026-09-04 against the source in this delivery commit, based on
`a8493c8208df6aaa49925a0f86e38c6914d90e42`.

- Ten new identity tests passed using generated RSA keys and isolated JWKS
  responses. The test process made no external identity-provider requests.
- One additional API integration test passed: a genuinely signed token
  traversed verification, current-grant resolution and `session.context` over
  the Hono request interface; wrong tenant, fake token and subsequent
  revocation were denied. Readiness remained 503.
- Root `pnpm check` passed: 88 prototype tests, 17 control tests, seven registry
  tests, nine API tests, ten adapter tests and two web tests, plus kit/scope
  checks, typechecks and builds. New adapter/API tasks ran uncached; unchanged
  package tasks used local Turbo cache entries.
- Local runtime remains Node 25.9.0 / pnpm 11.19.0. Node 24 hosted CI and actual
  provider login are not claimed by this record.
- JOSE is pinned to 6.2.10 (not the newly published 6.2.11). No dependency-age
  exemption was introduced.

## Remaining integration work

The normalized Keycloak profile requires access-token mappers for `steer_org`,
`steer_kind` and `steer_hats`, an API audience and an allowed client ID.
These claims must come from administrator-managed membership, not editable
user attributes. Token claims alone never grant tools: a trusted current
authorization resolver is mandatory, exact-bound to issuer/subject/org, active
state and validity. It must fail closed if the authoritative projection is
stale or unavailable. The adapter deliberately provides no permissive fallback.

No real realm, client, browser login, grant projection, database, MCP, Temporal,
agent issuance, signature provenance, provider write, deployment or spending
was enabled. The current principal is for tool access, not a gate-signature
envelope; revision/session/provider-proof requirements remain separate.
M2 is partial and the five Gate 2 R5 findings remain open.

References: [JOSE verification](https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md),
[JWKS resolver](https://github.com/panva/jose/blob/main/docs/jwks/remote/functions/createRemoteJWKSet.md),
[Keycloak OIDC endpoints](https://www.keycloak.org/securing-apps/oidc-layers).
