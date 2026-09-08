# Specification

1. Add pure workflow contracts for an exact organization/review/preparation
   reference, a batch reference, a plan result and batch outcome. Reuse existing
   bounded identifier rules; accept no caller list, text, model configuration,
   credential, grant, budget or extra field. Validate at both workflow and activity
   edges. Plan lists have 1–8 unique digest IDs only when ready; non-ready plans
   contain no batch references. All authority/quality flags remain false.
2. Extend the actual scope runner with a frozen metadata binding and `plan(signal)`.
   The plan reads the retained encrypted original and its verified admitted manifest
   under current observe/records/source/key authority. It returns exact batch IDs,
   or explicit superseded, expired, unavailable/attention or busy status. It performs
   no SQL mutation, reservation, gateway validation or model call. A current identity
   check precedes and follows the read; expiry is checked again before release.
3. Plan and batch execution share one active/draining slot and the existing tracking
   of actual underlying dependencies. Bound planning to at most 30 seconds and
   ordinary dependencies to five seconds; preserve the existing 1–90-second batch
   and child-store limits. Cancellation cannot free a slot while late work continues.
   The existing verified dispatch/checkpoint/body-cleanup controls remain unchanged.
4. Bind dedicated activities to the actual runner's exact frozen identity. Reject a
   mismatched runtime or foreign reference before any records/model call. Both plan
   and batch methods validate outputs before history release, redact failures, own
   cancellation and close, and keep local admission while the runtime drains. A
   100-second activity wrapper deadline closes the runtime; no late success escapes.
5. Add `reviewIntentScope` and a metadata-only `scopeProgress` query. Check the exact
   deterministic workflow ID, read the plan once, then execute at most eight batches
   sequentially. Stop at the first superseded, busy or attention-required outcome;
   a non-ready plan schedules no batch. Treat cancellation as cancellation, not a
   completed review. Unexpected failures are sanitized and non-retryable.
6. Use a dedicated worker queue, one concurrent activity, payload-free one-second
   heartbeats, a ten-second heartbeat timeout, two-minute start-to-close and
   three-minute schedule-to-close limits. Activity maximum attempts is one and
   cancellation waits for activity acknowledgement. Shutdown retains the existing
   ten-second grace/thirty-second force bounds. Do not register in a default worker.
7. Provide only a trusted internal starter, with a thirty-minute execution bound,
   conflict FAIL and duplicate-reuse rejection. The workflow ID depends on
   organization/review, not preparation digest, so changed input cannot create a
   second execution identity. No workflow retry policy, public endpoint, implicit
   recovered-start receipt or grant is introduced. Authorized start acknowledgement
   and namespace-retention/lost-response recovery remain subsequent API work.
8. Workflow output contains references, planned/completed counts and the last
   validated checkpoint. `attempt-complete` means the attempt finished, not full
   source coverage or semantic correctness. SQL remains truth; the current-authority
   combined reader determines findings/coverage and supersession. A recorded
   checkpoint can be reused without a new reservation/call, but sent/uncertain work
   cannot automatically retry or advance to the next batch.
9. Test actual isolated Temporal, encrypted SQL and the pinned recorded SDK with
   synthetic identity/source/records/budget/model inputs. Verify exact manifest
   planning, sequential execution, replay, duplicate rejection, existing-checkpoint
   reuse, corrections, uncertain responses, holds, expiry, foreign bindings and
   cancellation before/after dispatch. Inspect actual history for absence of source,
   Exam, findings, prompt, credential and private-error markers.
10. Keep all live bindings inactive. Do not alter signed artifacts, source grants,
    records policy, real databases, credentials, model spending, runtime Git saving,
    gates, deployment or release. No alternate UI. Continue preparation/start APIs,
    actual editor integration, real authority and semantic/human acceptance.
