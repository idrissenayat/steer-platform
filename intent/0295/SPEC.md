# Specification

1. Register the actual constructed development-original store privately. No new
   public method, HTTP input or package export may manufacture a read-window proof.
   Each live token is scoped to the store's exact records configuration and one
   target. Copies, foreign configurations, expired tokens and unknown stores deny.
2. Perform a full authorized historical original/source read at first use.
   Capture immutable encrypted-row identity and private fingerprints of every
   original/draft key observed by that store. Never retain or serialize key bytes
   through the read set; ordinary key handling keeps its existing behavior.
3. Intermediate reads inspect current historical/draft grants, lifecycle, hold,
   expiry, original-row identity and exact source/latest revision. Recheck every
   captured key, then all retained source/lineage authority before reuse. Perform
   final metadata readback after those callbacks. No cached permission is used.
4. The enclosing computation is read-only and cannot publish intermediate values.
   A final FULL original/source read must agree before its result escapes. Allow
   only monotonic execution-expiry transition; changed original/source/latest
   revision, key, scope or authority rejects. The existing outer scope-history
   window still performs its final full source/SDK/record verification.
5. Share this read set between the history projection and its observation readers.
   Ordinary observation reads/writes retain their original store path. Unknown
   tokens do not fall back to unverified or cached data.
6. Exclude overlapping/ordinary access or writes on the window's original-store
   instance. Pin dependency/method identities, poison swallowed failures, reject
   unawaited/parallel reads, and retain actual pending-work admission until drain.
   Owner closure, nonvoid current checks and cancellation suppress late values.
   A failed or abandoned window closes its original store before waiting for
   late dependencies. Successful owners stay alive for the outer scope window's
   final permission callbacks, then close with the enclosing history owner.
7. Verify focused boundaries, native encrypted SQL history and late source/key/
   result revocation, holds and correction. Measure the actual authenticated
   synthetic joined save/recovery/reopen, and run broad tests, types and build.
   Preserve the 200-request benchmark and report incomplete C22 honestly.

Source-code delivery is separate from application runtime saving. No real provider
access, publication, records migration or human gate is inferred from these tests.
