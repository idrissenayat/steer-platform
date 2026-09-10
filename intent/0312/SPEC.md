# 0312 — Owned final-review contract

1. Reuse the existing private registered review-session boundary. No new public
   tool, configuration switch, package export or untrusted capability is added.
   Ordinary public review still reads two complete states and one final draft.
2. The private phase performs its initial full review only on first consumption,
   after the preview has authorized itself and validated its draft. Sequential
   reads share that immutable result, but freshly check caller and review policy.
   This is neither a grant cache nor reuse across requests, revisions or effects.
3. After dependent preview work finishes, re-read and compare the complete draft,
   current source review and recorded scope binding. Then independently re-read
   the draft to catch changes during source/scope validation. The enclosing source
   owner still performs final source closure and its own final draft validation.
4. Pin the exact draft/source/scope objects and methods and review-policy callback
   for the invocation. Changes deny rather than selecting an alternate path.
   Preserve existing scope, digest, source fidelity, human direction and Exam
   bindings, timeout, concurrency and sanitized public-error contracts.
5. Skipped, overlapping, escaped and caught-failed consumptions cannot validate a
   phase. Own the full consumption, including caller callbacks and dependent work.
   Private cancellation drains actual pending tasks before its owner finishes;
   public review still rejects promptly while retaining pending admission.
6. Confirmation retains separate read-only preview phases around its existing
   effects. No original allocation, model dispatch, consent, save or signature is
   added to a review phase.

## Verification

- Focused tests: lazy shared initial review; full final equality; final draft
  readback; caller/key loss; changed source/scope/draft; replaced ports; standalone
  HTTP/MCP compatibility; escaped/skipped/parallel/caught-failed reads; held and
  forgotten caller-work drain after cancellation; architectural boundaries.
- Actual constructor/HTTP, disposable native Git/PostgreSQL, recorded SDK and
  Temporal default and proposal-continuation save/recovery/reopen selections.
  Source and authority/model inputs are synthetic, not actual provider approval.
- Types and broad package/application regression once against final code. Keep
  measured samples and failed iterations in the verification record.

C22 remains the unchanged whole-action protocol: at most 200 provider attempts,
20 ms per attempt, five-second p95, 20 warm / three cold / four concurrent samples
in both directions plus negatives. Undelayed functional samples are not latency
acceptance. Extra tests and request reductions do not earn checklist points.
