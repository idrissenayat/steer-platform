# 0327 — Private draft read-phase contract

Base: `ad4ec1f91c19ba78904b9b0478a0753e1813b5eb`.

1. Register read-phase construction privately against the exact draft-store or
   draft-service read method and scope. No new HTTP/MCP field, public method,
   package export path, marker property or ambient request context selects it.
   Unregistered/wrapped readers retain complete ordinary reads and their receiver.
2. Lazily load one exact draft revision and latest-revision metadata. Verify the
   canonical encrypted content and source fingerprint with an owned key copy.
   Every intermediate consumption checks fresh read-purpose authority. Never
   cache a grant, caller decision or cross-request content result.
3. After dependent read-only work, compare the fresh historical key bytes and ID,
   recheck read permissions, reload the complete encrypted row and latest
   revision, and require equality before returning. Late hold, expiry, source
   edit, permission/key/port loss or closure denies the whole phase. Preserve
   the earliest monotonic expiry; invalid or backward SQL clocks cannot extend it.
4. Reject skipped/nonvoid/overlapping/unawaited consumption and caught failures.
   Close escaped readers. Retain actual callback/IO drainage after cancellation;
   clear the owned key copy only after dependent work has settled. No transaction
   or database row lock spans external permission, key or consumer callbacks.
5. The draft service keeps its existing four public-call slots and adds a separate
   four-slot private-phase bound so enclosing reviews cannot starve their own
   public draft reads. Both categories use the same bounded pool and shutdown,
   guard and pending-work tracking. Private phases add no public call capability
   or grants; the managed journey and review owners retain their existing bounds.
6. Only the exact service-created revision store uses guard-only inner caller
   checks: that service owns entry/final caller checks, a fresh caller after every
   metadata purpose, and both sides of each key lookup. Independent store callers
   retain their own full caller checks. Ordinary draft create/append/read methods
   and result shapes remain unchanged; SQL clock validation fails closed.
7. Wrap ordinary and shared source-review computations in the new phase. Keep
   original evidence/source/corpus ownership and final closure, including final
   full draft verification after corpus closure. No scheduling, admission,
   persistence, merge or save effect belongs inside these callbacks.
8. Verify native parity, six-to-two key lookup reduction for three reads, actual
   lifecycle transitions, late final-key denial, clock handling, four-way phase/
   public-call coexistence, rejection and drainage. Verify both authenticated
   synthetic save/recovery/reopen directions, focused/broad regression and types.
9. Correct 0326 lifecycle injections with valid aged disposable fixtures, real
   hold operations and trigger-valid expiry. Assert that mutations succeed before
   the store denies; retain the earlier evidence defect in the audit trail.

No signed requirement, retention policy, live credential/budget, runtime provider
write authority, activation, gate, deployment or release changes. C22 retains
its full 200-attempt/20 ms/five-second p95 and 20-warm/3-cold/4-concurrent protocol.
