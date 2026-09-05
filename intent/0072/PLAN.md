# Plan

1. Expand only the raw composed fixture to three key tuples/two provider bindings.
2. Assert exact copy/action/replay counts and stable ordered aggregation for all
   six envelope permutations.
3. Test every copy's shared/human proof slots and key/grant/receipt substitutions.
4. Test each receipt at the exact deadline and one nanosecond late, then missing
   copy/aggregate/tombstone evidence.
5. Run repository checks, document remaining protocol gap and verify the push.

## Next raw protocol implementation

Create a separate explicit pre-terminal grant composition, binding only facts
available at grant issuance (approved scope, permitted targets/providers/keys,
policy, sanitizer/inspector and grant lifetime). Prove its human/provider decision
precedes terminal completion. At disposition, verify the actual terminal/current
inventory/hold/reference evidence, then derive exact one-use shared actions for
each authorized tuple without asking for a new per-object human decision.

Bind consumption/replay to the one grant's exact batch while preserving separate
per-copy credentials, reservations and receipts. Keep tombstone evidence separate.
No future-byte pre-signing, backdated approval, source-original deletion or hidden
new authority. Test all failure/replay/deadline paths before independent review.

Retention/rotation/reference, other public precision paths and migration/normative
work also remain. Do not claim the complete package ready from this matrix alone.
