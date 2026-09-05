# Keycloak identity binding: implementation profile

This engineering profile supplements the normalized OIDC adapter; it does not
replace the Gate 1-bound architecture or authorize a provider deployment.
Development evidence is in `intent/0013`, `intent/0014`, `intent/0016` and
`intent/0017`. Encrypted persistence is covered by `0015` and assembled
provider/Postgres behavior by `0018`.
Chromium-specific browser behavior is covered by `0019`.

## Required human-client settings

- Confidential OpenID Connect client, standard authorization-code flow enabled,
  client authentication required and PKCE S256 required.
- Exact registered HTTPS callback `/auth/callback`; no wildcard callback or
  caller-selected return URL. Fixed HTTPS issuer, JWKS, auth and token endpoints.
- Implicit, direct/password and client-credentials grants disabled for the human
  client. Agent service accounts use a separate client, no human hats and the
  same fresh-grant authorization boundary.
- Token lifetime at most five minutes. The tested realm uses 180 seconds.
  The broker requests `openid`, not offline access, and does not retain refresh
  tokens. Its session ends at the shortest ID/access/current-grant expiry.
- Access tokens must contain the immutable subject `sub`. In Keycloak 26.7.3,
  a client with empty default scopes needs an explicit `oidc-sub-mapper` with
  `access.token.claim=true` (or the reviewed equivalent from the `basic` scope).
  Do not hardcode `sub`, substitute username/email, or disable required-subject
  checks. The ID/access pair must refer to the same user.
- Required normalized access claims: `iss`, `sub`, `aud`, `iat`, `exp`, `azp`,
  `typ=Bearer`, `steer_org`, `steer_kind` and array-valued `steer_hats`. The
  test human mapper uses `human` and `['product-lead']`; those fixtures are not
  real membership or authorization. Production mappings must be administrator
  controlled, not editable profile fields or request headers.

The access-token audience must include the configured API audience and `azp`
must be an allowlisted client. Verify RS256 signature and current expiry, then
independently resolve fresh Git-derived membership/grants, intersect hats and
enforce tenant/tool scope. Neither provider login nor token claims create
business authority or gate-signing permission.

## Transport and runtime prerequisites

`createGitBackedBrowserApi` is the explicit Git-authority composition over
`createBrowserApi`, not part of default CLI startup. It requires a trusted
`ArtifactReader`, fixed authorization path and session store, and installs the
read-through resolver itself for both cookie and bearer authentication. Extra
dependency fields cannot override that resolver. Invalid paths fail construction.
Requests/token claims must never choose the source binding or artifact path.
Configure trusted
canonical HTTPS ingress, same-origin POST login/logout, callback-query/cookie
redaction, request deadlines/rate limits, an approved database role/key provider
and the real membership source before activation. Do not infer origin from
untrusted forwarding headers. No real secrets or deployment recipe are supplied
by the synthetic harness.

Increment 0021 installs per-instance admission around Git-backed composition and
bounded body reads inside the browser/tool routes. See `API-RESOURCE-LIMITS.md`
for exact defaults and the local CLI socket checks. Those checks do not replace
trusted public ingress, distributed limits or database execution deadlines.

The page that submits the native sign-in form must allow the exact configured
IdP origin as well as self in CSP `form-action`; Chromium also checks the
authorization redirect against that policy. Keep the issuer allowlist fixed
and retain no-referrer on callback responses so code-bearing queries cannot
become the final page's referrer. Do not broaden the policy to arbitrary origins.

Use the durable store's distinct `steer_auth_runtime` role and identity namespace;
keep all application instances on the same binding, encryption keyring and
capacity settings. Do not promote the harness's Maps or grant resolver into a
runtime fallback. Rotation/purge/backup and provider-wide logout operations are
not implemented or approved by this profile.

## Verification and known limits

Run `npm exec --yes --package=node@24.20.0 -- pnpm test:identity:integration`.
The digest-pinned local container is non-root, loopback HTTPS, temporary data and
generated credentials only. TLS trust is scoped to its exact origin/certificate.
The HTTP driver submits the actual Keycloak form and validates the callback,
broker exchange, tool context, negative policies and local logout. It does not
run a browser engine or verify SameSite/host-cookie/TLS/navigation behavior in
Chrome/WebKit/Firefox. Those browser checks remain required.

Run `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:integration` for the
assembled provider/Postgres harness. It adds a separate disposable database and
generated encryption key, applies the real migrations and exercises independent
app/store instances, exactly-once callback exchange, ciphertext inspection,
wrong-key denial and logout across instances. This mode has no Map fallback.
Both modes retain synthetic grants and in-process Hono request handling, not a
real runtime membership source or public ingress. No production identities,
grants or signatures are implied.

Run `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser` for isolated
Chromium 151.0.7922.34 via Playwright 1.62.1. Install its matched local binary with
`pnpm --filter @steer/api exec playwright install chromium` if missing. Browser
requests are restricted to this run's local origins. A temporary SPKI-only
exception permits the generated test certificate; an unrelated bad certificate
must still fail. This is not a production CA-chain pass and changes no OS trust.
The test validates native forms, cross-site callback/cookie behavior, HttpOnly/
Lax storage, CSRF denial and logout. It does not validate production Next.js UI,
Safari/WebKit/Firefox, public ingress or real user membership configuration.

Increment 0020 extends that browser command with production Git-resolver
composition and actual commits in a disposable local repository. Current valid
membership permits the session-context tool; a committed revocation, removed
record, duplicate identity, cross-organization record/document, unavailable
source, moving head or digest mismatch returns 401 on the next request. Restoring
the valid source restores authority without recreating the still-valid session.
There is no stale-grant or database authority fallback. The local test reader is
not a GitHub transport: live installation/artifact evidence remains separately
recorded in `GITHUB-RUNTIME-APP.md`. Neither test path writes real memberships.

References: [Keycloak subject mapper at 26.7.3](https://github.com/keycloak/keycloak/blob/26.7.3/services/src/main/java/org/keycloak/protocol/oidc/mappers/SubMapper.java),
[Keycloak OIDC flows](https://www.keycloak.org/securing-apps/oidc-layers).
