# 0314 — Owned current-source review evidence

Date: 2026-09-10. Base: `14ab0550454601665fa0ae7ba033f8b5f4b68264`.
Contract: [Spec](SPEC.md). Exact checks and samples: [verification](VERIFICATION.json).

## Delivered

The existing private evidence phase now owns one lazy initial draft/source review,
shared only across its sequential read-only consumers. Every consumer freshly
checks caller and source policy. Its independent caller remains active during
draft/source IO alongside the outer caller; permissions are not cached.

After dependent work, the complete draft/evidence/output state is reconstructed
and compared. Final corpus validation is followed by a full exact draft reread
and current caller check. Consumption closes before final validation. Changed
content with unchanged metadata also denies. Public independent review preserves
its two complete reads; compositions without the trusted window keep ordinary calls.

Dependency methods and scope are pinned. Skipped, overlapping, escaped, early,
replayed, nonvoid and caught-failed work denies. The private phase owns one of four
admissions until all actual child/window work drains. The existing 30-second
validity limit and bounded parent public cancellation remain. Nothing is shared
across effects, requests or public transports.

## Measured effect

| Synthetic authenticated action | 0313 attempts | 0314 attempts |
| --- | ---: | ---: |
| Save review, either direction | 224 | 211 |
| New-distinct preview | 343 | 330 |
| New-distinct confirmation / recovery / repeat | 879 / 851 / 849 | 853 / 825 / 823 |
| Proposal-continuation preview | 453 | 440 |
| Proposal-continuation confirmation / recovery / repeat | 1,099 / 1,071 / 1,069 | 1,073 / 1,045 / 1,043 |

Each preview saves 13 attempts and each confirmation saves 26. This is a small
improvement, not a resolution of the action-level bottleneck. Identity-head calls
still account for 308 of 330 new-distinct preview attempts and 400 of 440
continuation attempts. Scope/drafting preparation and start remain unchanged and
above budget. Counts include identity and token attempts, not only artifact reads.

Functional samples were undelayed and shared the host with regression tests. They
are not the full C22 warm/cold/concurrent protocol, p95 or actual user-UI latency.
Every action must still satisfy the unchanged 200-attempt ceiling and latency
protocol. No checkpoint is earned by this isolated reduction.

## Verification and iterations

- Final focused review/preview/private-session/package-boundary run: 50/50 pass.
  Tests cover lazy sharing, fresh policy on each use, independent caller revocation
  during IO, changed final state/content/key/hold, malformed/escaped/parallel reads
  and actual drainage after close or forgotten consumption.
- Final broad package/application and boundary regression: 1,520/1,520 pass.
- Prototype and all eight package/application type checks, required-artifact kit
  and workflow token-scope audit pass; exact commands are in the verification file.
- Native new-distinct selection: three joined checks plus idempotent migration
  check pass. Native continuation: one joined check plus migration check pass.
  Both exercise actual HTTP/native Git/PostgreSQL, recorded SDK and Temporal
  composition: edited documents, fixed one-time save, lost reply/acknowledgement,
  restart, receipt recovery, exact older-commit reopen and current-policy denial.
  Provider authority/model inputs are synthetic. The native fixture source is
  unchanged; final test-only negative variants were added while native runs ran.
  These selections are not the entire SQL suite or browser verification. Each
  harness removed only its own disposable container and tmpfs fixture data.
- The first focused run had 33 passes and one obsolete read-count assertion
  failure: two phases now produce six draft reads, four evidence reads and six
  authorizations, instead of ten/eight/eight. The assertion was updated to the
  specified phase contract with lazy-read, per-use policy and full-final-state
  checks. An intermediate expanded run passed 50/50; the final run includes the
  additional late-content and policy-only variants. During inspection, consumption
  closure was moved before final validation and covered by an escaped-read test.

No live model/spend, runtime GitHub save, records/profile activation, deployment,
release or signature occurred. Protected architecture, Exam, retention policy and
0289 performance evidence retain their exact hashes. User roadmap and outputs
remain untouched. Passing recovery samples do not establish the cause of the
historical 0289 uncertain-recovery observation.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
Next consolidate action-level current-draft/authority and preparation/start read
composition, preserving independent policies, final readback and separate phases
across effects. Then run the complete unchanged benchmark. Real model quality,
governed activation and actual signed-in UI/save acceptance remain separate.
