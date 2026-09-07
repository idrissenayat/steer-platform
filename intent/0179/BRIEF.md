# Brief

The browser-created Brief journey now has actual human and dispatcher authentication,
but its worker still receives a manufactured projector principal. Replace that
worker authority with a distinct local Keycloak service account and current Git
authorization through the existing production adapters. Dispatch and ingestion must
remain separate permissions and identities; authentication is not gate approval.
