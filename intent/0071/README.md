# 0071 · Policy-ranked lifecycle event ordering

Implements exact `(instant, policy ordinal, UUID bytes)` ordering for the policy's
ranked equal-time lifecycle events, without sorting or rewriting signed history.
All event/provider proofs and full lifecycle hold checks remain mandatory.

UUID replay identity ignores hexadecimal letter case; signed payloads and proof
bindings remain byte-exact. Unranked equal-time event types stay denied.

Read BRIEF, SPEC, PLAN, development ACCEPTANCE and EVIDENCE. This does not resolve
future retention/rotation, full raw grants or Gate 2's five formal findings.
