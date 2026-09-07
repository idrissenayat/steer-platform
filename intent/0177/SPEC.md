# Spec

- Reuse the created-Brief scenario's owned native Git repository for both the actual
  operation record and a separately committed dispatcher grant.
- Authenticate signed dispatcher JWTs through the production identity runtime and
  current Git resolver. A projection-only grant must not start the workflow.
- Submit exactly the configured operation through HTTP; a second attempt cannot
  create a second workflow. Queue across worker-runtime reconstruction, then use
  actual current save-status readback and exact Git artifact verification to ingest
  into the isolated PostgreSQL projection.
- Compare saved and projected revision/content/blob and curated read results.
  Preserve lost save acknowledgment, later unrelated commits, replay, duplicate,
  revoked status and separate projector/human permission checks.
- Keep private receipt, content, credentials and dispatcher subject out of workflow
  history. Close owned identity/Temporal/database resources and temporary Git data.
- Do not replace another fixture's fixed-clock transport or fault hooks when
  sharing its source. Only the current-time dispatcher transport receives current
  synthetic installation-token expiry metadata.

No production change is required: this verifies the composition added in 0176.
No actual Keycloak dispatcher, approved gate authority or live GitHub write is proved.
