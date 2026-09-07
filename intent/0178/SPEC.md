# Spec

- Existing disposable Keycloak owns issuance of fresh service-account tokens; no
  fabricated dispatcher JWT or custom JWKS response substitutes for this boundary.
- The browser fixture passes explicit test-only identity configuration, source
  transports, grant publisher and token supplier to the owned storage harness.
- The storage harness constructs the production identity runtime with its own
  database credentials, explicit exact-operation profile and managed scheduler.
  The worker harness owns only a separate Temporal connection and fixed task queue.
- Commit separate dispatcher grants alongside the current human grant in the same
  native Git source. Projection-only permission denies start before any attempt;
  explicit dispatch permission allows one attempt; current revocation denies status.
- After dispatch, recreate the queued worker runtime before it reads the current
  human browser receipt. Verify one exact source projection, durable replay and
  exact source opening. Source content, human/agent subjects and secrets stay outside
  workflow history. No automatic retry or new save follows uncertainty.
- Runtime/session/worker/server ownership stays explicit and disposable fixtures are
  closed. This bearer-only test runtime never starts a browser login using its
  unused placeholder browser client secret; the actual token supplier owns the
  real generated service-account credential.

No production code, browser design, signed artifact, schema or dependency changes.
Synthetic gate/projector authority and GitHub response adapters remain disclosed.
