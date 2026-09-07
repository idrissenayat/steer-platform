# Spec

- Generate a separate projector client secret and service-account subject only inside
  the existing disposable Keycloak realm. Keep no real provider credentials.
- Restrict the projector authenticator to its actual client, audience and issuer;
  resolve current authorization from the same native Git repository as the operation.
- Pass the actual authenticator into the production recorded worker runtime. Its
  repeated current-identity checks around receipt/source/SQL work remain unchanged.
- Keep human, dispatcher and projector membership records distinct. Preserve all
  records when changing one service grant; no dispatch grant implies ingestion.
- Before any receipt read or projector database connection, reject dispatch-only
  projector grants, revoked membership, invalid tokens and a valid dispatcher token.
- Restore current projector authority and require the same exact recorded operation
  to complete once through actual Temporal/Git/PostgreSQL. After completion, revoked
  projector access must deny a direct re-observation without another receipt read.
- Keep both service-account subjects, content and secrets outside workflow history.
  Preserve exact browser source opening, replay, single ingestion and owned cleanup.

Gate authority and live GitHub transport remain outside this test's evidence scope.
Non-durable test fixtures may retain explicit synthetic principals for their isolated
database assertions; they are not the durable worker's authorizer.
