# 0311 — Shared preview generation phase evidence

Date: 2026-09-10. Base: `832ef8d110810ca29efacddf1ca8383bf39f2937`.
Contract: [Spec](SPEC.md). Exact checks, samples, source hashes and limitations:
[verification](VERIFICATION.json).

## Delivered

The actual candidate-preview constructor now uses one private owned original/
history computation through its dependent read-only work. The actual factory
binds it to the owned history method and exact records configuration. No recursive
original store or separate public history reconstruction is opened on that path.
Invalid/replaced private bindings reject rather than selecting compatibility.

The immutable private pair preserves the original source, both drafting roles,
profiles, exact outputs and predecessor lineage. Every consumption rechecks the
caller and independent source policies. After the preview's dependent reads,
BOTH actual records/key leases and final source policies are rechecked. The
surrounding corpus session still performs its final source closure. Separate
confirmation phases remain separate across admission/persistence effects.

Escaped, parallel, skipped and caught-failed reads reject. Forgotten pending
reads are drained before the private phase completes. Public history retains
prompt cancellation while shutdown waits for actual work. No public tool, raw
original response, permission cache, new deadline or execution authority is added.

## Measured effect

| Synthetic authenticated action | 0310 attempts | 0311 attempts |
| --- | ---: | ---: |
| New-distinct preview | 509 | 485 |
| New-distinct confirmation / recovery / repeat | 1,211 / 1,183 / 1,181 | 1,163 / 1,135 / 1,133 |
| Proposal-continuation preview | 799 | 775 |
| Proposal-continuation confirmation / recovery / repeat | 1,791 / 1,763 / 1,761 | 1,743 / 1,715 / 1,713 |

The decrease is modest: 24 requests per preview and 48 per first confirmation.
This phase removes duplicate generation reconstruction but does not solve C22.
The new-distinct preview still includes 463 identity-head attempts. Current save
review remains 224 attempts by itself. The next integration must address repeated
current-draft/source/scope review and destination/preparation controls, rather than
assuming more original-only optimization will meet the whole-action budget.

All counts include identity and token attempts. Undelayed functional samples
shared the host with other verification; no p95 or user-interface latency result
is claimed. The 200-attempt, 20 ms-per-attempt, five-second-p95, full warm/cold/
concurrent protocol is unchanged and remains unpassed.

## Verification

- **1,504/1,504** broad regression tests pass on final production source, including
  the two new explicit/private preview binding and lazy no-fallback checks.
- **59/59** focused preview/history/records/factory/boundary checks pass. All
  prototype and eight package/application type checks pass.
- **88/88** prototype tests in 17 files pass; the kit validates 95 required
  artifacts and the workflow token audit passes with contents read-only.
- Native default journey: **three joined checks plus migrations** pass with the
  actual shared preview path, exact corrected confirmation, one synthetic native
  save, fixed Temporal execution, lost response/restart recovery and exact reopen.
- Native proposal-continuation: **one joined check plus migrations** passes with
  the same save/reopen guarantees and the added private-phase matrix: exact shared
  pair, one initial and one final key lookup per provider, eleven late/misuse
  variants, escaped-read rejection and forgotten-read drain. Earlier independent
  history policy/profile/nested-key checks remain passing.
- Native retained-development records: **nine checks plus migrations** pass,
  including owned/established unbound pending, partial, complete, clarifying,
  uncertain, superseded and expired history equality.

Default native verification ran before the additional private-phase test matrix
was added; its production code was already final. The final continuation run
includes that matrix. These are focused native selections, not the entire
PostgreSQL integration suite or signed-in browser acceptance. Each harness removed
only its own synthetic PostgreSQL container/tmpfs data. No failed verification
iteration occurred in this increment; earlier 0310 failures remain documented.

## Remaining boundary

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
Next integrate the surrounding review/preparation/destination read phases and
effect controls, then run the full C22 protocol. Real records adoption, authorized
model quality, actual runtime GitHub save/reopen and signed-in human UI/failure/
accessibility acceptance remain separate pending checkpoints.

No real model calls, model spending, live runtime GitHub saves, profile activation,
records adoption, deployment, deletion or gate signature occurred. The protected
architecture, Exam, retention policy and 0289 evidence remain unchanged. Later
passing recovery samples do not establish the root cause of the protected 0289
uncertain-recovery observation. User-owned roadmap and outputs are preserved.
