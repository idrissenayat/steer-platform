# Spec

- Add an opt-in `--recovery` Keycloak integration mode and dedicated package command.
  Do not combine it with browser/durable-session modes. Existing modes keep their
  behavior; provision the additional recovery account only for this mode.
- Use the already pinned local Keycloak image, run-specific TLS trust, random
  test-only service credentials and distinct actual recovery/projector subjects.
  No password grant, implicit flow, human hats or broad default scopes for agents.
- Extend only test fixtures with explicit disposable identity inputs. The normal
  synthetic issuer path remains the default for existing fast/local tests. Real
  Keycloak tokens and JWKS must pass production signature, client, audience,
  organization and current Git membership validation; no identity bypass callback.
- Reuse the existing exact failed-run recovery test with an owned local Temporal
  server and migrated PostgreSQL database. Verify one retained recovery execution,
  queued runtime reconstruction, duplicate denial, exact source content/revision,
  one SQL event and unchanged original FAILED state.
- Deny projector-token substitution into recovery, recovery-token substitution into
  projection, invalid tokens, agent human-hat assignment and substitute dispatch/
  projection/recovery grants. Early denials must not consume the managed start
  attempt or read receipts/ingest SQL as appropriate.
- Commit projector revocation after receipt readback: the current post-receipt
  check must deny before SQL. Restore only the disposable test grant before the
  authorized workflow activity. Later recovery revocation must not alter the
  independently valid projector grant.
- Retain bounded setup, exact container-label/ID cleanup, separate connection
  ownership, no private content/credentials in workflow history and no live profile.

The dedicated suite includes baseline provider/authentication checks plus one joined
recovery case with multiple assertions. Do not count assertions as separate cases.
Receipt provenance and GitHub responses remain synthetic. This does not establish
browser-created receipt integration, actual GitHub writes, full governed authority,
qualified gate evidence or live acceptance.
