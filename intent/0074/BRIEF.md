# Brief: Integrate one raw grant with exact current batch evidence

The pre-terminal eligibility helper is not sufficient alone: the lifecycle
candidate must actually use it, verify current history/state/inventory, derive
per-copy actions, and require independent evidence of one-use batch reservation.
The old raw path's post-terminal human decisions must not remain an alternative.

Introduce an explicit raw-v2 envelope with one pre-terminal grant and a closed
batch evidence chain. Preserve per-copy credential, delegation, assignment,
resource, replay/CAS and timely receipt checks, plus separate tombstone authority.
Verify both all-first and all-replay copy sets with original winning evidence.

This is development composition, not permission to consume a grant or erase data.
No frozen policy, Exam, registry, key window or human signature is changed.
