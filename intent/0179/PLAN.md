# Plan

1. Extend the owned Keycloak realm with a distinct projector service account and
   closure-owned token supplier.
2. Compose real OIDC/current Git authentication for the durable worker while keeping
   separate dispatcher, projector and human grant updates.
3. Run the full browser/Keycloak/Temporal/PostgreSQL journey and negative cases.
4. Run all repository/workspace checks and builds, update current documentation,
   commit, push and verify exact remote equality without changing protected artifacts.

Do not repeat the completed September 7 morning handoff or request a live grant.
