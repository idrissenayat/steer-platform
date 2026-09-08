# Development evidence — 2026-09-08

Base: `c7f3fbbc3ca6f09cc3ce80241c4e637ee0126079`.

## Capability

The actual draft conversation now offers read-only previous/next history and a
fresh-latest read before editor replacement. It uses the existing authenticated
exact-revision endpoint; no new persistence or grants. Explicit controller mode
prevents historical replacement/rebase even if numeric navigation reaches the
newest revision. Private previews clear on denial/closure, conflicts persist and
unknown writes must be recovered first. See [the user guide](../../docs/DRAFT-HISTORY.md).

## Verification

- Focused controller/transport/actual React graph: **24/24 pass**, including four
  new controller tests and an exact older-revision transport test. Expanded UI
  assertions cover 3 → 2 → 1 → 2 → 3 navigation, read-only mode, current-edit
  preservation, read-only requests, focus, denial, fresh-latest replacement and
  unchanged conflicts. Axe WCAG2 A/AA checks pass with color contrast disabled.
- Prototype/all eight package typechecks, optimized Next.js 16.3.4 build, kit (95
  artifacts) and workflow read-only scope audit pass.
- Final full regression: **1,129/1,129 pass**. Full PostgreSQL 16.14 integration:
  **335/335 checks pass**. The new SQL
  case exercises numeric historical HTTP reads after API recreation under a
  read-only grant, exact old content/latest metadata, owner/key denial, unchanged
  latest content and no additional revision.
- The integration runner removed only its own synthetic PostgreSQL container and
  tmpfs data; no live database migration, retention change or user-data deletion.
- Protected Architecture, Exam and HR-01-R2 candidate policy hashes are unchanged.
- All **162 local links** in the 11 current plan/ledger/implementation/workflow/
  history/packet files resolve. Whitespace checks pass.

Protected SHA-256 values:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Boundaries

Synthetic HTTP React checks and synthetic identities/keys in disposable SQL are
not actual signed-in human acceptance. No live draft records or backend were
activated; the inactive records policy, model budget and runtime Git save remain
closed. Historical expired/superseded agent-run recovery is not claimed complete.
No key inspection, paid model call, gate, auth bypass, deployment or release.

The credential skill preserved the resolved key choice. The web AGENTS directive
was followed by reading installed Next.js client-boundary guidance. Existing
pink/orange classes and safe Markdown remain; no new dependencies or migrations.
User-owned `docs/REAL-USER-ROADMAP.md` and `outputs/` are excluded. The one-minute
loop stays active for the remaining journey.
