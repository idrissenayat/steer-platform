# 0314 — Owned source-review phase contract

1. Use the existing adapter-owned evidence window and private registered review
   session. First consumption lazily validates the exact current draft and evidence,
   source scope/provenance and batch plan. Sequential consumers share only the
   immutable review state in that invocation, never a principal or grant.
2. Every consumption freshly validates its caller and source-review policy.
   Its independent caller callback remains active throughout source/draft IO,
   alongside the outer caller, so revocation cannot be checked only after reading.
3. After dependent read-only work, re-read and compare the full draft and evidence.
   The evidence owner then performs final corpus validation. Independently re-open
   and compare the exact draft afterward, followed by current caller validation.
   Current source completeness/uncertainty and all false authority flags remain.
4. Pin dependency objects/methods/window and fixed input scope for the phase.
   Reject skipped, overlapping, escaped, replayed, early-returned, caught-failed and
   malformed windows/consumptions. Changes during final source closure also deny.
5. The entire private phase owns one of four admissions until actual child/window
   work drains. Its 30-second validity boundary never extends the public service
   limit. Private cancellation may await actual drain; parent public cancellation
   remains bounded. No dangling callback may authorize later IO or return content.
6. Extract shared verification helpers so public and private source reviews use
   the same scope, evidence, batch-plan and output contract. Public review keeps
   its two complete reads. Without the trusted evidence window, preserve ordinary
   independent review calls. Do not share a phase across effects or requests.

## Verification

- Public output/read-count compatibility, lazy private entry, reduced full reads,
  fresh per-consumption policy and complete final state/draft validation.
- Independent child-caller revocation during IO, late draft/evidence/key/hold/
  policy/method changes, malformed windows, skipped/parallel/forgotten reads and
  actual drain after closure; preserve incomplete-source warnings.
- Actual authenticated synthetic native Git/PostgreSQL, recorded SDK and Temporal
  new-distinct and proposal-continuation save/recovery/reopen selections; focused
  review/preview/boundary and broad regression plus types.
- All provider attempts count. C22 remains open until the unchanged whole-action
  200-attempt, 20 ms, five-second-p95 warm/cold/concurrent protocol passes. No live
  model, runtime GitHub save, records adoption, signature or deployment is enabled.
