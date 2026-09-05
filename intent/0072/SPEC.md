# Spec: Three-key raw evidence matrix

## Evidence scenario

The synthetic raw fixture uses three temporary-working object/version tuples:
two in provider/account A and one in provider/account B. Each has a distinct
provider-scoped key identity `(providerBindingId, account, keyId)` and none is a
source original. Ordinary lifecycle fixtures retain their two-copy shape.

The actual 0061 verifier processes three full human/raw approvals and three
ten-record shared action bundles, plus the separate human/shared tombstone path.
Complete first execution reports three copies/four protected actions; exact
replay reports four replay results. Outputs remain zero-effect evidence.

All six copy-envelope permutations are exercised for first execution and replay.
The authoritative inventory order controls receipt aggregation; evidenceDigest
must be identical across permutations within each mode. Input envelopes are not
sorted or rewritten as a workaround for missing evidence.

## Negative coverage

For each of the three copies, remove each of the ten shared signed proof slots
and each of the nine human signed proof slots. Every omission denies. Also test
wrong resource key, invalid raw-grant requirements, wrong replay result, transplanted
human/grant/action/receipt bytes, duplicate physical object identity and reused
provider transaction IDs.

Every raw receipt must independently meet the exact terminal-plus-60-second
deadline. With all three receipts on the boundary the candidate passes; moving
any single receipt one nanosecond later denies even with descendant signatures
and aggregate evidence rebuilt. A partial receipt, missing third copy/receipt,
incomplete aggregate or absent separate tombstone denies.

No verifier implementation or production cardinality rule changes in this
increment. These tests establish the review scenario; they do not order creation
of additional live copies, assert actual provider completeness, or close R5-001.

## Remaining raw-policy protocol gap

Historical gap at 0072: subsequent 0073/0074 implement pre-terminal eligibility
and all-first/all-replay raw-v2 composition. Partial-copy recovery and formal
review remain open; see `intent/0074/SPEC.md`. The original evidence below is not
rewritten or retroactively treated as pre-terminal acceptance.

The current candidate's human copy approval must follow the signed state, which
itself follows terminal sanitization. It also binds the complete post-terminal
graph input. That is not the accepted policy's pre-terminal raw grant enabling
deterministic disposal without a new per-object human decision. An authority's
earlier validFrom is not proof that it was signed before terminal completion.

The next raw protocol must separate exact pre-terminal approved facts from the
later verified terminal/state/action evidence. It must not pretend future receipt
or state bytes were known at signing time, automate a human signature, or weaken
current hold/reference/inventory/provider/credential/replay/CAS checks. Multi-copy
grant consumption and per-copy effects need explicit scope and replay handling.
Separate tombstone evidence remains required. This increment does not solve that
protocol or change the signed policy, protected Exam or any gate decision.
