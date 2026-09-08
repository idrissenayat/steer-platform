# Development evidence — 2026-09-08

Base: `49490534ff9cdef1d79738e179362999557573e3`.

## Delivered boundary

`@steer/data/draft-revisions` implements disabled immutable encrypted snapshot
append/read/close. Its portable content contract preserves exact source, ordered
clarifications and nullable three-document edits; it cannot store a caller claim
of generation provenance, review, signature or Git success as trusted state.

Every append binds a stable mutation ID and expected parent revision/digest.
The actual lifecycle row serializes final compare-and-swap and current use checks.
The same command converges once; changed reuse and stale parents conflict. An old
retry acknowledges its original revision and reports the newer latest version,
without replacing it. Earlier encrypted revisions remain available only while the
owner has current authority, usable lifecycle and historical key access.

Server-selected source revision increments on source/clarification edits. The
existing final-scope fingerprint changes for Brief/Spec changes, not Exam-only
changes; no review or consent is revived by undo or matching bytes. This store
does not mark any snapshot reviewed, independent, approved or recorded in Git.

AES-GCM authenticates the revision's content/parent/configuration/mutation/scope
and creation metadata. Only bounded metadata and ciphertext reach SQL. Plaintext
and key calls stay outside transactions; current lifecycle/key/grants and exact
stored bytes are rechecked before release. Lost insertion acknowledgement or
post-insert denial is unknown, not permission to replace the revision.

Migrations 0013/0014 add the precise lifecycle-owner FK and forced-RLS revision
table, SELECT/INSERT-only role grants and sequential-parent/current-use trigger.
The generated SQL's unique-key statement is ordered before its dependent FK.
History is technically capped at 1,000 revisions, with no deletion/pruning or cap
reset; each serialized plaintext is at most 768 KiB. These are limits, not disposal
authority or proof of complete production capacity/backup recovery.

## Verification

- Scoped unit and migration-boundary controls: **280/280** (domain 27,
  tool registry 168, data 36, worker 47, migration controls 2).
- Disposable PostgreSQL/native-Git/Temporal integration: **112/112**, including
  12 draft-revision checks. Coverage includes exact Unicode reconstruction across
  pool recreation, concurrent parent conflicts, replay after newer edits, lost
  COMMIT acknowledgement, lifecycle/owner denial, immutable history, strict SQL
  metadata, ciphertext transplantation and historical-key mutation/timeout.
- Existing Temporal/projection integration: **33/33**. The harness emitted one
  metrics-trailer warning (`transport: SendHeader called multiple times`); the
  functional checks completed. This is not observability acceptance or a diagnosis
  of that warning.
- Destination runtime integration: **1/1**.
- Prototype and eight-package typechecks pass. Drizzle regeneration reports no
  schema changes; kit validation reports 95 required artifacts; workflow scope
  audit and `git diff --check` pass.
- Protected SHA-256 values remain unchanged: signed Architecture
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
  canonical Exam `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`,
  accepted records-policy candidate
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

The integration harness applied all 15 development migrations only to its owned
PostgreSQL 16.14 database and exercised the existing owned Temporal 1.31.2 path.
Its candidate-save fixtures now reconstruct the encrypted source/document revision
through a fresh store before admission and dispatch. Authorization, keys, model
output and provider transport remain synthetic; no live OpenAI or GitHub request
is claimed. The separate real-workspace migration guard remains closed.

## Non-claims

All authority and key services are synthetic test ports. The lifecycle, encrypted
revisions, candidate originals, Temporal execution and native Git are actual owned
disposable test services, not a real GitHub save or actual UI acceptance. An aged
metadata fixture tests publication expiry without claiming days of live observation.
Ciphertext transplantation is simulated only in that disposable database.

No actual editor/API route uses this store. Unacknowledged browser keystrokes are
not preserved by this backend alone. Original generation/checkpoint provenance,
fresh-context role execution, current-source authority and live restoration/conflict
UX remain open. The metadata is not anonymous; keys, WAL/copies, backup restore,
qualified preservation and disposition still require adopted, proven controls.

D1 remains unsigned/inactive. The real local seven-migration baseline rejects the
fifteen-entry development journal before private-state/database work. No real draft,
key, grant, migration, paid call, GitHub runtime write, deployment, deletion,
accepted policy, protected Exam or signed architecture was changed.
