# 0313 — Destination membership integration evidence

Date: 2026-09-10. Base: `88d4cc6ac2f12102ba4c6c8cbae99b65cd598a45`.
Contract: [Spec](SPEC.md). Exact checks, samples and hashes: [verification](VERIFICATION.json).

## Delivered

The actual existing-item and new-linked destination readers retain the exact native
inventory proof for each current/historical revision. Artifact reads reuse verified
membership instead of retrieving commit and tree again per file. Unknown adapters
keep the ordinary independent membership path; malformed proofs cannot select a
fallback. No document body or permission is reused across resolve invocations.

The existing private read-authorizer bracket now lets the nested bundle reader
recognize the exact caller policy already executed around each body read. Per-file
source permissions, root/mode/commit selection, size/UTF-8/hash checks, pointer,
manifest, all three documents and root Brief mirror remain. Metadata-only surface
and final grant groups preserve every independent source query, with current
caller checks before and after; no body IO or effect happens inside these groups.

Original-target surface equality, proposal parent, lifecycle eligibility, fresh
final source/head checks and earliest proof expiry remain. Read/policy ports are
pinned per resolve. Late replacement rejects. Actual nested bundle callbacks retain
parent admission until settlement, including after public cancellation.

## Measured effect

| Synthetic authenticated action | 0312 attempts | 0313 attempts |
| --- | ---: | ---: |
| New-distinct preview | 343 | 343 |
| New-distinct confirmation / recovery / repeat | 879 / 851 / 849 | 879 / 851 / 849 |
| Proposal-continuation preview | 633 | 453 |
| Proposal-continuation confirmation / recovery / repeat | 1,459 / 1,431 / 1,429 | 1,099 / 1,071 / 1,069 |

Continuation loses 180 requests per preview (28.44%) and 360 per confirmation
(24.67% for the first confirmation). Its preview commit/tree requests each fall
from 20 to six; blob requests stay 20. Identity-head requests fall 565→413. Exact
native destination tests require one inventory per revision, equal output and
source-policy sequence, equal body-read counts and two independent lifecycle
proofs on both native and compatibility paths. New-distinct is unchanged.

Counts include identity and token attempts. Undelayed synthetic functional samples
are not p95, the complete C22 protocol or signed-in UI measurements. All four first
actions still exceed 200. Scope/drafting preparation/start also remain over budget.

## Verification

- 1,516/1,516 final broad package/application regression tests pass, including
  all six new destination checks and architectural boundaries. No check failed.
- 87 focused destination/bundle/membership/private-authority/architectural tests
  pass, followed by the additional held-nested-read test (one pass). The latter
  verifies four-call admission, prompt close and no advance to later documents.
- Final prototype and all eight package/application type checks pass. The kit
  validates 95 required artifacts; the workflow scope audit remains contents read-only.
- Native default: three joined checks plus idempotent migrations pass. Native
  continuation: one joined check plus migrations passes. Both run the final
  production source with real HTTP/native Git/PostgreSQL, recorded SDK and Temporal
  composition: exact edited documents, one save, lost responses, restart/recovery,
  exact reopen and current-permission denial. Authority/model inputs are synthetic.
  The native harness source is unchanged; focused tests were added while they ran.
- Final broad-regression results are recorded in the verification file. These
  focused native selections are not the entire PostgreSQL suite or a browser test.
  Each harness removed only its own synthetic container and tmpfs data.

No live model usage/spend, runtime GitHub save, profile/records activation,
deployment or signature occurred. Protected architecture, Exam, retention policy
and 0289 performance evidence retain their hashes. User-owned roadmap and outputs
are untouched. Later successful recovery does not resolve the historical 0289
uncertain-recovery observation.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
Next integrate repeated current-source/draft validation and effect-separated
preparation/start controls, then run the full unchanged performance protocol.
Live model quality, governed activation and actual signed-in UI/save acceptance
remain separate pending checkpoints; no new ETA is claimed.
