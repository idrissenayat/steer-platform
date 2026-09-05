# Intent

Verify that STEER's selected Keycloak profile and human sign-in broker actually
interoperate before wiring real people or deployment configuration. Test the
provider's password form, confidential client, S256 PKCE and returned ID/access
tokens, then current grants and local logout through STEER's real HTTP boundary.

Use only generated identities, credentials, TLS material and temporary local
container data. Preserve all existing service-account contract checks.
