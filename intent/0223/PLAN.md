# Plan

1. Verify official response/usage/refusal semantics and installed SDK serialization.
2. Implement pinned exact-request transport recording and successful-response
   parsing, with mandatory acknowledgement/authority hooks and no retries.
3. Bind the adapter to actual original/operation/observation services. Distinguish
   new request insertion from idempotent recovery, and recheck source after waits.
4. Exercise both actual SDK roles over synthetic transport, encrypted SQL recovery,
   lost acknowledgements, duplicate attempts, late authority loss and source changes.
5. Verify regressions, update delivery evidence, commit and verify the pushed head.

Next: reference-only durable Temporal development activities/workflow and actual
editor/API acknowledgement/recovery. Keep live profile/pricing validation, bounded
spending approval, D1 adoption and runtime save authority separate. No new stack,
alternate preview or request for another generic continue is needed.
