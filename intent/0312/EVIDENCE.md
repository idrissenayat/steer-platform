# 0312 — Shared final-review phase evidence

Date: 2026-09-10. Base: `2fe7f7b3e63a125cbbc00c92823432cacd325573`.
Contract: [Spec](SPEC.md). Exact checks and samples: [verification](VERIFICATION.json).

## Delivered

The actual final-review constructor now owns one lazy, read-only validation phase
across dependent preview work. Sequential reads share its immutable initial review
and recheck caller/review policy; they no longer reconstruct full draft/source/
scope state every time. Complete final state comparison and an additional final
draft read remain, followed by the existing source-owner closure. Public review
still performs two full states and three draft reads. No effect is moved inside
the phase, and confirmation still opens separate previews around its effects.

The owner pins dependency objects/methods and retains actual held work on private
cancellation, including forgotten caller callbacks. Late changes, authority loss,
skipped/parallel/escaped/caught-failed reads reject without releasing a preview.
There is no new public capability, permission cache, live switch or deadline.

## Measured effect

| Synthetic authenticated action | 0311 attempts | 0312 attempts |
| --- | ---: | ---: |
| New-distinct preview | 485 | 343 |
| New-distinct confirmation / recovery / repeat | 1,163 / 1,135 / 1,133 | 879 / 851 / 849 |
| Proposal-continuation preview | 775 | 633 |
| Proposal-continuation confirmation / recovery / repeat | 1,743 / 1,715 / 1,713 | 1,459 / 1,431 / 1,429 |

This removes 142 requests per preview and 284 per confirmation: about 29% and 24%
for new-distinct. All four first actions still exceed 200. Save review alone stays
224; scope preparation/start and drafting preparation/start remain over budget.
New-distinct preview still has 321 identity-head calls. The continuation destination
adds 290 requests relative to new-distinct. Remaining source/draft/destination
phases and effect-separated preparation/start controls must also be corrected.

These are counted synthetic application actions, including identity/token calls.
Undelayed durations shared the host with other checks and are not p95 or actual
UI latency. The unchanged complete C22 protocol has not passed.

## Verification and boundaries

- 1,510/1,510 final broad package/application regression tests pass, including
  architectural boundaries. No functional check failed. The staged whitespace
  check found one extra end-of-file blank line in the Brief; it was removed.
- 36/36 final focused review/preview/private-session/architectural checks pass.
  Six new tests cover shared/lazy validation, late state and port changes, final
  draft readback, fresh authority, misuse, dependent work and forgotten-call drain.
- Final prototype and all eight package/application type checks pass. The kit
  validates 95 required artifacts; workflow tokens remain contents read-only.
- Native default: three joined checks plus idempotent migrations pass. Native
  proposal continuation: one joined check plus migrations passes. Both use actual
  constructors, HTTP, native Git/PostgreSQL, recorded SDK and Temporal flows:
  exact corrected documents, one save, lost responses, restart/recovery, exact
  reopen and current-permission denials. Identity/authority/model inputs remain
  synthetic. These are focused selections, not the full PostgreSQL suite or UI.
- Each harness removed only its own synthetic PostgreSQL container/tmpfs data.
  No user records or actual runtime repository artifacts were deleted.

Final broad-regression results are recorded in the verification file. No live
model, provider access, spending, runtime GitHub save, records/profile activation,
deployment or gate signature occurred. The signed architecture, Exam and retention
policy and protected 0289 performance evidence retain their previous hashes.
User-owned roadmap/outputs remain untouched. Later passing recovery samples do
not resolve the historical 0289 uncertain-recovery observation.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
Next address remaining source/draft/destination validation and preparation/start
effect controls, then the full C22 protocol. Real-model quality, governed records
activation, actual GitHub save/reopen and signed-in human acceptance remain pending.
