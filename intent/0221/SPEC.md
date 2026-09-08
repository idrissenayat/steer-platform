# Spec

- Construct one private runner for an exact operation ID/input digest and current
  records configuration. Expose only `run(role, signal)` and `close()`. Callers
  cannot supply prompt text, step owners, budget IDs or replacement configuration.
- Recover original execution configuration through the encrypted original reader.
  Require current observation authority and an unexpired operation. A completed
  step restores its actual result and re-verifies model observations; it makes no
  new reservation or provider call.
- For an absent/claimed step, use the current exact role-request reader; obtain
  current dispatch authority; atomically claim with the existing unique cost
  reservation. Re-read the request, confirm exact equality and authorize again.
- Only an unambiguously acknowledged `commit-dispatch` grants this runner the
  opportunity to invoke the model port. Recheck current authority, source revision,
  operation expiry, actual sent state, internal owner, fence and reservation
  immediately before invoking it. No SQL transaction spans the model call.
- Require a recorded-model port with both `execute` and `verify`. Execution must
  persist actual adapter request, response and usage before returning. Verification
  must independently read durable observations and check operation, role, exact
  step-input digest, output digest and records policy. Neither implementation is
  supplied or installed in this increment; an in-memory test map is not provenance.
- Validate strict role output, verify observations, capture the immutable encrypted
  result, and advance only through actual readback-verified SQL checkpointing.
  Test Agent uses the verified, non-clarifying Architect checkpoint. It receives
  neither the old Exam nor Architect commentary fields through request preparation.
- Clarifying Architect output stops downstream drafting. Later human edits remain
  untouched; an older generated result is retained under its original revision and
  reported `superseded`, never published over the new source.
- Timeout, cancellation, close, malformed output, unverifiable observations or
  lost dispatch acknowledgement cannot trigger another automatic provider call.
  Attempt metadata-only quarantine after attempted dispatch. If authority/expiry
  prevents that write, sent state remains non-dispatchable. Never refund uncertainty
  or replace a succeeded checkpoint with a failure.
- Admission stays closed while timed-out callbacks drain. Cancellation is not a
  claim that the provider stopped or its billable effects were rolled back. Late
  successful model returns after timeout/cancellation cannot be newly captured by
  the stopped run. Lost checkpoint acknowledgement may recover existing success.
- Outcomes contain operation/result references and bounded states, not private
  text or raw dependency errors. Execution, retry and gate authority remain false.
  The caller owns shared pools; closing the runner does not claim to close them.

Production bindings must enforce current identity, original source/evidence,
profile/renderer/model policy, reservation cost bounds, records and spending
authority. Abstract callbacks and passing synthetic tests do not supply these.
No provider-specific idempotency or exactly-once external-effect guarantee is made.
