# Development evidence — 2026-09-08

Base: `c6cdba48a8be788f71af1938dd064d081427bff4`.

## Capability

The offline evaluator reuses production scope preparation, actual recorded SDK
verification and whole-target combined-result validation. A 23-case synthetic
corpus supplies provisional labels, coverage criteria and decisive citation spans.
It detects structurally valid wrong labels and missing qualifiers without treating
exact citations as semantic accuracy. Missing cases remain in the denominator.
The read-only CLI exposes no live mode or credentials and emits no source prose.
See [the evaluation guide](../../docs/INTENT-SCOPE-EVALUATION.md).

## Verification

- Focused evaluator: **9/9 tests pass**. Synthetic reference outputs pass **23/23
  candidate cases, 36/36 expected target labels and 21 exact SDK exchanges**. This
  is a test transport copying expected answers, not model quality measurement.
- Wrong-label, missing-qualifier, missing-case/second-batch, corrupted/refused SDK
  exchange, false-authority, stale/duplicate/foreign binding and CLI checks pass.
  Positive regular-file replay and nonblocking symlink/FIFO rejection also pass.
- Agents package typecheck passes after correcting readonly assignments in test
  mutation helpers (replacing copied observation objects, not changing contracts).
- Final full regression: **1,124/1,124 pass**, including the additional CLI file-
  boundary case. The earlier 1,123-test run also passed; it is not an extra
  independent acceptance result.
- Optimized Next.js 16.3.4 build, kit (95 artifacts) and workflow read-only scope
  audit pass. No SQL or live runtime binding changed; the prior increment's 334
  PostgreSQL checks are not represented as a new database verification run.
- Final prototype/all eight package typechecks pass. All **155 local links** in
  the 11 current plan/ledger/implementation/workflow/evaluation/packet files resolve.
  Whitespace checks pass. Tests remove only their own temporary synthetic files.

Protected SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Boundaries

No production behavior or runtime composition was activated. The corpus needs
independent human adjudication and representative held-out examples. Explanation
quality remains ungraded; raw replay consistency does not establish provenance.
No real migration, D1 adoption, key inspection, model calls/spend, Git runtime save,
auth bypass, gate, deployment, release or destructive action occurred. The API-key
skill preserved the resolved credential decision. OpenAI Docs informed task-specific
candidate cases and explicit human-calibration needs; no hosted Evals API is used.

User-owned `docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched. The one-minute
loop stays active for remaining historical recovery, live authority and save/reopen.
