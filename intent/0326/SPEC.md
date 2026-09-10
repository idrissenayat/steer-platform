# 0326 — Dual-purpose original preservation and verified readback

Base: `1e8a38d5b5ca53a38c00242e3c9980a96e1fc587`.

1. Add server-only `putAndRead` to the existing scope-review and development
   original stores. Share persistence and full recovery with legacy `put`; the
   latter retains its exact acknowledgement-only result and put-only purposes.
2. Joined recovery must separately authorize both put and current-read target
   grants before decryption, and both original/source purposes before source
   reconstruction. Repeat the read original/target checks after the put-specific
   execution check. Preservation never implies read permission or historical
   access. No authorization result is cached.
3. Retain full stored-ciphertext, exact source, current key, lifecycle/hold/expiry,
   final SQL row and draft-revision verification. Return the frozen recovered
   value only on success. Unknown/denied outcomes must contain no recovered
   payload, including when persistence completed before a lost acknowledgement
   or read-purpose failure. Immutable originals are neither overwritten nor
   execution-authorizing receipts.
4. Both preparers consume the joined verified result instead of immediately
   performing another complete read. Keep exact original/manifest comparisons,
   latest-revision and execution-expiry checks, and every fresh recheck around
   admission, persistence and final return. Do not share leases across effects.
5. Keep active, pending, closed and historical-window ownership guards. Pin the
   added method in development historical-window port validation. Timed-out
   callbacks retain admission until actual drainage and cannot release late
   content. Ordinary and historical read behavior remains unchanged.
6. Run a common native database contract against both real stores: legacy/joined
   parity and key counts, independent early/late put/read denial, nonvoid grants,
   late lifecycle/key/authority/owner loss, lost insert acknowledgement,
   concurrent recovery, immutable rows and timeout drainage. Keep prior store
   tests and preparation HTTP/SQL effect-boundary tests.
7. Verify both complete authenticated synthetic directions and broad regression/
   type checks. Record all identity/repository/token attempts without presenting
   undelayed samples as the unchanged C22 20-warm/3-cold/4-concurrent benchmark,
   warmed p95, real model quality or signed-in human acceptance.

No change to the protected architecture, Exam, records policy, runtime profile,
live model budget, provider authority, gates, deployment or release permissions.
Only owned disposable test data may be removed by the native test harness.
