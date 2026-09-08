# Development evidence — 2026-09-08

Base: `d839bf630216bda458920b4541a8380bda88c500`.

## Implementation and observed behavior

The actual `IntentDevelopmentPanel` now mounts scope assessment controls backed by
the existing prepare/start/read API contracts. The parent passes the current human
and exact reviewed saved revision, and suppresses conflicting review/generation
controls while scope work is unresolved. The controller never changes source text,
chooses a direction, generates documents or saves a repository.

Fifteen new checks cover five transport cases, eight controller cases and two
production React interaction cases. They exercise exact reference requests,
same-origin/no-store transport, malformed/denied/substituted outputs, timeout and
slow cancellation drainage, partial/full batch progress, exact lost preparation/
start recovery, edits/undo, actual source-byte citation verification, no-sources,
expiry, closure and identity changes. The React cases use the actual development
panel and child graph, production transport and two-batch verification, but HTTP,
authority and model findings are synthetic. No real service/grant is installed.

The UI test exposed schema-normalized object-field ordering being mistaken for a
source edit, blocking assessment before start. Canonical structural comparison now
ignores object insertion order while retaining array order and actual values. A
specific reordered-input test and both UI cases pass after that correction.

Proposed Brief paths are not accepted by the existing direct reader. Instead of
crashing or widening that reader's contract, the UI retains exact cited passages
and explicitly marks direct opening unsupported. The existing test compiler graphs
were extended to include the new production component, not to substitute it.

Findings use inert React text, exact supported Brief links and visible scope gaps.
The actual polling timer issues reads only. A denied read clears findings and is
not rendered as no matches; source changes/undo suppress stale findings. No private
Exam, document body, provider credential or budget is sent in browser scope commands.
The controller keeps known recovery references in memory only, not browser storage.

## Verification

- Full regression: **1,096/1,096 passed**, including all fifteen new checks and the
  inert-text/automatic-polling assertions. Focused earlier results overlap this total.
- Both React cases pass again after moving the axe check to the populated findings
  state. Structural WCAG checks report no violations; color contrast is excluded.
- Prototype and all eight package typechecks, optimized Next.js 16.3.4 build and
  existing Drizzle migration-history validation pass.
- Kit validation (95 required artifacts), workflow token scope audit, all 137
  checked local documentation links and whitespace checks pass. No dependencies
  or server runtime configuration were changed.
- No server/API/database implementation or migration changed. The prior 319-check
  PostgreSQL integration at 0245 remains historical evidence, not a new run here.
- JSDOM axe checks exclude color contrast. No signed-in real-browser, visual,
  narrow-screen or live model/save acceptance is claimed.

Protected SHA-256 values remain unchanged:

- `intent/0001/ARCHITECTURE.md`:
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- `intent/0001/EXAM.md`:
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- `intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`:
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Next and authority boundaries

Continue scope-review metadata discovery/read-first recovery after refresh and
server-bound assessment consumption for direction/drafting. The legacy envelope
gate still blocks generation when its own coverage is incomplete; completing a
larger batched assessment does not override it. Live authority, D1 adoption, approved
model spending, semantic evaluation and I1–I6 save/reopen remain open.

No alternate preview, auth bypass, live persistence, real migration, credential
inspection/provisioning, paid model call, runtime Git save, gate, deployment or
release occurred. The API-key skill preserved the resolved credential decision.
User-owned `docs/REAL-USER-ROADMAP.md` and `outputs/` remain excluded. The existing
one-minute implementation loop remains active.
