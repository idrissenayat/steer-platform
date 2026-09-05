# Execution route

1. Write the bounded specification and development acceptance cases.
2. Add the version-pinned JOSE adapter and strict configuration/claims profile.
3. Resolve fresh current authorization after token verification; deny any
   missing, inactive, expired, transplanted or revoked record.
4. Compose the adapter with Hono without enabling the default CLI.
5. Test generated-key JWTs, isolated JWKS transport and the real API route.
6. Run frozen install and root checks; document limits; commit and push.

No authoritative data is changed. Rollback is an additive code revert, not a
database operation. Keycloak login and authoritative grant projection are next
integrations, not prerequisites to these isolated cryptographic tests.
