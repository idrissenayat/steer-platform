# 0310 — Owned development-history integration evidence

Date: 2026-09-10. Base: `2d66ddfd1cf44a6a249117463b4df111c4d490fe`.
Implementation contract: [Spec](SPEC.md). Exact checks, samples, limitations,
failed iterations and source/protected hashes: [verification](VERIFICATION.json).

## Delivered

The actual API factory can now explicitly bind the retained development-history
service to one owned development records/content read and, only for the exact
recorded reference in its original, one separately authorized scope read. Real
canonical codecs and SDK/worker verification preserve both drafting roles, source
and predecessor lineage. Both actual leases and all independent record/key/source
policies remain checked; no permission cache or relaxed deadline was added.

The public contract preserves exact documents and pending, partial, complete,
clarifying, attention-required and expired history. Human corrections do not alter
the original generation. Raw exchanges remain private. Expired history does not
renew execution, retry, semantic quality or a gate. The public error remains the
existing sanitized message. Invalid binding fails closed rather than falling back.

Nested scope cancellation now has an explicit actual-drain handle. The parent does
not release admission or finish shutdown while a scope key lookup remains held.
The standalone metadata/content owners expose that distinction internally without
exposing a drain observer or authority-bearing callback to public requests.

## Measured application effect

| Actual authenticated synthetic action | Previous attempts | Now |
| --- | ---: | ---: |
| New-distinct preview | 1,815 | 509 |
| New-distinct confirmation / recovery / repeat | 3,823 / 3,795 / 3,793 | 1,211 / 1,183 / 1,181 |
| Proposal-continuation preview | 2,105 | 799 |
| Proposal-continuation confirmation / recovery / repeat | 4,403 / 4,375 / 4,373 | 1,791 / 1,763 / 1,761 |

New-distinct preview uses about 72% fewer attempts; first confirmation about 68%
fewer. These reductions do not represent completion percentages or UI speed.
Every listed action still exceeds the unchanged 200-attempt ceiling. Samples are
undelayed functional runs sharing the host with other checks, not the required
20 ms-per-attempt, five-second-p95 warm/cold/concurrent protocol.

## Verification results

- Broad regression: **1,502/1,502 passed**, including the new explicit-binding and
  held-caller history test. Architectural package boundaries pass.
- Final focused discovery/content/history/factory/boundary checks: **59/59 passed**.
- Prototype tests: **88/88 in 17 files**. Prototype and all eight package/application
  type checks pass. Kit validation finds 95 required artifacts; workflow token
  scope audit passes with contents read-only.
- Native default journey: **three joined checks plus idempotent migrations** pass
  on final production source. Native proposal-continuation: **one joined check
  plus migrations** passes. Both verify bound owned/legacy DTO equality, eleven
  separate denial/change variants and nested held-key shutdown; then actual
  recorded roles, durable correction, confirmation, fixed Temporal execution,
  one synthetic native commit, lost-response/restart recovery and exact reopen.
- Native retained-development records selection: **nine checks plus migrations**
  pass, including owned/legacy equality for unbound pending, partial, completed,
  clarifying, uncertain, superseded and expired history. No invented scope read,
  changed records or model resend is accepted.

The continuation and retained-record selections began before the final direct
null-binding guard/type refinement; final focused/default checks cover those
refinements. These selections are not the complete PostgreSQL integration suite.
The harness removed only each run's synthetic container and tmpfs fixtures.

Retained failures are documented in the verification file: a new test used the
wrong helper names; new fixture/service typing initially failed; and the first
native denial test caught a mismatched public error string. All were corrected
and the affected checks rerun. Earlier failed runs are not presented as passes.

## Remaining boundary

**Intent capture: 68% (17/25 checkpoints; eight remaining; +0 percentage points).**
C22 remains open. Next replace the remaining repeated original-record and
preparation/confirmation reads within their existing pre-/post-effect boundaries,
then run the full unchanged benchmark. Other pending checks still require real
records adoption, authorized model-quality evaluation, actual runtime GitHub
save/reopen and signed-in human UI/failure/accessibility acceptance.

No live profile was changed or activated, no real model was called, and no runtime
GitHub draft was saved. No deployment, spending, deletion or signature is implied.
The protected architecture, Exam, retention policy and 0289 performance evidence
hashes are unchanged. The prior 0289 uncertain-recovery observation is not claimed
resolved by later successful samples. User-owned roadmap and outputs are preserved.
