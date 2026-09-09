# Development evidence — 2026-09-08

Base: `e7cb521b906d4f096edf13e49d44d94686e39ad8`.

## Capability

Private retained-role exchange verification now reconstructs exact original
inputs and completed result/predecessor bindings after edits or expiry. A pinned
SDK verifier checks wire/profile/model/output/usage under present historical
authority. Existing expired-only and current execution ports remain distinct.
See [the guide](../../docs/GENERATION-OUTPUT-HISTORY.md).

## Integration finding and correction

The new 34-source/two-batch assessed generation test initially returned
attention-required for the Architect. A metadata-only trace recorded one synthetic
provider call, retained request and response rows, and an execute failure after
10,470 ms (14,583 ms for the role run), followed by outcome-unknown. No success or
retry authority was claimed.

Response validation recursively restored the request and rebuilt the full
assessed source graph repeatedly within the acknowledgement. The new
`verifyStoredRequest` validates it against the response's current context while
retaining request permission, ciphertext, key and lifecycle checks; the caller
revalidates context before write/release. No deadline was increased. The composed
test subsequently passed both SDK roles and exact historical recovery after edits.

The first full SQL run stopped at the existing parallel scope-checkpoint assertion
with outcomes `[unknown, ok, ok]`. That run had no per-attempt SQL trace, so its
exact database error is not claimed retrospectively. Review found that the test
required every acknowledgement to succeed despite the existing lifecycle
`FOR SHARE NOWAIT` guard. The regression now accepts an uncertain attempt only
with one traced PostgreSQL `55P03` lock refusal, then requires one exact retained
checkpoint recheck to converge after all concurrent attempts drain. A separately
forced lifecycle-lock case verifies that refusal and recovery with one model call
and one reservation. Other failures still fail the test. No scope runtime,
migration, timeout, retry authority or database guard was changed.

## Verification

- Final regression checks: **1,174/1,174 passed** after the acknowledgement fix.
- Focused retained history: **six SQL/SDK checks plus idempotent migration passed**.
- Full disposable PostgreSQL **16.14: 348/348 checks passed**, including the
  strengthened contention/recovery assertions. An earlier complete 348-check run
  also passed before that final test-only hardening; neither focused evidence nor
  that earlier run replaces the final full-suite result.
- All package and prototype typechecks passed; the data package was rechecked
  after the final integration-test edits.
- Optimized Next.js **16.3.4 build passed**.
- Kit validation: **95 required artifacts**; workflow token-scope audit passed.
- **214 local links across 12 documents** resolve; `git diff --check` passed.
- Protected Architecture, canonical Exam and HR-01-R2 policy hashes are unchanged.

The three protected SHA-256 values, respectively, remain
`9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
`84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`, and
`f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Authority boundary

All SQL/SDK authority and model responses are synthetic. The factory remains
uninstalled and raw historical exchanges remain server-only. No records adoption,
live migration, real credential inspection, paid model call, runtime Git write,
gate, auth bypass, deployment or release. No UI, dependency or migration is changed.
The credential skill preserved the resolved decision without another prompt or
key access. The one-minute loop remains active and unchanged.
