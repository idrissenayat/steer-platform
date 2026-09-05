# Brief: Recover a partially completed raw batch without new object approvals

0074 deliberately rejects mixed replay/new-copy graphs because those statuses
alone do not authorize a continuation. Add a bounded checkpoint that proves
exactly what completed and exactly which prepared copies remain, under fresh
independent history, inventory and hold/reference checks.

Keep original grant, plan, request and completed-receipt bytes immutable. Require
an independent current winning reservation bound to the checkpoint before any
remaining effect. Preserve full per-copy shared proof and deadline checks and
separate human tombstone authorization. No new per-object human signature.

This is a single-checkpoint development contract. It does not implement durable
storage, provider erasure, multi-checkpoint retries or an atomic concurrency claim.
