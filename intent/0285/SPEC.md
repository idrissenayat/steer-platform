# Intent 0285 specification

1. Add an explicit test-only selection, never environment activation or a public
   runtime flag. Use the same actual identity/factory/34-source native Git and
   disposable PostgreSQL setup for both new-distinct and proposal continuation.
2. Add a request-local fixture transport probe with 20 ms delay and 200-attempt
   ceiling across identity and repository traffic. Report sanitized counts and
   latency only, separate overlapping request counters, honor cancellation and
   prevent dispatch from closed/unawaited contexts. Fixture setup is excluded
   explicitly, never hidden inside the measured interval.
3. Measure twenty warmed draft reads, three reconstructed-runtime reads and four
   concurrent reads. Report raw metadata, nearest-rank p95 and maximum. Never
   calculate a successful percentile for failed, incomplete, undrained or differently
   configured groups. Preserve exact source bytes and current authorization.
4. Probe source review next and stop at the first failing boundary. A denied
   401/503 caused by the measured request ceiling must report benchmark failure,
   not fake novelty or successful generation. If the prefix passes in future,
   still report prefix-only coverage until later stages are implemented. No
   full C22 or live-provider/UI acceptance follows from this prefix.
5. Assert unchanged records/reservations, zero model calls and zero provider saves.
   Keep earlier full joined/save/recovery tests and normal transports unchanged.
   Test probe bounds, isolation, cancellation, sanitized reporting and percentile
   failure handling; run the new SQL selection and relevant regression, types,
   build, links, kit/audit and protected hashes with accurate evidence timing.
6. No paid calls, real issuer/repository load, credentials, live migration,
   records/D1 adoption, runtime grants/writes, gate or deployment/release. Progress
   stays 68% (17/25; +0 points) unless an entire pending checkpoint passes.
