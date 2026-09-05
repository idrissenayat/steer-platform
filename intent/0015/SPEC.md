# Durable session storage contract

## Data boundary

The shared `@steer/tool-registry/browser-session` contract has no storage vendor
dependency. The broker and PostgreSQL implementation consume that contract;
the data package must not depend on adapters. Git remains the business system
of record. Temporary credentials are neither business records nor grants.

Pre-authentication has no trusted organization principal. Use a separate
`steer_auth` schema and SHA-256 namespace derived from trusted configured
issuer, client ID and exact callback URI, never a request field or token claim.
Use a dedicated `steer_auth_runtime` login, NOINHERIT, NOSUPERUSER,
NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and no schema/table ownership. Deny
application/projector access to auth tables and auth access to business tables.
Force namespace RLS with USING and WITH CHECK. Runtime SQL is internal,
parameterized and closed; RLS is not a sandbox against stolen SQL credentials.

## Confidentiality and lifecycle

- Store only hashed opaque identifiers, authenticated timestamps and AES-256-GCM
  envelopes with version, key ID, 12-byte random IV and 16-byte authentication tag.
- Authenticate envelope version/key ID and namespace, record kind, key hash,
  creation and expiry times. Reject ciphertext transplants and invalid envelopes.
- Require an explicit 32-byte keyring; no default, generated persistent key,
  plaintext fallback, key logging or environment-loading shortcut. At most four
  keys; new writes use the selected key while retained keys can read older rows.
- Bound payload size and TTL to five minutes in both application and database.
  Reject future-created/expired insertions and expired reads. Hash format is
  fixed at 64 lowercase hex characters.
- Serialize per-namespace/kind insert capacity checks using transaction-level
  advisory locks. Default capacity is 1,000 per kind, configurable 1–100,000.
  Reject over-capacity/duplicate inserts. All server instances must share the
  same configured capacity and identity binding.
- Reclaim expired ephemeral rows only in the current namespace during insert.
  TTL is an authentication deadline, not a promise that cold database rows are
  physically erased at that instant. Scheduled purge/backup handling remains
  part of later approved operations; no business-retention policy is changed.
- Consume login by atomic DELETE RETURNING, commit before decrypting/exchanging
  the code, and never restore an invalid consumed transaction. Sessions remain
  readable until expiry or namespace/key-scoped local logout deletion.
- Scrub connection context before/after transactions; rollback failures evict
  connections. Post-commit cleanup failure does not report a successful commit
  as a failure. Ambiguous connection failure is fail-closed, not proof of rollback.

## Remaining integration

No HTTP login or browser surface is enabled. Supply approved secret/database
configuration, same-origin route controls, real local human-code flow and
trusted Git-backed membership before composing live login. No refresh token is
stored. Provider-wide logout and key provisioning/rotation operations are open.

References: [Node 24 authenticated encryption](https://nodejs.org/download/release/v24.18.0/docs/api/crypto.html),
[PostgreSQL 16 DELETE RETURNING](https://www.postgresql.org/docs/16/sql-delete.html),
[PostgreSQL 16 row security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html).
