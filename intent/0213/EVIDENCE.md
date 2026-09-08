# Development evidence — 2026-09-08

Base: `c9cff33723d950f52bc4e467b443fe6c327376e6`.

## Delivered boundary

`@steer/data/candidate-originals` supplies disabled immutable `put`/`read`/`close`
storage. The worker composition's new admission-only `verifyOriginal` checks the
exact admitted operation without touching Git or granting dispatch. Restored
requests replan all three documents and consent against authenticated metadata.

AES-256-GCM encrypts schema-canonical JSON before SQL, with a fresh nonce and
per-draft external key lease. Only encrypted envelopes plus content-minimized
metadata enter the separate forced-RLS schema. Key IDs are references, not keys.
Crypto helpers zero their own temporary key/plaintext byte buffers; JavaScript
strings, provider-owned key buffers and all process memory are not claimed erased.

Migrations 0009/0010 add the table, restricted draft role grants and immutable/
monotone trigger. They run only in owned disposable test databases. The real local
seven-migration baseline still rejects the expanded eleven-entry journal before
private-state or administrative DB access. No real role is provisioned.

Current trusted lifecycle supplies original creation, earlier use deadline and hold.
SQL serializes same-draft revisions, preserves creation, and latches observed hold/
shortened use clocks. The fixed upper bound is 168 hours; new retries/revisions
cannot renew it. Expiry/holds deny ordinary use without deleting rows or keys.
Authority and historical-key access are rechecked around recovery; services run
outside SQL. Current grants, accepted policy and key/copy lifecycle are required
trusted dependencies, not implemented authority verifiers or configuration booleans.

## Verification

- `pnpm test:data:integration`: **89/89** checks pass on disposable PostgreSQL
  16.14, native Git and Temporal 1.31.2. Twelve new original-storage cases cover
  exact Unicode/consent reconstruction, concurrent immutable puts, owner/org/product/
  role isolation, stale or unadmitted input, hold/expiry denial across revisions,
  corrupted copies, current grant/key revocation, lost insert acknowledgement and
  bounded/closed retrieval, including mutation of a provider-owned key buffer during
  validation. Dependency spies confirm no authority/key/lifecycle calls span draft
  SQL transactions. SQL query parameters and rows contain no test source
  plaintext or key bytes. Both migration passes apply all eleven entries.
- The actual candidate Temporal suite now loads encrypted originals using a new
  store/pool after the writing store is closed. It commits one native Git bundle,
  replays after worker recreation without another send and excludes documents,
  ciphertext and secrets from workflow history. Other cancellation/unknown cases
  remain verified; no fixture loader is installed in the real application.
- Worker/data/domain/registry unit tests plus migration controls: **278/278** pass
  (47 + 36 + 27 + 166 + 2), including three new authenticated-envelope tests.
- Full prototype/eight-package typecheck passes. Protected architecture, Exam and
  accepted policy SHA-256 values remain `9e1783a5…`, `84ad1d4c…`, `f8a9cb9a…`.
- Separate existing Temporal/projection regressions: **33/33** pass, including the
  expanded test migration set and recreated worker processes. Destination-runtime
  encrypted-session/native-Git regression: **1/1** passes. No real login or UI
  acceptance is implied. Kit validation (95 required artifacts), workflow token-
  scope audit and whitespace checks pass.
- Drizzle regeneration reports no schema changes, confirming the schema/snapshot
  and migration metadata agree. This check does not apply a real migration.

## Explicit non-claims

All lifecycle/grant/key services are synthetic in-memory test ports. The SQL,
native Git and Temporal server are real disposable local harnesses, not actual
GitHub account acceptance. No plaintext source or key is placed in Temporal
history. This is adapter/pool and worker reconstruction, not a tested all-copy
backup restore or lossless browser refresh.

D1 remains unsigned/inactive. No key recovery/destruction, backup/WAL/replica
inventory, qualified hold-preservation service, disposition or purge is delivered.
No real database/schema, user content, key, grant, spending authority, deployment,
accepted policy, protected Exam or signed architecture was changed. General draft
autosave/versioning, generation checkpoint persistence, real lifecycle and key
bindings, development-role orchestration and human UI acceptance remain open.
