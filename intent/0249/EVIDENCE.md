# Development evidence — 2026-09-08

Base: `8344a67bad083f527fed5c4061d58c2ab2eb1fba`.

## Capability

Assessed drafting can now carry whole source documents across scope batches up to
the unchanged acquisition and aggregate byte ceilings. The existing 32-source
scope envelope is not widened. A separately versioned context is computed by the
actual editor, bound to preparation, recomputed server-side and preserved with the
human direction in the immutable original. Legacy originals without that field
still render the old envelope.

The actual React test selects a Brief excluded from the old 32-source envelope in
a 34-source corpus, after complete assessment. It verifies exact context/reference
handoff and no automatic development from findings alone. Portable checks include
50 sources, stable ordering, exact Unicode boundaries and missing/oversized groups.

## Verification

- Final full regression: **1,115/1,115 pass**, including three new portable context
  checks and the new actual React 34-source direction case. Legacy envelope,
  recovery, clarification and portable browser-boundary checks remain passing.
- Focused actual scope/HTTP/SDK/SQL/Temporal suite: **63 checks plus idempotent
  migration validation pass**. These overlap the final full PostgreSQL 16.14
  integration run: **334/334 pass**. Two new SQL checks reject missing/substituted
  context and over-byte-limit corpus; the existing cross-batch case now proves
  all 34 exact sources survive preparation, SQL restoration and role rendering.
- Prototype/all eight package typechecks and optimized Next.js 16.3.4 build pass.
  Drizzle history, kit (95 artifacts), workflow scope audit and whitespace pass.
- All **146 local documentation links** in the current plan, ledger,
  implementation, workflow contract and increment packet resolve.

The initial large SQL fixture returned entire 20,000-byte documents as model
citations, exceeding the existing 100,000-character structured response limit. It
returned attention-required. The fixture now returns short exact citations while
preserving all source bytes as input; the rerun passes without any production
limit change.

Protected SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Boundary

This is synthetic-HTTP-tested production React plus actual recorded SDK/SQL code
with synthetic authority/model responses, not live browser, semantic or saved-
repository acceptance. Collections beyond 50 acquired documents or 128,000 source
bytes remain incomplete. Other record/request/wire limits and model-budget bounds
still apply. Historical expired/superseded assessment display remains separate.

No D1 adoption, real migration, credential inspection, model spending, runtime Git
save, gate, auth bypass, deployment or release. The credential skill preserved the
resolved decision. User-owned `docs/REAL-USER-ROADMAP.md` and `outputs/` are excluded;
the existing one-minute loop remains active.
