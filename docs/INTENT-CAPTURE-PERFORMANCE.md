# Intent capture performance acceptance

Engineering benchmark version 1, established in [0284](../intent/0284/SPEC.md).
These are implementation-plan targets, not measured results, a signed architecture
amendment, a spending authorization or a production SLA. C22 in the
[fixed tracker](INTENT-CAPTURE-PROGRESS.md) remains pending until the measurements
below pass. Actual browser usability and live-provider acceptance remain C23–C25
and C21 respectively; this benchmark cannot substitute for them.

## Representative interactive budget

Use the existing authenticated 34-source journey, both new-distinct and proposal
continuation, with native Git, encrypted disposable PostgreSQL, fixed Temporal
workflows and synthetic model replies. Preserve both separate drafting roles,
human correction, exact confirmation, one save and exact reopen. No service-result
stubs may replace the actual service composition.

For source review, scope preparation, drafting admission/start acknowledgement,
save review, preview and confirmation, target **at most five seconds p95** from
authenticated request receipt to response under **20 ms added delay per provider
attempt**, counting identity and repository traffic together. Waiting for an
asynchronous model to finish is separate from its admission/start acknowledgement;
the response must not falsely claim generated documents or a save are complete.

Set a **200 provider-attempt ceiling per interactive request** for this fixed
34-source benchmark. This allocates four seconds of the five-second target to
200 sequential 20 ms round trips, leaving one second for local work. It is a
conservative request-load budget even where safe bounded concurrency reduces
wall-clock time. It is not a universal limit for arbitrary repository sizes.
Include fresh head checks, grant-document reads, token acquisition and retries;
do not exclude expensive identity traffic or weaken checks to meet the number.

## Required measurement protocol

1. Report all per-action counts, identity/repository partitions and latency samples.
   Inject delay only in disposable fixture transports. Never slow or load the
   user's real issuer, repository or model provider for this benchmark.
2. Run at least 20 sequential warmed measurements per action/direction, plus three
   cold/reconstructed-runtime measurements. Calculate p95 by nearest rank, keep
   every sample and report the maximum. All warmed samples must meet the request
   ceiling; p95 and each cold run must meet the five-second limit. A failed or
   timed-out sample is a failure, not an omitted outlier.
3. Repeat with four overlapping admitted calls and report aggregate load and
   per-call latency. Each call must remain within the same bounds; admission
   above the existing four-call limit must fail promptly without duplicate effects.
   Preserve owner admission while timed-out dependencies drain.
4. Exercise source/records/key/hold/identity revocation, changed heads, stale edits,
   owner shutdown and lost responses around the optimized boundaries. Unsafe
   cases must deny or report uncertainty without stale data, a duplicate dispatch,
   a second original, an extra reservation or another save. A fast unsafe response
   is never a performance pass.
5. Record fixture size, exact source commit, software versions, hardware/load,
   delay injection, concurrent work and cold/warm distinction. Compare like-for-like
   request counts separately from variable single-run local timings. Keep a
   larger-corpus scaling diagnostic separate; do not present this fixed-fixture
   result as proof of unlimited scale.

## Current gap and next work

0283's new-distinct confirmation used 60,372 attempts and 37.6 seconds without
injected network delay. The history-barrier optimization in 0284 is a partial
reduction only. The repeatable delay-bearing/concurrency benchmark is not yet
implemented or passed. Next reduce duplicate authority traversal at explicit
read/policy boundaries, preserve fresh revocation checks, then implement this
measurement protocol. No permission cache, longer deadline, hidden background
write or substituted preview is an acceptable shortcut.
