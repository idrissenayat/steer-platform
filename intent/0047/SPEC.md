# Specification

1. The portable controller fixes organization/repository scope at construction
   and receives snapshot/change tool ports; it does not authenticate callers.
2. First synchronization validates/replaces a complete snapshot. A null cursor
   enters waiting-for-stream; the next sync obtains another snapshot, never a
   guessed generation. Empty snapshots remain truthful.
3. Resume validates scope, generation, strict schemas, contiguous exact decimal
   positions and next-cursor arithmetic. Apply a complete page atomically to
   reference state and cursor; duplicate snapshot keys and invalid data fail.
4. Bound page size to 1–100 and pages per sync to 1–10. When the budget ends
   with more work, report catching-up, not ready. Reference capacity is 1000.
5. Reset-required clears state and cursor. A later explicit sync obtains a fresh
   snapshot. Port/authentication failure, malformed data and overflow also clear
   state with a generic failed phase; no private error detail is returned.
6. Views are defensive immutable copies and hide references while loading.
   Overlapping sync calls reject without a second dispatch.
7. Close stops admission and clears visible state immediately, waits for actual
   outstanding port work and ignores late responses. Register request ownership
   before even a synchronously reentrant port; close before dispatch prevents I/O.
8. No polling scheduler, React binding, browser transport, durable client cache,
   source-proof gate verifier or live deployment/provider permission is added.
