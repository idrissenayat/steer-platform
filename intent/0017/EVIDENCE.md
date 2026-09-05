# Development evidence

Verified on 2026-09-05 UTC with Node 24.20.0, from parent candidate
`c3dde60698ca97d5b1965c0bfe913cf3567e4224` plus this increment.

## Observed correction

The first two runs reached actual password-form/code issuance and a successful
token-endpoint response, but STEER rejected the token pair. Allowlisted diagnostics
showed a subject mismatch while issuer, nonce, audience, profile and 180-second
lifetimes matched. The minimal human client deliberately had no default scopes,
which omitted the access-token subject mapper. Added the explicit 26.7.3
`oidc-sub-mapper`; the actual ID/access subjects then matched the imported user
and the complete flow passed. No broker or OIDC validation was loosened. The
required provider profile is documented in `docs/KEYCLOAK-IDENTITY-PROFILE.md`.

## Final checks

- `npm exec --yes --package=node@24.20.0 -- pnpm test:identity:integration`:
  exit 0; 12 real-provider check groups on digest-pinned Keycloak 26.7.3.
  The original six agent/TLS/grant groups remain passing. Six human groups
  verify S256 and disabled grants, invalid-password denial, actual form/code
  exchange, shared human tool context, replay/tenant/revocation, local logout,
  and provider rejection of corrupt PKCE (400) and wrong client secret (401).
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0; kit/workflow
  audits, typechecks, 88 prototype tests, 20 control tests, workspace tests
  (including 18 API tests) and builds passed. Unchanged packages use local Turbo
  cache; no fresh visual browser review is implied.
- `git diff --check`: clean before publication. Every harness run confirmed
  cleanup of only its own labeled container, temporary data, synthetic users,
  generated passwords/client secrets and TLS files. Failed attempts were not
  counted as passes and left no running test service.

## Boundaries

The provider is real local Keycloak; the user identity and credentials are
generated fixtures. Form navigation uses a scoped HTTPS driver, not a browser
engine. STEER is invoked through real Hono request handling in-process, not a
deployed public ingress. Store Maps and grant records are test-only fixtures.
Encrypted Postgres is separately verified in 0015, not composed into this run.

No real account/provider access, runtime GitHub/Test Agent key use, operational
database change, public login activation, spending, deployment, release,
protected Exam edit or gate signature occurred. Browser cookie/TLS behavior,
combined storage, authoritative membership and runtime configuration remain open.
