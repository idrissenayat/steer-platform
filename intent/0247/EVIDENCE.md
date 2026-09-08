# Development evidence — 2026-09-08

Base: `eece005733b46151e4dc66ee500c48636262a3ed`.

## Implemented capability

Added owner-bound scope reference discovery and connected it to the existing
authenticated editor. A returning human restores a saved draft, reviews its current
sources, discovers retained assessments and reads a selected reference before any
explicit pending-workflow recovery. No documents are changed or saved by this flow.

The data service uses only the draft database pool, fixed-role/RLS reads and current
metadata/per-reference authorities. No encrypted content is selected. The API
factory remains uninstalled by default. A metadata pointer is not cryptographic
provenance: the existing authorized reader verifies the original and observations,
then the editor checks findings against the actual reviewed corpus.

The first pagination fixture incorrectly varied only execution expiry. Admission
correctly returned conflict because expiry changes cannot create replacement
identities. The corrected fixture captures twenty-four genuinely different source
snapshots of the same draft, then verifies exact two-page enumeration. A malformed
hold UUID in another fixture was corrected without changing production constraints.
Lifecycle expiry is exercised by advancing only the disposable query's observed
database clock, not by weakening retention guards or changing real records.

## Verification

- Full final regression: **1,107/1,107 passed**. Eleven new checks cover four
  registry cases, two data admission/deadline cases, four controller cases and one
  actual React discovery/recovery case. Existing transport tests also now cover
  discovery request/response substitution and same-origin binding.
- Full PostgreSQL 16.14 integration: **326/326 passed**, including seven new actual
  API/SQL discovery checks. This run preceded the final metadata-authorization
  ordering adjustment. The final focused scope/HTTP/SQL/Temporal rerun passed
  **55/55 checks plus idempotent migration validation**, including the added final
  ordering assertion. These focused checks overlap the full integration total.
- Prototype/all eight package typechecks, optimized Next.js 16.3.4 build, Drizzle
  migration-history validation, kit (95 artifacts), workflow scope audit and
  whitespace checks pass. No migration, dependency or live service installation.
- Production React graph tests use synthetic HTTP. Three scope UI cases pass,
  including completed review restoration without model-use permission, inert text,
  exact progress recovery and structural axe checks (color contrast excluded).
  No real-browser visual, narrow-screen or live semantic acceptance is claimed.
- All **140 local documentation links** in the current plan, ledger, implementation,
  workflow contract and increment packet resolve after the final ledger update.

Review tightened final ordering: metadata authorization precedes the last SQL
snapshot, followed by current human revalidation. No metadata callback runs after
the snapshot. The final focused HTTP/SQL trace asserts this ordering directly.

Protected SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Scope and next boundary

Discovery uses UUID order, not invented chronology. It covers the exact latest
saved draft/current records configuration only, and only originals already
captured. Older revision/orphan recovery and historical-corpus display remain
separate. The editor cannot display an older corpus as current assessment evidence.

Next implement server-bound assessment consumption for direction/drafting. The
legacy generation-envelope coverage limit is unchanged. Larger contexts, real
authority, D1 adoption, approved model spending, semantic evaluation and the I1–I6
signed-in save/reopen journey remain open.

No live migration, credential inspection/provisioning, paid model call, runtime
Git save, gate, auth bypass, alternate preview, deployment or release occurred.
The API-key skill preserved the resolved credential decision. User-owned
`docs/REAL-USER-ROADMAP.md` and `outputs/` are excluded. The one-minute loop remains
active; source commits are distinct from runtime bundle saving.
