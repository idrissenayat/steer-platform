# Human provider contract

Reuse the digest-pinned Keycloak 26.7.3 image, non-root/loopback HTTPS, isolated
scoped certificate trust and exact-run cleanup in the existing harness.

Add one synthetic human and a separate confidential `steer-test-web` client.
Enable standard authorization-code flow only; disable implicit, password/direct
grant and service-account grants. Require S256; register only the exact
`https://steer.test/auth/callback` URI. That synthetic hostname is handled by
Hono in-process, never resolved or contacted externally.

With default scopes deliberately empty, explicitly attach Keycloak's
`oidc-sub-mapper` for the access-token subject. Do not hardcode a subject, adopt
an unverified username as identity or make STEER's required `sub` optional.
The provider must bind both tokens to the imported immutable user ID. This
minimal-client requirement follows the selected version's
[subject mapper implementation](https://github.com/keycloak/keycloak/blob/26.7.3/services/src/main/java/org/keycloak/protocol/oidc/mappers/SubMapper.java).

The HTTP driver follows only the pinned Keycloak login form action, maintains
provider cookies only within that issuer, and never automatically follows
redirects. A wrong password must fail before the generated password succeeds.
Callback must have the original state, expected issuer and a code, not tokens.

Pass the actual provider callback into STEER's browser routes with the original
login cookie. Require real code/PKCE/confidential-client exchange, ID/access
validation, a human subject/hat context, tenant denial, current grant revocation,
callback replay denial and local server-session logout. Corrupting the verifier
or confidential secret must fail without creating a session.

Only fixed stage names, pass/fail, status codes and allowlisted boolean/lifetime
diagnostics may be printed. Never print provider payloads, credentials, form
actions, callback URLs, JWTs or cookies, including on assertion/child failures.

Test-only Maps and a synthetic grant resolver remain explicit fixtures. This
does not verify encrypted Postgres and Keycloak in one assembled service, a
real browser's cookie/TLS/navigation policy, Git-backed real membership, provider
logout, public ingress limits or operational configuration. No CLI route is
enabled, no real account is created, and no gate or spending is authorized.

References: [Keycloak OIDC flows](https://www.keycloak.org/securing-apps/oidc-layers),
[Keycloak client administration](https://www.keycloak.org/docs/26.7.0/server_admin/).
