# Specification

1. Add `readExchange` to the development observation store. Require the exact
   operation/input/role target and both immutable stages. Their common metadata
   must agree on tenant, subject, product, records configuration, source revision,
   owner, fence, reservation and step input. Response links the stored request digest.
2. Check current records authority and lifecycle before stage-key recovery. Restore
   the retained original and current execution context, including verified completed
   results and the Architect predecessor for Test Agent. Reconstruct the exact role
   request. No state outside dispatch-committed/succeeded is accepted on this path.
3. Authenticate each encrypted stage with its full metadata and historical key.
   Keep the existing 786,432-byte serialized payload limit. Verify each payload's
   metadata digest, request packet, response role and internally consistent usage.
   Recheck both historical keys. Zero only owned key copies, never caller buffers.
4. Before return, reauthorize, restore current source/execution context again,
   compare completed result binding when present, and re-read lifecycle and both
   stored rows. Expiry, hold, tampering, revocation, changed ownership or shutdown
   withhold plaintext. No successful result is cached across calls.
5. The recorded model verifier consumes the pair, compares step/output/records
   digests, then still runs the pinned SDK's exact wire/result verifier and its final
   model-authorization check. A storage pair alone is not provider authorship,
   semantic accuracy, a checkpoint or dispatch authority. All returned execution,
   retry and gate flags are false. Keep existing timeout and no-retry controls.
6. Diagnostic selection is explicit CLI only: no arguments runs the full suite;
   `--clarification-repro N` repeats only the existing clarification case, N=1..20.
   Optional `--query-delay-ms D` injects D=0..5 milliseconds before SQL queries in
   this test path only. Reject invalid/unknown arguments before starting Docker.
   Clearly label focused runs and require exactly one matching test definition.
7. Reuse actual disposable PostgreSQL and Temporal, synthetic SDK responses and
   existing test assertions. Each repetition has fresh fixture records and a worker;
   release only its owned pools. Diagnostics retain aggregate counts, fixed phase
   names, bounded durations and allowlisted SQL error codes, with at most 32 events.
   Never retain SQL, values, source, IDs, credentials or exception text in the trace.
   Pool-direct/admin queries are not instrumented; counts are not total server work.
8. No real configuration or persistence activation. D1, approved model spending,
   source/lifecycle authority, actual save/reopen and human acceptance remain open.
